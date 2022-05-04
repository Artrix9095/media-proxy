import axios from 'axios';
import { IncomingMessage } from 'http';
import { Plugin, PluginOptions } from './plugin';
import Parser from 'hls-parser';
import { getProtocol } from '../util/http';
// Map possible file extensions to their corresponding proxy plugin name
const fileExtensionToPluginMap = new Map([
    ['m3u8', 'hls'],
    ['m3u', 'hls'],
    ['m3u8s', 'hls'],
    ['mp4', 'mpeg'],
    ['ts', 'mpeg'],
    ['mpeg', 'mpeg'],
    ['mpg', 'mpeg'],
    ['mpg4', 'mpeg'],
    ['m4v', 'mpeg'],
    ['m4a', 'mpeg'],
    ['m4b', 'mpeg'],
    ['m4p', 'mpeg'],
    ['m4r', 'mpeg'],
    ['m4s', 'mpeg'],
    ['m4v', 'mpeg'],
    ['mov', 'mpeg'],
    ['avi', 'mpeg'],
    ['mkv', 'mpeg'],
    ['flv', 'mpeg'],
]);
/**
 * A plugin for proxying HLS files and streams (.m3u8)
 * @class HLSPlugin
 * @extends {Plugin}
 * @implements {Plugin}
 * @requires {@link MPEGPlugin} {@link DefaultPlugin}
 */
export class HLSPlugin extends Plugin {
    name = 'hls';
    constructor() {
        super('hls', {});
    }
    private _getProxiedUrl(url: string, originalUrl: string, headers: any, req: IncomingMessage): string {
        let _url: URL;
        if (!/https?:\/\//.test(url)) {
            _url = new URL(url, new URL(originalUrl));
        } else {
            _url = new URL(url);
        }
        const opt: PluginOptions = {
            url: _url.toString(),
            headers,
        };
        const fileExtension = _url.pathname.split('.').pop();
        let plugin = 'default';
        if (fileExtensionToPluginMap.has(fileExtension)) {
            plugin = fileExtensionToPluginMap.get(fileExtension);
        }
        // Check if the request was made over https
        // @ts-ignore
        const protocol = getProtocol(req);
        // @ts-ignore
        // remove the first slash from the url
        const _path: string[] = ((req.originalUrl || req.url) as string).substring(1).split('/'); // For express
        // Remove the base64 encoded url from the path
        _path.pop();
        // Remove the plugin name from the path
        _path.pop();

        const path = _path.join('/');

        const baseUrl = `${protocol}://${req.headers.host}/${path ? path + '/' : ''}${plugin}`;

        const base64 = Buffer.from(JSON.stringify(opt)).toString('base64url');

        return `${baseUrl}/${base64}`;
    }
    async request(options: PluginOptions, req: IncomingMessage): Promise<{ headers: any; body: any }> {
        // Make a request to the url specified in the options using the headers specified in the options
        const response = await axios.get(options.url, {
            headers: options.headers,
            method: options.method || 'GET',
            responseType: 'text',
        });
        // Parse the response body into a hls playlist
        const playlist = Parser.parse(response.data);
        // Replace all the urls in the playlist with proxied urls
        playlist.uri = this._getProxiedUrl(playlist.uri, options.url, options.headers, req);
        if (playlist.isMasterPlaylist) {
            playlist.variants.map(variant => {
                variant.uri = this._getProxiedUrl(variant.uri, options.url, options.headers, req);
            });
        } else if (!playlist.isMasterPlaylist) {
            // Bad code quality to bypass the type checker
            (playlist as any).segments = (playlist as Parser.types.MediaPlaylist).segments.map(segment => {
                return {
                    ...segment,
                    uri: this._getProxiedUrl(segment.uri, options.url, options.headers, req),
                };
            });
        }
        return {
            body: Parser.stringify(playlist),
            headers: {
                status: response.status,
                // 'Content-Type': response.headers['Content-Type'] || 'application/vnd.apple.mpegurl',
            },
        };
    }
}
