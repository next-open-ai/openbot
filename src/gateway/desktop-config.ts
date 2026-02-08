import { readFileSync, existsSync } from "fs";
import { join } from "path";
import { homedir } from "os";

const CONFIG_DIR = join(homedir(), ".openbot", "desktop");
const CONFIG_PATH = join(CONFIG_DIR, "config.json");

const DEFAULT_MAX_AGENT_SESSIONS = 5;

/**
 * 读取桌面全局配置（与 Nest ConfigService 使用同一 config.json）。
 * Gateway 进程内使用，用于获取 maxAgentSessions 等。
 */
export function getDesktopConfig(): { maxAgentSessions: number } {
    try {
        if (!existsSync(CONFIG_PATH)) {
            return { maxAgentSessions: DEFAULT_MAX_AGENT_SESSIONS };
        }
        const content = readFileSync(CONFIG_PATH, "utf-8");
        const data = JSON.parse(content) as { maxAgentSessions?: number };
        const max = data.maxAgentSessions;
        const maxAgentSessions =
            typeof max === "number" && max > 0 ? Math.floor(max) : DEFAULT_MAX_AGENT_SESSIONS;
        return { maxAgentSessions };
    } catch {
        return { maxAgentSessions: DEFAULT_MAX_AGENT_SESSIONS };
    }
}
