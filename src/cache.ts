import { readFile, writeFile } from 'fs/promises';
import { existsSync, mkdirSync, statSync, unlinkSync, writeFileSync } from 'fs';
import path from 'path';

export interface CacheGet {
    mimetype: string;
    data: Buffer;
    stats: {
        lastModified: Date;
    };
}

export class FileCache {
    constructor(
        private readonly cacheDir: string,
        private readonly maxAge: number = 1000 * 60 * 25 /* 25 minutes */
    ) {
        // Initialize all the caching directories
        mkdirSync(this._getFilePath(), { recursive: true });
        writeFileSync(this._getFilePath('.gitignore'), '*');
        mkdirSync(this._getFilePath('__files__'), { recursive: true });
        mkdirSync(this._getFilePath('__pointers__'), { recursive: true });
    }
    private _getFilePath(url = '', ...extra: string[]): string {
        return path.join(process.cwd(), this.cacheDir, url, ...extra);
    }
    public async set(base64: string, contentType: string, data: any) {
        const pointerFilePath = this._getFilePath('__pointers__', base64);
        const filePath = this._getFilePath('__files__', base64);
        await writeFile(pointerFilePath, JSON.stringify({ mimetype: contentType, url: filePath }));
        // delete the file after it reaches the max age without blocking the main thread, make sure it only happens once
        setTimeout(() => {
            if (statSync(filePath).mtimeMs <= Date.now() - this.maxAge) {
                unlinkSync(filePath);
                unlinkSync(pointerFilePath);
                console.log(`Deleted ${filePath}`);
            }
        }, 0);
        return await writeFile(filePath, data);
    }
    public async get(url: string): Promise<CacheGet> {
        const filePath = this._getFilePath('__pointers__', url);
        if (!filePath) {
            throw new Error(`Could not find file for url ${url}`);
        }

        const { mimetype, url: path }: { mimetype: string; url: string } = JSON.parse(
            (await readFile(filePath)).toString()
        );
        const data = await readFile(path);
        const stats = statSync(path);
        return { mimetype, data, stats: { lastModified: stats.mtime } };
    }
    // Made async for consistency with other cache implementations
    public async has(url: string) {
        const filePath = this._getFilePath('__files__', url);
        return existsSync(filePath);
    }
}
