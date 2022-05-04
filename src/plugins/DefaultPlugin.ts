import axios from 'axios';
import { Plugin, PluginOptions } from './plugin';

export class DefaultPlugin extends Plugin {
    name = 'default';
    constructor() {
        super('default', {});
    }
    async request(options: PluginOptions): Promise<{ headers: any; body: any }> {
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
