import { defineStore } from 'pinia';
import { configAPI } from '@/api';

export const useSettingsStore = defineStore('settings', {
    state: () => ({
        config: {
            gatewayUrl: 'ws://localhost:3000',
            defaultProvider: 'deepseek',
            defaultModel: 'deepseek-chat',
            defaultWorkspace: 'default',
            theme: 'dark',
            providers: {},
        },
        providers: [],
        models: {},
    }),

    actions: {
        async loadConfig() {
            try {
                const response = await configAPI.getConfig();
                if (response.data && response.data.data) {
                    this.config = { ...this.config, ...response.data.data };
                }
                this.applyTheme(this.config.theme);
            } catch (error) {
                console.error('Failed to load config:', error);
                // Apply default theme if config load fails
                this.applyTheme(this.config.theme);
            }
        },

        async updateConfig(updates) {
            try {
                const response = await configAPI.updateConfig(updates);
                this.config = response.data.data;
                if (updates.theme) {
                    this.applyTheme(updates.theme);
                }
            } catch (error) {
                console.error('Failed to update config:', error);
            }
        },

        async loadProviders() {
            try {
                const response = await configAPI.getProviders();
                this.providers = response.data.data;
            } catch (error) {
                console.error('Failed to load providers:', error);
            }
        },

        async loadModels(provider) {
            try {
                const response = await configAPI.getModels(provider);
                this.models[provider] = response.data.data;
            } catch (error) {
                console.error('Failed to load models:', error);
            }
        },

        applyTheme(theme) {
            document.documentElement.setAttribute('data-theme', theme);
        },

        toggleTheme() {
            const themes = ['light', 'dark', 'cosmic'];
            const currentTheme = this.config.theme || 'dark';
            const nextIndex = (themes.indexOf(currentTheme) + 1) % themes.length;
            this.updateConfig({ theme: themes[nextIndex] });
        },
    },
});
