import { IncomingMessage } from 'http';

export interface PluginResponse {
    statusCode: number;
    /**
     * The headers to be sent in the response.
     */
    responseHeaders: any;
    /**
     * The body to be sent in the response.
     * If no mimetype is set, the response will be sent as text/plain.
     */
    body: any;
    /**
     * The headers that were given from the original request.
     */
    requestHeaders: any;
}

export class Plugin {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars, @typescript-eslint/no-explicit-any
    constructor(public name: string, options?: any) {}
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    async request(options: PluginOptions, req: IncomingMessage): Promise<PluginResponse> {
        throw new Error(`Plugin ${this.name || 'Unknown Plugin'} has not implemented Plugin.request()`);
    }
}

export interface PluginOptions {
    url: string;
    headers: { [key: string]: string };
    [key: string]: any;
}
