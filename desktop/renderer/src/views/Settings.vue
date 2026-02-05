<template>
  <div class="settings-view">
    <div class="settings-layout card-glass">
      <!-- Sidebar Navigation -->
      <div class="settings-sidebar">
        <div 
          class="nav-item" 
          :class="{ active: activeTab === 'general' }"
          @click="activeTab = 'general'"
        >
          <span class="nav-icon">⚙️</span>
          {{ t('settings.general') }}
        </div>
        <div 
          class="nav-item" 
          :class="{ active: activeTab === 'agent' }"
          @click="activeTab = 'agent'"
        >
          <span class="nav-icon">🤖</span>
          {{ t('settings.agent') }}
        </div>
        <div 
          class="nav-item" 
          :class="{ active: activeTab === 'about' }"
          @click="activeTab = 'about'"
        >
          <span class="nav-icon">ℹ️</span>
          {{ t('settings.about') }}
        </div>
      </div>

      <!-- Main Content Area -->
      <div class="settings-content">
        <!-- General Tab -->
        <div v-show="activeTab === 'general'" class="tab-content">
          <h2 class="tab-title">{{ t('settings.general') }}</h2>
          
          <div class="settings-group">
            <h3>{{ t('settings.language') }}</h3>
            <div class="form-group">
              <label>{{ t('settings.languageDescription') }}</label>
              <select v-model="currentLocale" class="input select-input">
                <option value="zh">简体中文</option>
                <option value="en">English (US)</option>
              </select>
            </div>
          </div>

          <div class="settings-group">
            <h3>{{ t('settings.theme') }}</h3>
            <div class="form-group">
              <label>{{ t('settings.themeDescription') }}</label>
              <div class="theme-options">
                <button 
                  class="theme-card" 
                  :class="{ active: config.theme === 'light' }"
                  @click="setTheme('light')"
                >
                  <div class="theme-preview light"></div>
                  <span>{{ t('settings.light') }}</span>
                </button>
                <button 
                  class="theme-card" 
                  :class="{ active: config.theme === 'dark' }"
                  @click="setTheme('dark')"
                >
                  <div class="theme-preview dark"></div>
                  <span>{{ t('settings.dark') }}</span>
                </button>
                <button 
                  class="theme-card" 
                  :class="{ active: config.theme === 'cosmic' }"
                  @click="setTheme('cosmic')"
                >
                  <div class="theme-preview cosmic"></div>
                  <span>{{ t('settings.cosmic') }}</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- Agent Tab (Merged Configuration) -->
        <div v-show="activeTab === 'agent'" class="tab-content">
          <h2 class="tab-title">{{ t('settings.agentConfig') }}</h2>
          
          <div class="settings-group">
            <h3>{{ t('settings.modelConfig') }}</h3>
            <div class="form-group">
              <label>{{ t('settings.provider') }}</label>
              <select v-model="localConfig.defaultProvider" class="input select-input">
                <option v-for="provider in providers" :key="provider" :value="provider">
                  {{ provider }}
                </option>
              </select>
            </div>
            <div class="form-group">
              <label>{{ t('settings.model') }}</label>
              <input v-model="localConfig.defaultModel" class="input" placeholder="e.g., deepseek-chat" />
            </div>
          </div>

          <div class="settings-group">
            <h3>{{ t('settings.workspace') }}</h3>
            <div class="form-group">
              <label>{{ t('settings.defaultWorkspace') }}</label>
              <input v-model="localConfig.defaultWorkspace" class="input" placeholder="default" />
            </div>
          </div>

          <div class="settings-group">
            <h3>{{ t('settings.gateway') }}</h3>
            <div class="form-group">
              <label>{{ t('settings.gatewayUrl') }}</label>
              <input v-model="localConfig.gatewayUrl" class="input" placeholder="ws://localhost:3000" />
            </div>
          </div>

          <div class="actions">
            <button @click="saveAgentConfig" class="btn-primary">
              {{ t('common.save') }}
            </button>
            <button @click="resetAgentConfig" class="btn-secondary">
              {{ t('common.reset') }}
            </button>
          </div>
        </div>

        <!-- About Tab -->
        <div v-show="activeTab === 'about'" class="tab-content">
          <h2 class="tab-title">{{ t('settings.about') }}</h2>
          
          <div class="about-card">
            <div class="logo-large">
              <img src="@/assets/logo.png" alt="OpenBot" />
            </div>
            <h3>OpenBot Desktop</h3>
            <p class="version">v1.0.0</p>
            
            <div class="about-details">
              <div class="detail-row">
                <span>{{ t('settings.platform') }}:</span>
                <span>{{ platform }}</span>
              </div>
              <div class="detail-row">
                <span>Electron:</span>
                <span>{{ electronVersion }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, computed, onMounted } from 'vue';
import { useSettingsStore } from '@/store/modules/settings';
import { useLocaleStore } from '@/store/modules/locale';
import { useI18n } from '@/composables/useI18n';

