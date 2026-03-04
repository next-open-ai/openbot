/**
 * Jest mock for agent-browser (ESM-only, avoid transform in Jest).
 */
class BrowserManager {
    constructor() {}
    async launch() {
        return {};
    }
    async close() {
        return undefined;
    }
}
module.exports = { BrowserManager };
