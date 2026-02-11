import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { mkdirSync, existsSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

/** RunResult compatible with better-sqlite3 for callers that use .changes / .lastInsertRowid */
export interface RunResult {
    changes: number;
    lastInsertRowid: number;
}

/** sql.js Database type (minimal for our usage) */
type SqlJsDatabase = {
    run(sql: string, params?: unknown[]): void;
    exec(sql: string): { columns: string[]; values: unknown[][] }[];
    prepare(sql: string): {
        bind(params: unknown[]): void;
        step(): boolean;
        getAsObject(): Record<string, unknown>;
        free(): void;
    };
    export(): Uint8Array;
    close(): void;
};

@Injectable()
export class DatabaseService implements OnModuleInit, OnModuleDestroy {
    private sqlDb: SqlJsDatabase | null = null;
    private dbPath: string | ':memory:' | null = null;
    private initPromise: Promise<void> | null = null;

    async onModuleInit(): Promise<void> {
        if (this.initPromise) return this.initPromise;
        this.initPromise = this.doInit();
        return this.initPromise;
    }

    private async doInit(): Promise<void> {
        const pathEnv = process.env.OPENBOT_DB_PATH;
        const defaultDir = join(homedir(), '.openbot', 'desktop', 'data');
        const path =
            pathEnv === ':memory:' || pathEnv === ''
                ? ':memory:'
                : pathEnv ?? join(process.env.OPENBOT_DB_DIR ?? defaultDir, 'openbot.db');

        if (path !== ':memory:') {
            const dir = path.endsWith('.db') ? join(path, '..') : path;
            if (!existsSync(dir)) {
                mkdirSync(dir, { recursive: true });
            }
        }

        const initSqlJs = (await import('sql.js')).default;
        const SQL = await initSqlJs();
        let db: SqlJsDatabase;
        if (path === ':memory:') {
            db = new SQL.Database() as SqlJsDatabase;
            this.dbPath = ':memory:';
        } else {
            if (existsSync(path)) {
                const buf = readFileSync(path);
                db = new SQL.Database(new Uint8Array(buf)) as SqlJsDatabase;
            } else {
                db = new SQL.Database() as SqlJsDatabase;
            }
            this.dbPath = path;
        }
        this.sqlDb = db;
        db.run('PRAGMA foreign_keys = ON;');
        this.runMigrations();
    }

    private getDb(): SqlJsDatabase {
        if (!this.sqlDb) {
            throw new Error('Database not initialized. Ensure onModuleInit() has completed (Nest awaits it before listening).');
        }
        return this.sqlDb;
    }

    private runMigrations(): void {
        const db = this.getDb();
        const ddl = `
          CREATE TABLE IF NOT EXISTS sessions (
            id TEXT PRIMARY KEY,
            created_at INTEGER NOT NULL,
            last_active_at INTEGER NOT NULL,
            message_count INTEGER NOT NULL DEFAULT 0,
            status TEXT NOT NULL DEFAULT 'idle',
            agent_id TEXT DEFAULT 'default',
            workspace TEXT,
            provider TEXT,
            model TEXT,
            title TEXT,
            preview TEXT,
            type TEXT DEFAULT 'chat'
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

          CREATE TABLE IF NOT EXISTS scheduled_tasks (
            id TEXT PRIMARY KEY,
            workspace TEXT NOT NULL DEFAULT 'default',
            message TEXT NOT NULL,
            schedule_type TEXT NOT NULL,
            run_at INTEGER,
            cron_expr TEXT,
            repeat_rule_json TEXT,
            enabled INTEGER NOT NULL DEFAULT 1,
            last_run_at INTEGER,
            created_at INTEGER NOT NULL,
            updated_at INTEGER NOT NULL
          );
          CREATE INDEX IF NOT EXISTS idx_scheduled_tasks_enabled ON scheduled_tasks(enabled);

          CREATE TABLE IF NOT EXISTS scheduled_task_executions (
            id TEXT PRIMARY KEY,
            task_id TEXT NOT NULL,
            ran_at INTEGER NOT NULL,
            status TEXT NOT NULL,
            session_id TEXT,
            user_message TEXT NOT NULL,
            assistant_content TEXT,
            error_message TEXT,
            created_at INTEGER NOT NULL,
            FOREIGN KEY (task_id) REFERENCES scheduled_tasks(id) ON DELETE CASCADE
          );
          CREATE INDEX IF NOT EXISTS idx_task_executions_task_id ON scheduled_task_executions(task_id);

          CREATE TABLE IF NOT EXISTS token_usage (
            id TEXT PRIMARY KEY,
            session_id TEXT NOT NULL,
            source TEXT NOT NULL,
            task_id TEXT,
            execution_id TEXT,
            prompt_tokens INTEGER NOT NULL DEFAULT 0,
            completion_tokens INTEGER NOT NULL DEFAULT 0,
            total_tokens INTEGER NOT NULL DEFAULT 0,
            created_at INTEGER NOT NULL
          );
          CREATE INDEX IF NOT EXISTS idx_token_usage_session_id ON token_usage(session_id);
          CREATE INDEX IF NOT EXISTS idx_token_usage_created_at ON token_usage(created_at);
        `;
        const statements = ddl.split(';').map((s) => s.trim()).filter(Boolean);
        for (const stmt of statements) {
            db.run(stmt + ';');
        }
        try {
            const info = this.all<{ name: string }>('PRAGMA table_info(sessions)', []);
            if (!info.some((c) => c.name === 'type')) {
                db.run("ALTER TABLE sessions ADD COLUMN type TEXT DEFAULT 'chat';");
            }
            if (!info.some((c) => c.name === 'agent_id')) {
                db.run("ALTER TABLE sessions ADD COLUMN agent_id TEXT DEFAULT 'default';");
            }
        } catch (_) {
            // ignore
        }
    }

    run(sql: string, params: unknown[] = []): RunResult {
        const db = this.getDb();
        db.run(sql, params as unknown[]);
        const rows = db.exec('SELECT changes() AS c, last_insert_rowid() AS id');
        const c = rows[0]?.values?.[0]?.[0] ?? 0;
        const id = rows[0]?.values?.[0]?.[1] ?? 0;
        return { changes: Number(c), lastInsertRowid: Number(id) };
    }

    get<T>(sql: string, params: unknown[] = []): T | undefined {
        const db = this.getDb();
        const stmt = db.prepare(sql);
        try {
            stmt.bind(params as unknown[]);
            const hasRow = stmt.step();
            return (hasRow ? (stmt.getAsObject() as T) : undefined);
        } finally {
            stmt.free();
        }
    }

    all<T>(sql: string, params: unknown[] = []): T[] {
        const db = this.getDb();
        const stmt = db.prepare(sql);
        try {
            stmt.bind(params as unknown[]);
            const rows: T[] = [];
            while (stmt.step()) {
                rows.push(stmt.getAsObject() as T);
            }
            return rows;
        } finally {
            stmt.free();
        }
    }

    onModuleDestroy(): void {
        if (!this.sqlDb) return;
        if (this.dbPath && this.dbPath !== ':memory:') {
            try {
                const data = this.sqlDb.export();
                writeFileSync(this.dbPath, Buffer.from(data));
            } catch (e) {
                console.error('[DatabaseService] Failed to persist database:', e);
            }
        }
        this.sqlDb.close();
        this.sqlDb = null;
        this.dbPath = null;
        this.initPromise = null;
    }
}
