import { readFile, writeFile } from 'fs/promises';
import { existsSync, fstat, mkdirSync, writeFileSync } from 'fs';
import path from 'path';

export class FileCache {
    constructor(private readonly cacheDir: string) {
        mkdirSync(this._getFilePath(''), { recursive: true });
        writeFileSync(this._getFilePath('.gitignore'), '*');
    }
    private _getFilePath(url: string, ...extra: string[]): string {
        return path.join(process.cwd(), this.cacheDir, url, ...extra);
    }
    public async set(base64: string, contentType: string, data: any) {
        const filePath = this._getFilePath(base64);
        return await writeFile(filePath, JSON.stringify({ mimetype: contentType, buf: Buffer.from(data) }));
    }
    public async get(url: string) {
        const filePath = this._getFilePath(url);
        if (!filePath) {
            throw new Error(`Could not find file for url ${url}`);
        }
        const file = JSON.parse((await readFile(filePath)).toString());
        return { mimetype: file.mimetype, data: Buffer.from(file.buf.data) };
    }
    public has(url: string) {
        const filePath = this._getFilePath(url);
        return existsSync(filePath);
    }
}