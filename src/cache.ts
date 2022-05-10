import { readFile, writeFile } from 'fs/promises';
import { existsSync, mkdirSync, statSync, writeFileSync } from 'fs';
import path from 'path';

export class FileCache {
    constructor(private readonly cacheDir: string, private bufEncoding: BufferEncoding = 'binary') {
        mkdirSync(this._getFilePath(''), { recursive: true });
        writeFileSync(this._getFilePath('.gitignore'), '*');
        mkdirSync(this._getFilePath('__files__'), { recursive: true });
        mkdirSync(this._getFilePath('__pointers__'), { recursive: true });
    }
    private _getFilePath(url: string, ...extra: string[]): string {
        return path.join(process.cwd(), this.cacheDir, url, ...extra);
    }
    public async set(base64: string, contentType: string, data: any) {
        const pointerFilePath = this._getFilePath('__pointers__', base64);
        const filePath = this._getFilePath('__files__', base64);
        await writeFile(pointerFilePath, JSON.stringify({ mimetype: contentType, url: filePath }));
        return await writeFile(filePath, data);
    }
    public async get(url: string) {
        const filePath = this._getFilePath('__pointers__', url);
        if (!filePath) {
            throw new Error(`Could not find file for url ${url}`);
        }

        const { mimetype, url: path }: { mimetype: string; url: string } = JSON.parse(
            (await readFile(filePath)).toString()
        );
        const data = await readFile(path);
        return { mimetype, data, stats: statSync(path) };
    }
    // Made async for consistency with other cache implementations
    public async has(url: string) {
        const filePath = this._getFilePath('__files__', url);
        return existsSync(filePath);
    }
}
