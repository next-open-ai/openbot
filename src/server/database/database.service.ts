import { Injectable, OnModuleDestroy } from '@nestjs/common';
import Database from 'better-sqlite3';
import { mkdirSync, existsSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

@Injectable()
export class DatabaseService implements OnModuleDestroy {
    private db: Database.Database | null = null;

    getDb(): Database.Database {
        if (!this.db) {
            const pathEnv = process.env.FREEBOT_DB_PATH;
            const defaultDir = join(homedir(), '.freebot', 'desktop', 'data');
            const path =
                pathEnv === ':memory:' || pathEnv === ''
                    ? ':memory:'
                    : pathEnv ?? join(process.env.FREEBOT_DB_DIR ?? defaultDir, 'freebot.db');
            if (path !== ':memory:') {
                const dir = path.endsWith('.db') ? join(path, '..') : path;
                if (!existsSync(dir)) {
                    mkdirSync(dir, { recursive: true });
                }
            }
            this.db = new Database(path);
            this.db.pragma('journal_mode = WAL');
            this.runMigrations();
        }
        return this.db;
    }

    private runMigrations(): void {
        const db = this.db!;
        db.exec(`
          CREATE TABLE IF NOT EXISTS sessions (
            id TEXT PRIMARY KEY,
            created_at INTEGER NOT NULL,
            last_active_at INTEGER NOT NULL,
            message_count INTEGER NOT NULL DEFAULT 0,
            status TEXT NOT NULL DEFAULT 'idle',
            workspace TEXT,
            provider TEXT,
            model TEXT,
            title TEXT,
            preview TEXT
          );
          CREATE TABLE IF NOT EXISTS chat_messages (
            id TEXT PRIMARY KEY,
            session_id TEXT NOT NULL,
            role TEXT NOT NULL,
            content TEXT NOT NULL,
            timestamp INTEGER NOT NULL,
            tool_calls_json TEXT,
            FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
          );
          CREATE INDEX IF NOT EXISTS idx_chat_messages_session_id ON chat_messages(session_id);
        `);
    }

    run(sql: string, params: unknown[] = []): Database.RunResult {
        return this.getDb().prepare(sql).run(...params);
    }

    get<T>(sql: string, params: unknown[] = []): T | undefined {
        return this.getDb().prepare(sql).get(...params) as T | undefined;
    }

    all<T>(sql: string, params: unknown[] = []): T[] {
        return this.getDb().prepare(sql).all(...params) as T[];
    }

    onModuleDestroy(): void {
        if (this.db) {
            this.db.close();
            this.db = null;
        }
    }
}
