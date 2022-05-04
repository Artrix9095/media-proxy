import { IncomingMessage } from "http";

export function getProtocol(req: IncomingMessage): 'http' | 'https' {
    // @ts-ignore
    return (req.headers['x-forwarded-proto'] || req.connection.encrypted) ? 'https' : 'http';