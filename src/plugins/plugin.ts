import { IncomingMessage } from "http";

export class Plugin {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars, @typescript-eslint/no-explicit-any
    constructor(public name: string, options?: any) {}
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    async request(options: PluginOptions, req: IncomingMessage): Promise<{ headers: any; body: any }> {
        throw new Error('Method not implemented.');
    }
}

export interface PluginOptions {
    url: string;
    headers: { [key: string]: string };
    [key: string]: any;
}
