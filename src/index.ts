export {
    loadSkillsFromDir,
    loadSkillsFromPaths,
    formatSkillsForPrompt,
    type Skill,
    type LoadSkillsFromDirOptions,
} from "./agent/skills.js";
export { run, type RunOptions, type RunResult } from "./agent/run.js";
export { getOpenbotAgentDir, ensureDefaultAgentDir } from "./agent/agent-dir.js";
export {
    resolveInstallTarget,
    installSkillByUrl,
    installSkillFromPath,
    type InstallByUrlOptions,
    type InstallByUrlResult,
    type InstallFromPathOptions,
    type InstallFromPathResult,
} from "./installer/index.js";
export {
    getProviderSupport,
    ensureProviderSupportFile,
    syncDesktopConfigToModelsJson,
    type ProviderSupport,
    type ProviderSupportEntry,
    type ProviderSupportModel,
    type ModelSupportType,
} from "./config/desktop-config.js";
