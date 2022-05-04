import axios from 'axios';
import { IncomingMessage } from 'http';
import { Plugin, PluginOptions } from './plugin';

export class DefaultPlugin extends Plugin {
    name = 'default';
    constructor() {
        super('default', {});
    }
    async request(options: PluginOptions, req: IncomingMessage): Promise<{ headers: any; body: any }> {
        const response = await axios.get(options.url, {
            headers: options.headers,
            method: options.method || 'GET',
            responseType: 'arraybuffer',
        });
        return {
            body: response.data,
            headers: response.headers,
        };
    }
}
