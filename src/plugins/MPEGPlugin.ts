import axios from 'axios';
import { IncomingMessage } from 'http';
import { Plugin, PluginOptions, PluginResponse } from './plugin';

export class MPEGPlugin extends Plugin {
    name = 'mpeg';
    constructor() {
        super('mpeg', {});
    }
    async request(options: PluginOptions, req: IncomingMessage): Promise<PluginResponse> {
        // get rid of undefined values
        const requestHeaders = JSON.parse(
            JSON.stringify({ ...({ ...req.headers, host: undefined } as any), ...options.headers })
        );
        console.log(requestHeaders);
        const response = await axios.get(options.url, {
            headers: requestHeaders,
            method: options.method || 'GET',
            responseType: 'arraybuffer',
        });
        const responseHeaders = {
            'Content-Type': response.headers['content-type'],
            'Content-Length': response.headers['content-length'] ?? response.data.byteLength,
            Date: new Date().toUTCString(),
            'Last-Modified': new Date(response.headers['last-modified'] || Date.now()).toUTCString(),
        };
        if (response.headers['content-disposition']) {
            responseHeaders['Content-Disposition'] = response.headers['content-disposition'];
        }
        if (response.headers['content-encoding']) {
            responseHeaders['Content-Encoding'] = response.headers['content-encoding'];
        }
        if (response.headers['transfer-encoding']) {
            responseHeaders['Transfer-Encoding'] = response.headers['transfer-encoding'];
        }
        // For resuming and fast forwarding in the browser
        if (response.headers['content-range']) {
            responseHeaders['Content-Range'] = response.headers['content-range'];
        }
        return {
            body: Buffer.from(response.data),
            requestHeaders: response.headers,
            responseHeaders,
            statusCode: response.status,
        };
    }
}