export default {
  name: 'Settings',
  setup() {
    const settingsStore = useSettingsStore();
    const localeStore = useLocaleStore();
    const { t } = useI18n();

    const activeTab = ref('general');
    const localConfig = ref({});
    
    const config = computed(() => settingsStore.config);
    const providers = computed(() => settingsStore.providers);
    const platform = window.electronAPI?.platform || 'web';
    // Mock electron version if not available
    const electronVersion = window.process?.versions?.electron || 'Unknown';

    const currentLocale = computed({
      get: () => localeStore.locale,
      set: (v) => localeStore.setLocale(v),
    });

    const setTheme = (theme) => {
      settingsStore.toggleTheme(theme); // Assuming toggleTheme handles sets or just toggles
      // Ideally settingsStore should have setTheme, checking implementation
      if (settingsStore.config.theme !== theme) {
         settingsStore.toggleTheme();
      }
    };

    const loadAgentConfig = () => {
      localConfig.value = { ...settingsStore.config };
    };

    const saveAgentConfig = async () => {
      await settingsStore.updateConfig(localConfig.value);
      // Optional: Add toast notification here
      alert(t('common.saved'));
    };

    const resetAgentConfig = () => {
      loadAgentConfig();
    };

    onMounted(async () => {
      await settingsStore.loadProviders();
      loadAgentConfig();
    });

    return {
      t,
      activeTab,
      config,
      localConfig,
      providers,
      currentLocale,
      platform,
      electronVersion,
      setTheme,
      saveAgentConfig,
      resetAgentConfig,
    };
  },
};
</script>

<style scoped>
.settings-view {
  width: 100%;
  height: 100%;
  padding: var(--spacing-lg);
}

.settings-layout {
  display: flex;
  height: 100%;
  overflow: hidden;
}

/* Sidebar Styling */
.settings-sidebar {
  width: 240px;
  background: var(--color-bg-secondary);
  border-right: 1px solid var(--glass-border);
  padding: var(--spacing-lg) 0;
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xs);
}

.nav-item {
  display: flex;
  align-items: center;
  gap: var(--spacing-md);
  padding: var(--spacing-md) var(--spacing-lg);
  cursor: pointer;
  color: var(--color-text-secondary);
  transition: all var(--transition-fast);
  border-left: 3px solid transparent;
}

.nav-item:hover {
  background: var(--color-bg-tertiary);
  color: var(--color-text-primary);
}

.nav-item.active {
  background: var(--color-bg-elevated);
  color: var(--color-accent-primary);
  border-left-color: var(--color-accent-primary);
  font-weight: 500;
}

.nav-icon {
  font-size: 1.2rem;
}

/* Content Area Styling */
.settings-content {
  flex: 1;
  overflow-y: auto;
  padding: var(--spacing-2xl);
}

.tab-title {
  font-size: var(--font-size-2xl);
  font-weight: 600;
  margin-bottom: var(--spacing-xl);
  color: var(--color-text-primary);
}

.settings-group {
  margin-bottom: var(--spacing-2xl);
}

.settings-group h3 {
  font-size: var(--font-size-lg);
  font-weight: 600;
  margin-bottom: var(--spacing-lg);
  color: var(--color-text-primary);
  padding-bottom: var(--spacing-sm);
  border-bottom: 1px solid var(--glass-border);
}

.form-group {
  margin-bottom: var(--spacing-lg);
}

.form-group label {
  display: block;
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
  margin-bottom: var(--spacing-sm);
}

.input {
  width: 100%;
  max-width: 400px;
  padding: var(--spacing-md);
  background: var(--color-bg-tertiary);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-md);
  color: var(--color-text-primary);
  font-size: var(--font-size-base);
  transition: all var(--transition-fast);
}

.input:focus {
  outline: none;
  border-color: var(--color-accent-primary);
  background: var(--color-bg-primary);
}

.select-input {
  appearance: none;
  background-image: url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3e%3cpolyline points='6 9 12 15 18 9'%3e%3c/polyline%3e%3c/svg%3e");
  background-repeat: no-repeat;
  background-position: right 1rem center;
  background-size: 1em;
}

/* Theme Options */
.theme-options {
  display: flex;
  gap: var(--spacing-lg);
}

.theme-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--spacing-sm);
  padding: var(--spacing-md);
  background: var(--color-bg-tertiary);
  border: 2px solid transparent;
  border-radius: var(--radius-lg);
  cursor: pointer;
  transition: all var(--transition-fast);
}

.theme-card.active {
  border-color: var(--color-accent-primary);
  background: var(--color-bg-elevated);
}

.theme-preview {
  width: 100px;
  height: 60px;
  border-radius: var(--radius-md);
  border: 1px solid var(--glass-border);
}

.theme-preview.light {
  background: #f8fafc;
}

.theme-preview.dark {
  background: #1e293b;
}

.theme-preview.cosmic {
  background: #fdfdfd;
  border: 1px solid #e5e5e5;
}

/* Actions */
.actions {
  display: flex;
  gap: var(--spacing-md);
  margin-top: var(--spacing-xl);
}

.btn-primary, .btn-secondary {
  padding: var(--spacing-md) var(--spacing-xl);
  border-radius: var(--radius-md);
  font-weight: 500;
  cursor: pointer;
  transition: all var(--transition-fast);
}

.btn-primary {
  background: var(--color-accent-primary);
  color: white;
  border: none;
}

.btn-primary:hover {
  background: var(--color-accent-secondary);
}

.btn-secondary {
  background: transparent;
  border: 1px solid var(--glass-border);
  color: var(--color-text-primary);
}

.btn-secondary:hover {
  background: var(--color-bg-tertiary);
}

/* About Section */
.about-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  padding: var(--spacing-2xl);
}

.logo-large {
  width: 80px;
  height: 80px;
  margin-bottom: var(--spacing-lg);
}

.logo-large img {
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.version {
  color: var(--color-text-secondary);
  font-family: var(--font-family-mono);
  margin-bottom: var(--spacing-xl);
}

.about-details {
  width: 100%;
  max-width: 400px;
  background: var(--color-bg-tertiary);
  border-radius: var(--radius-lg);
  padding: var(--spacing-lg);
}

.detail-row {
  display: flex;
  justify-content: space-between;
  padding: var(--spacing-sm) 0;
  border-bottom: 1px solid var(--glass-border);
}

.detail-row:last-child {
  border-bottom: none;
}
</style>
