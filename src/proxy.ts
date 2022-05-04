import type { Server as HTTPSServer } from 'https';
import { createServer, IncomingMessage, Server as HTTPServer, ServerResponse } from 'http';
import { TypedEmitter } from './util/event-emitter';
import { EventEmitter } from 'events';
import { DefaultPlugin, MPEGPlugin, Plugin, PluginOptions } from './plugins';
import winston from 'winston';
import { getProtocol } from './util/http';

export class Proxy extends (EventEmitter as {
    new (): TypedEmitter<{ request: [IncomingMessage, ServerResponse] }>;
}) {
    private server: HTTPServer | HTTPServer;
    private plugins = new Map<string, Plugin>();
    private logger: winston.Logger | null = null;
    private _defaultHeaders: Map<string, string[] | string> = new Map([
        ['Access-Control-Allow-Origin', '*'],
        ['Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept'],
        ['Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS'],
        ['Access-Control-Max-Age', '1728000'],
    ]);
    constructor(options: ProxyOptions = {}, callback?: () => void) {
        super();
        options = {
            port: null,
            server: null,
            host: null,
            debug: false,
            plugins: [new MPEGPlugin(), new DefaultPlugin()],
            ...options,
        };
        if (options.defaultHeaders) {
            options.defaultHeaders.forEach((value, key) => {
                this._defaultHeaders.set(key, value);
            });
        }
        if (options.debug) {
            this.logger = winston.createLogger({
                level: 'debug',
                format: winston.format.combine(
                    winston.format.colorize(),
                    winston.format.label({ label: 'proxy' }),
                    winston.format.timestamp(),
                    winston.format.prettyPrint(),
                    winston.format.printf(info => `[${info.timestamp}] ${info.level}: ${info.message}`)
                ),
                transports: [new winston.transports.Console()],
            });
        }
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
        res: ServerResponse
    ): Promise<any> {
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
        this._log('debug', `Plugin ${pluginName} found.`);
        const { headers, body } = await plugin.request(options, req).catch(e => {
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
            return { headers: {}, body: null };
        });
        this._log('debug', `Plugin ${pluginName} succeeded.`);
        // WARNING: Bad code ahead.
        res.writeHead(headers.status, {
            ...headers,
            ...Object.fromEntries(
                // Convert default headers to object entries
                [...this._defaultHeaders.entries()].map(([key, val]) => [
                    key,
                    // If value is an array, join with comma
                    Array.isArray(val) ? val.join(', ') : val,
                ])
            ),
        });
        this._log('debug', `Plugin ${pluginName} wrote headers.`);
        res.end(body);
        this._log('debug', `Plugin ${pluginName} ended.`);
    }
    private _requestHandler = async (req: IncomingMessage, res: ServerResponse) => {
        // @ts-ignore
        const protocol = getProtocol(req);
        const url = new URL(req.url, `${protocol}://${req.headers.host}`);
        this._log('info', `${req.method} ${url.pathname}`);
        const [_, plugin, base64] = url.pathname.split('/');
        this._log('info', `plugin: ${plugin}`);
        let options: PluginOptions;
        if (plugin && base64) {
            try {
                options = JSON.parse(Buffer.from(base64, 'base64').toString('utf8'));
                this._log('info', `options: ${JSON.stringify(options, null, 2)}`);
            } catch (e) {
                this._log('error', `Failed to parse options: ${e}`);
                // Write to response a error header and return null
                res.writeHead(400, {
                    'Content-Type': 'application/json',
                });
                res.end(
                    JSON.stringify({
                        error: e,
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
        await this._pluginHandler(plugin, options, req, res);
    };
    public asRouter(): any {
        let router;
        try {
            // eslint-disable-next-line @typescript-eslint/no-var-requires
            router = require('express').Router();
        } catch (e) {
            throw new Error('You need to install express to use this method.');
        }
        router.all('/:plugin/:base64', (req, res) => {
            this._requestHandler(req, res);
        });
        return router;
    }
}

export interface ProxyOptions {
    server?: HTTPSServer | HTTPServer | null;
    port?: number | string | null;
    host?: string | null;
    plugins?: Plugin[];
    defaultHeaders?: Map<string, string | string[]>;
    /**
     * @default false
     */
    debug?: boolean;
}
