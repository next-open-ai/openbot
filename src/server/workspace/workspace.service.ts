import { Injectable } from '@nestjs/common';
import { readdir, stat, rm } from 'fs/promises';
import { join, resolve, relative } from 'path';
import { existsSync } from 'fs';
import { homedir } from 'os';

export interface WorkspaceItem {
    name: string;
    path: string; // relative path from workspace root
    isDirectory: boolean;
    size?: number;
    mtime?: number;
}

@Injectable()
export class WorkspaceService {
    private getWorkspaceRoot(name: string): string {
        const homeDir = process.env.HOME || process.env.USERPROFILE || homedir();
        return resolve(homeDir, '.freebot', 'workspace', name);
    }

    /** List workspace names (directories under ~/.freebot/workspace) */
    async listWorkspaces(): Promise<string[]> {
        const homeDir = process.env.HOME || process.env.USERPROFILE || homedir();
        const base = resolve(homeDir, '.freebot', 'workspace');
        if (!existsSync(base)) {
            return [];
        }
        const entries = await readdir(base, { withFileTypes: true });
        return entries.filter((e) => e.isDirectory()).map((e) => e.name).sort();
    }

    /** List files and folders under a path relative to workspace root. Empty path = root. */
    async listDocuments(workspaceName: string, relativePath: string = ''): Promise<WorkspaceItem[]> {
        const root = resolve(this.getWorkspaceRoot(workspaceName));
        if (!existsSync(root)) {
            return [];
        }
        const safePath = this.safeRelativePath(relativePath);
        const dir = resolve(root, safePath);
        const dirNormalized = resolve(dir);
        const rootNormalized = resolve(root);
        if (!dirNormalized.startsWith(rootNormalized) || !existsSync(dirNormalized)) {
            return [];
        }
        const entries = await readdir(dirNormalized, { withFileTypes: true });
        const items: WorkspaceItem[] = [];
        for (const e of entries) {
            const fullPath = join(dirNormalized, e.name);
            const rel = relative(rootNormalized, fullPath);
            const st = await stat(fullPath);
            items.push({
                name: e.name,
                path: rel,
                isDirectory: e.isDirectory(),
                size: st.isFile() ? st.size : undefined,
                mtime: st.mtimeMs,
            });
        }
        return items.sort((a, b) => {
            if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1;
            return a.name.localeCompare(b.name);
        });
    }

    /**
     * Resolve a relative path and ensure it stays under workspace root.
     * Returns path suitable for join(workspaceRoot, result).
     */
    resolveFilePath(workspaceName: string, relativePath: string): { absolutePath: string; safe: boolean } {
        const root = resolve(this.getWorkspaceRoot(workspaceName));
        const safe = this.safeRelativePath(relativePath);
        const absolute = resolve(root, safe);
        const ok = resolve(absolute).startsWith(root) && existsSync(absolute);
        return { absolutePath: absolute, safe: ok };
    }

    /** Delete a file or directory (recursive) under workspace. Returns true if deleted. */
    async deletePath(workspaceName: string, relativePath: string): Promise<boolean> {
        const { absolutePath, safe } = this.resolveFilePath(workspaceName, relativePath);
        if (!safe || !existsSync(absolutePath)) return false;
        await rm(absolutePath, { recursive: true });
        return true;
    }

    private safeRelativePath(relativePath: string): string {
        if (!relativePath || relativePath === '.') return '';
        const normalized = relativePath.replace(/\\/g, '/').replace(/\/+/g, '/').replace(/^\/+/, '');
        const parts = normalized.split('/').filter((p) => p !== '..' && p !== '.');
        return parts.join('/');
    }
}
