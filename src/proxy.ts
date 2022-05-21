import type { Server as HTTPSServer } from 'https';
import { createServer, IncomingMessage, Server as HTTPServer, ServerResponse } from 'http';
import { TypedEmitter } from './util/event-emitter';
import { EventEmitter } from 'events';
import { DefaultPlugin, MPEGPlugin, Plugin, PluginOptions } from './plugins';
import winston from 'winston';
import { getProtocol } from './util/http';
import { FileCache } from './cache';

export class Proxy extends (EventEmitter as {
    new (): TypedEmitter<{ request: [IncomingMessage, ServerResponse] }>;
}) {
    private server: HTTPServer | HTTPServer;
    private plugins = new Map<string, Plugin>();
    private logger: winston.Logger | null = null;
    private _cache: FileCache | null = null;
    private _defaultHeaders = new Map<string, string[] | string>()
        .set('Access-Control-Allow-Origin', '*')
        .set('Access-Control-Allow-Headers', ['Origin', 'X-Requested-With', 'Content-Type', 'Accept'])
        .set('Access-Control-Allow-Methods', ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS']);
    public readonly maxCacheSize: number;
    public readonly minCacheSize: number;
    constructor(options: ProxyOptions = {}, callback?: () => void) {
        super();
        options = {
            port: null,
            server: null,
            host: null,
            debug: false,
            maxCacheSize: 600 * 1024 * 1024, // 600mb
            minCacheSize: 1024 * 1024 * 1, // 1MB
            plugins: [new MPEGPlugin(), new DefaultPlugin()],
            ...options,
        };
        this._cache = new FileCache('.cache', options.maxCacheAge);
        this._defaultHeaders.set('Max-Age', options.maxCacheAge.toString());
        this._defaultHeaders.set('Access-Control-Max-Age', options.maxCacheAge.toString());
        if (options.defaultResponseHeaders) {
            options.defaultResponseHeaders.forEach((value, key) => {
                this._defaultHeaders.set(key, value);
            });
        }

        if (options.debug) {
            this.logger = winston.createLogger({
                level: 'debug',
                format: winston.format.combine(
                    winston.format.colorize({ all: true }),
                    winston.format.label({ label: 'proxy' }),
                    winston.format.timestamp(),
                    winston.format.prettyPrint(),
                    winston.format.printf(info => `[${info.timestamp}] ${info.level}: ${info.message}`)
                ),
                transports: [new winston.transports.Console()],
            });
        }
        this.maxCacheSize = options.maxCacheSize;
        this.minCacheSize = options.minCacheSize;

        if (!options.port && !options.server) {
            // throw new TypeError('Must provide either a port or a server to create a proxy.');
        }
        if (options.port) {
            this._log('info', `Hosting proxy on port since no server was provided.`);
            this.server = createServer(this._requestHandler);
            this.server.listen(Number(options.port), options.host, callback);
            this._log('info', `Proxy listening on port ${options.port}.`);
        } else if (options.server) {
            this.server = options.server;
            this._log('info', `Using provided server.`);
            this.server.on('request', this._requestHandler);
            this.server.on('listening', callback);
        }
        options.plugins.forEach(plugin => this.plugins.set(plugin.name, plugin));
    }
    private _log(level: string, message: string) {
        if (this.logger) {
            this.logger.log(level, message);
        }
        return this;
    }
    private async _pluginHandler(
        pluginName: string,
        options: PluginOptions,
        req: IncomingMessage,
        res: ServerResponse,
        url: string
    ): Promise<any> {
        const [, base64] = url.split('/').slice(1);
        const plugin = this.plugins.get(pluginName);
        if (!plugin) {
            this._log('error', `Plugin ${pluginName} not found.`);
            // End with 404
            res.writeHead(404, {
                'Content-Type': 'text/plain',
            });
            res.end('404 plugin not found.');
            return;
        }
        this._log('info', `Plugin ${pluginName} found.`);
        if ((await this._cache.has(base64)) && req.headers.range) {
            delete req.headers.range;
        }
        const { responseHeaders, statusCode, body } = await plugin.request(options, req).catch(e => {
            this._log('error', `Plugin ${pluginName} failed.`);
            // End with 500
            res.writeHead(500, {
                'Content-Type': 'application/json',
            });
            res.end(
                JSON.stringify({
                    error: e.message,
                })
            );
            // typescript stuff
            throw e;
        });
        const key = base64;
        this._log('info', `Plugin ${pluginName} succeeded.`);
        const contentSize =
            statusCode !== 204
                ? responseHeaders['Content-Length'] ?? body.byteLength ?? Buffer.from(body).byteLength
                : 0;
        let shouldCache =
            req.headers['cache-control'] !== 'no-cache' &&
            contentSize < this.maxCacheSize &&
            contentSize > this.minCacheSize;
        // iF the minimum cache size is -1, we don't cache the response
        if (this.minCacheSize === -1) {
            shouldCache = false;
        }
        // If the minimum cache size is 0, we always cache the response
        else if (this.minCacheSize === 0) {
            shouldCache = true;
        }
        // WARNING: Bad code ahead.
        res.writeHead(statusCode, {
            ...responseHeaders,
            ...Object.fromEntries(
                // Convert default headers to object entries
                [...this._defaultHeaders.entries()].map(([key, val]) => [
                    key,
                    // If value is an array, join with comma
                    Array.isArray(val) ? val.join(', ') : val,
                ])
            ),
            ETag: shouldCache ? `W/"${base64}"` : '',
        });
        this._log('verbose', `Plugin ${pluginName} wrote headers.`);
        res.end(body);
        this._log('verbose', `Plugin ${pluginName} ended.`);
        if (shouldCache) {
            await this._handleCache(
                responseHeaders,
                body,
                key,
                responseHeaders['Content-Type'] || 'text/plain'
            ).catch(e =>
                this._log(
                    'error',
                    // prettier-ignore
                    `Failed to cache ${pluginName} response.\n` +
                    `Error: ${e.message}\n` +
                    `Should Cache: ${shouldCache}\n` +
                    `Content Size: ${contentSize}`
                )
            );
            this._log(
                'verbose',
                // prettier-ignore
                `Plugin ${pluginName} cached.\n` + 
                `File Size: ${contentSize}`
            );
        } else {
            this._log(
                'verbose',
                // prettier-ignore
                `It was determined ${pluginName} is not cacheable.\n` +
                `Content Size: ${contentSize}\n` +
                `Minimum Cache Size: ${this.minCacheSize}\n` +
                `Maximum Cache Size: ${this.maxCacheSize}\n` +
                `Cache Control: ${req.headers['cache-control']}`
            );
        }
    }
    private _requestHandler = async (req: IncomingMessage, res: ServerResponse) => {
        this.emit('request', req, res);
        // @ts-ignore
        const protocol = getProtocol(req);
        const url = new URL(req.url, `${protocol}://${req.headers.host}`);
        this._log('info', `${req.method} ${url.pathname}`);
        const [plugin, base64] = url.pathname.split('/').slice(1); // Remove first slash
        this._log('info', `plugin: ${plugin}`);
        let options: PluginOptions;
        if (plugin && base64) {
            try {
                options = JSON.parse(Buffer.from(base64, 'base64').toString('utf8'));
                this._log('info', `options: \n ${JSON.stringify(options, null, 2)}`);
            } catch (e) {
                this._log('error', `Failed to parse options: ${e}`);
                // Write to response a error header and return null
                res.writeHead(400, {
                    'Content-Type': 'application/json',
                });
                res.end(
                    JSON.stringify({
                        error: `Invalid Options for plugin: ${plugin} specified. ${(e as any).message}`,
                    })
                );
                return;
            }
        } else {
            // End with 404
            res.writeHead(404, {
                'Content-Type': 'text/plain',
            });
            res.end('404 not found.');
            this._log('info', 'Unknown plugin.');
            return;
        }
        this._log('info', 'Handling request...');
        const key = base64;
        if (
            (await this._cache.has(key)) &&
            req.headers['cache-control'] !== 'no-cache'
            // && (req.headers['etag'] === `W/"${key}"` || req.headers['if-none-match'] === `W/"${key}"`)
        ) {
            this._log('info', 'Cached response found.');
            let data: Buffer;
            let statusCode = 200;
            const cached = await this._cache.get(key);
            // The request is probably a video/audio file and the client is asking for a range, so we parse the cached version
            if (req.headers.range) {
                const range = req.headers.range.split('=')[1];
                const [start, end] = range.split('-').map(Number);
                const length = cached.data.byteLength;
                this._log('info', `Ranging Cached Content: ${start}-${end || length}`);
                res.setHeader('Content-Length', (end || length) - start);
                res.setHeader('Content-Range', `bytes ${start}-${end || length - 1}/${length}`);
                data = cached.data.slice(start, end || length);
                statusCode = 206;
            } else {
                data = cached.data;
            }
            res.writeHead(statusCode, {
                'Content-Type': cached.mimetype,
                ETag: `W/"${key}"`,
                'Content-Length': data.byteLength,
                'Last-Modified': cached.stats.lastModified.toUTCString(),
            });
            res.end(data);
            this._log('info', 'Cached response sent.');
        } else {
            this._log('info', 'No cached response found. Fallbacking to plugin.');
            await this._pluginHandler(plugin, options, req, res, url.pathname);
        }
    };
    public async kill() {
        this._log('info', 'Killing server...');
        this.server.close();
    }
    public asRouter(): any {
        this._log('info', 'Running as express router.');
        let router;
        try {
            this._log('info', 'Creating router...');
            // eslint-disable-next-line @typescript-eslint/no-var-requires
            router = require('express').Router();
        } catch (e) {
            this._log('error', `Failed to create router: ${e}`);
            throw new Error('You need to install express to use this method.');
        }
        this._log('info', 'Router created.');
        router.all('/:plugin/:base64', (req, res) => {
            this._requestHandler(req, res);
        });
        return router;
    }
    private async _handleCache(headers: any, body: any, base64: string, contentType: string) {
        if (this._cache) {
            this._log('info', 'Handling cache...');
            const key = base64;
            await this._cache.set(key, contentType, body);
            this._log('info', 'Cache handled.');
        }
    }
}

export interface ProxyOptions {
    /**
     * @experimental
     */
    server?: HTTPSServer | HTTPServer | null;
    port?: number | string | null;
    host?: string | null;
    plugins?: Plugin[];
    defaultResponseHeaders?: Map<string, string | string[]>;
    /**
     * @default false
     * @description Whether to log requests and responses.
     */
    debug?: boolean;
    /**
     *
     * @default 600mb
     * @description A number (in bytes) that will be used as the max size of a cached response. If the response is larger than this, it will not be cached.
     */
    maxCacheSize?: number;
    /**
     * A number (in bytes) that will be used as the min size of a cached response. If the response is smaller than this, it will not be cached.
     * If set to 0, the response will always be cached.
     * If set to -1, the response will never be cached.
     * @default 1mb
     */
    minCacheSize?: number;
    maxCacheAge?: number;
}
