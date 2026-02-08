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
        `);
        // Add session type column if missing (scheduled vs chat)
        try {
            const info = db.prepare('PRAGMA table_info(sessions)').all() as { name: string }[];
            if (!info.some((c) => c.name === 'type')) {
                db.exec(`ALTER TABLE sessions ADD COLUMN type TEXT DEFAULT 'chat'`);
            }
            if (!info.some((c) => c.name === 'agent_id')) {
                db.exec(`ALTER TABLE sessions ADD COLUMN agent_id TEXT DEFAULT 'default'`);
            }
        } catch (_) {
            // ignore
        }
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
