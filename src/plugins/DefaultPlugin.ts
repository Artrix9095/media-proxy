import axios from 'axios';
import { Plugin, PluginOptions, PluginResponse } from './plugin';

export class DefaultPlugin extends Plugin {
    name = 'default';
    constructor() {
        super('default', {});
    }
    async request(options: PluginOptions): Promise<PluginResponse> {
        const response = await axios.get(options.url, {
            headers: options.headers,
            method: options.method || 'GET',
            responseType: 'arraybuffer',
        });
        return {
            body: Buffer.from(response.data),
            responseHeaders: response.headers,
            requestHeaders: response.headers,
            statusCode: response.status,
        };
    }
}
