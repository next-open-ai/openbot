const path = require('path');
const rootDir = path.join(__dirname, '..');
/** @type {import('jest').Config} */
module.exports = {
    preset: 'ts-jest/presets/default-esm',
    testEnvironment: 'node',
    rootDir,
    testMatch: ['**/*.spec.ts', '**/*.e2e-spec.ts'],
    moduleFileExtensions: ['ts', 'js', 'json'],
    transform: { '^.+\\.tsx?$': ['ts-jest', { useESM: true, tsconfig: 'tsconfig.json' }] },
    moduleNameMapper: {
        '^(\\.{1,2}/.*)\\.js$': '$1',
        '^(\\.{1,2}/.*)\\.ts$': '$1',
        '^@mariozechner/pi-coding-agent$': '<rootDir>/test/mocks/pi-coding-agent.js',
        '^agent-browser/dist/browser\\.js$': '<rootDir>/test/mocks/agent-browser.js',
        '^agent-browser$': '<rootDir>/test/mocks/agent-browser.js',
        '^@opencode-ai/sdk$': '<rootDir>/test/mocks/opencode-sdk.js',
        '^@mariozechner/pi-ai/dist/providers/register-builtins\\.js$': '<rootDir>/test/mocks/pi-ai-register-builtins.js',
        '^@instantlyeasy/claude-code-sdk-ts$': '<rootDir>/test/mocks/claude-code-sdk.js',
        '^.*/core/memory/local-embedding(\\.js)?$': '<rootDir>/test/mocks/local-embedding.js',
        '^.*/core/memory/local-embedding-llama(\\.js)?$': '<rootDir>/test/mocks/local-embedding-llama.js',
    },
    extensionsToTreatAsEsm: ['.ts'],
    testPathIgnorePatterns: ['/node_modules/', '/dist/'],
    setupFiles: ['<rootDir>/test/jest.env.js'],
};
