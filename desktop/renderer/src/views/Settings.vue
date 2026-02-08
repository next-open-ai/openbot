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
          :class="{ active: activeTab === 'models' }"
          @click="activeTab = 'models'"
        >
          <span class="nav-icon">🧠</span>
          {{ t('settings.modelsNav') }}
        </div>
        <div 
          class="nav-item" 
          :class="{ active: activeTab === 'users' }"
          @click="activeTab = 'users'"
        >
          <span class="nav-icon">👤</span>
          {{ t('settings.users') }}
        </div>
        <div 
          class="nav-item" 
          :class="{ active: activeTab === 'skills' }"
          @click="activeTab = 'skills'"
        >
          <span class="nav-icon">🎯</span>
          {{ t('nav.skills') }}
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
                <button 
                  class="theme-card" 
                  :class="{ active: config.theme === 'neon' }"
                  @click="setTheme('neon')"
                >
                  <div class="theme-preview neon"></div>
                  <span>{{ t('settings.neon') }}</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- Agent Tab (Merged Configuration)：不含模型配置（在「模型配置」Tab）、不含用户密码 -->
        <div v-show="activeTab === 'agent'" class="tab-content">
          <h2 class="tab-title">{{ t('settings.agentConfig') }}</h2>

          <div class="settings-group">
            <h3>{{ t('settings.workspace') }}</h3>
            <div class="form-group">
              <label>{{ t('settings.defaultAgent') }}</label>
              <input v-model="localConfig.defaultAgentId" class="input" placeholder="default" />
            </div>
          </div>

          <div class="settings-group">
            <h3>{{ t('settings.gateway') }}</h3>
            <div class="form-group">
              <label>{{ t('settings.gatewayUrl') }}</label>
              <input v-model="localConfig.gatewayUrl" class="input" placeholder="ws://localhost:3000" />
            </div>
          </div>

          <div class="settings-group">
            <h3>{{ t('settings.sessionsLimit') }}</h3>
            <div class="form-group">
              <label>{{ t('settings.maxAgentSessions') }}</label>
              <input v-model.number="localConfig.maxAgentSessions" type="number" min="1" max="50" class="input" />
              <p class="form-hint">{{ t('settings.maxAgentSessionsHint') }}</p>
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

        <!-- 模型配置 Tab（顶部子 Tab：Provider 配置 / 模型配置） -->
        <div v-show="activeTab === 'models'" class="tab-content">
          <h2 class="tab-title">{{ t('settings.modelsNav') }}</h2>
          <div class="model-config-tabs">
            <button
              class="model-config-tab"
              :class="{ active: modelConfigSubTab === 'provider' }"
              @click="modelConfigSubTab = 'provider'"
            >
              {{ t('settings.providerConfig') }}
            </button>
            <button
              class="model-config-tab"
              :class="{ active: modelConfigSubTab === 'default' }"
              @click="modelConfigSubTab = 'default'; onDefaultProviderChange(config.defaultProvider || localDefaultProvider)"
            >
              {{ t('settings.defaultModelConfig') }}
            </button>
          </div>

          <!-- Provider 配置：新增方式——下拉选 Provider + API Key 保存为一行；已配置列表可编辑 Base URL、删除 -->
          <div v-show="modelConfigSubTab === 'provider'" class="settings-group">
            <p class="form-hint">{{ t('settings.providerConfigHint') }}</p>
            <div class="provider-add-form">
              <h4 class="subsection-title">{{ t('settings.addProviderKey') }}</h4>
              <div class="form-row form-row-flex">
                <div class="form-group flex-1">
                  <label>{{ t('settings.selectProvider') }}</label>
                  <select v-model="addProviderForm.provider" class="input select-input">
                    <option value="">—</option>
                    <option v-for="p in supportedProviders" :key="p" :value="p">{{ p }}</option>
                  </select>
                </div>
                <div class="form-group flex-1">
                  <label>{{ t('settings.apiKey') }}</label>
                  <input
                    v-model="addProviderForm.apiKey"
                    type="password"
                    class="input"
                    :placeholder="t('settings.apiKeyPlaceholder')"
                    autocomplete="off"
                  />
                </div>
                <div class="form-group flex-1">
                  <label>{{ t('settings.baseUrl') }} ({{ t('settings.optional') }})</label>
                  <input
                    v-model="addProviderForm.baseUrl"
                    type="text"
                    class="input"
                    :placeholder="t('settings.baseUrlPlaceholder')"
                  />
                </div>
                <div class="form-group form-group-actions">
                  <label>&nbsp;</label>
                  <button type="button" class="btn-primary" :disabled="!addProviderForm.provider || !addProviderForm.apiKey?.trim()" @click="saveAddProvider">
                    {{ t('common.save') }}
                  </button>
                </div>
              </div>
            </div>
            <div class="provider-configured-list">
              <h4 class="subsection-title">{{ t('settings.configuredProvidersList') }}</h4>
              <p v-if="configuredProviders.length === 0" class="form-hint">{{ t('settings.noConfiguredProviderList') }}</p>
              <div v-else class="provider-cards">
                <div v-for="prov in configuredProviders" :key="prov" class="provider-card">
                  <div class="provider-card-header">
                    <span class="provider-name">{{ prov }}</span>
                    <span class="provider-badge">{{ t('settings.apiKeyConfigured') }}</span>
                    <template v-if="editingProvider !== prov">
                      <button type="button" class="link-btn" @click="startEditProvider(prov)">{{ t('common.edit') }}</button>
                      <button type="button" class="link-btn danger provider-delete" @click="removeProvider(prov)">{{ t('common.delete') }}</button>
                    </template>
                  </div>
                  <template v-if="editingProvider === prov">
                    <div class="form-group">
                      <label>{{ t('settings.apiKey') }}</label>
                      <input
                        v-model="localProviderConfig[prov].apiKey"
                        type="password"
                        class="input"
                        :placeholder="t('settings.apiKeyPlaceholder')"
                        autocomplete="off"
                      />
                    </div>
                    <div class="form-group">
                      <label>{{ t('settings.baseUrl') }} ({{ t('settings.optional') }})</label>
                      <input
                        v-model="localProviderConfig[prov].baseUrl"
                        type="text"
                        class="input"
                        :placeholder="t('settings.baseUrlPlaceholder')"
                      />
                    </div>
                    <div class="provider-card-actions">
                      <button type="button" class="btn-secondary" @click="cancelEditProvider">{{ t('common.cancel') }}</button>
                      <button type="button" class="btn-primary" @click="saveEditProvider">{{ t('common.save') }}</button>
                    </div>
                  </template>
                  <template v-else>
                    <div class="provider-readonly">
                      <p class="provider-readonly-line"><span class="label">{{ t('settings.apiKey') }}:</span> ••••••••</p>
                      <p v-if="localProviderConfig[prov].baseUrl" class="provider-readonly-line"><span class="label">{{ t('settings.baseUrl') }}:</span> {{ localProviderConfig[prov].baseUrl }}</p>
                    </div>
                  </template>
                </div>
              </div>
              <div v-if="configuredProviders.length > 0 && !editingProvider" class="actions">
                <p class="form-hint action-hint">{{ t('settings.editProviderHint') }}</p>
              </div>
            </div>
          </div>

          <!-- 模型配置：仅已配置 Key 的 Provider 可备选，选 Provider 后再选模型，可设默认 -->
          <div v-show="modelConfigSubTab === 'default'" class="settings-group">
            <p class="form-hint">{{ t('settings.defaultModelHint') }}</p>
            <p v-if="configuredProviders.length === 0" class="form-hint form-hint-warn">
              {{ t('settings.noConfiguredProvider') }}
            </p>
            <template v-else>
              <div class="form-group">
                <label>{{ t('settings.defaultProvider') }}</label>
                <select v-model="localDefaultProvider" class="input select-input" @change="onDefaultProviderChange">
                  <option v-for="p in configuredProviders" :key="p" :value="p">{{ p }}</option>
                </select>
              </div>
              <div class="form-group">
                <label>{{ t('settings.defaultModel') }}</label>
                <select v-model="localDefaultModel" class="input select-input">
                  <option v-for="m in (models[localDefaultProvider] || [])" :key="m" :value="m">{{ m }}</option>
                </select>
              </div>
              <p class="form-hint current-default">
                {{ t('settings.currentDefault') }}: <strong>{{ config.defaultProvider || '—' }} / {{ config.defaultModel || '—' }}</strong>
              </p>
              <div class="actions">
                <button type="button" class="btn-primary" @click="setDefaultModel">
                  {{ t('settings.setAsDefaultModel') }}
                </button>
              </div>
            </template>
          </div>
        </div>

        <!-- 用户 Tab -->
        <div v-show="activeTab === 'users'" class="tab-content">
          <h2 class="tab-title">{{ t('settings.users') }}</h2>

          <!-- 修改当前用户密码 -->
          <div v-if="authStore.currentUser" class="settings-group">
            <h3>{{ t('settings.changeCurrentPassword') }}</h3>
            <p class="form-hint">{{ t('settings.changeCurrentPasswordHint') }} <strong>{{ authStore.currentUser.username }}</strong>。{{ t('settings.changeCurrentPasswordHintAfter') }}</p>
            <button type="button" class="btn-secondary" @click="openChangeCurrentUserPassword">{{ t('settings.changeCurrentPassword') }}</button>
          </div>

          <div class="settings-group">
            <h3>{{ t('settings.userList') }}</h3>
            <div class="users-toolbar">
              <p class="form-hint">{{ t('settings.usersHint') }}</p>
              <button type="button" class="btn-primary" @click="openAddUser">{{ t('settings.addUser') }}</button>
            </div>
            <div v-if="usersLoading" class="loading-state">{{ t('common.loading') }}</div>
            <div v-else-if="usersList.length === 0" class="empty-state">
              <p>{{ t('settings.noUsers') }}</p>
              <button type="button" class="btn-primary" @click="openAddUser">{{ t('settings.addUser') }}</button>
            </div>
            <div v-else class="users-table-wrap">
              <table class="users-table">
                <thead>
                  <tr>
                    <th>{{ t('settings.loginUsername') }}</th>
                    <th class="th-actions">{{ t('common.details') }}</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="u in usersList" :key="u.id">
                    <td><span class="username-cell">{{ u.username }}</span></td>
                    <td class="td-actions">
                      <button type="button" class="link-btn" @click="openChangePassword(u)">{{ t('settings.changePassword') }}</button>
                      <span class="sep">|</span>
                      <button type="button" class="link-btn" @click="openEditUser(u)">{{ t('settings.editUser') }}</button>
                      <span class="sep">|</span>
                      <button type="button" class="link-btn danger" @click="confirmDeleteUser(u)">{{ t('common.delete') }}</button>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <!-- Skills Tab -->
        <div v-show="activeTab === 'skills'" class="tab-content">
          <SettingsSkills />
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

    <!-- 新增用户弹窗 -->
    <transition name="fade">
      <div v-if="showAddUserModal" class="modal-backdrop" @click.self="showAddUserModal = false">
        <div class="modal-content card-glass">
          <div class="modal-header">
            <h2>{{ t('settings.addUser') }}</h2>
            <button type="button" class="close-btn" @click="showAddUserModal = false">✕</button>
          </div>
          <div class="modal-body">
            <div class="form-group">
              <label>{{ t('settings.loginUsername') }}</label>
              <input v-model="addUserForm.username" type="text" class="input" :placeholder="t('settings.loginUsernamePlaceholder')" />
            </div>
            <div class="form-group">
              <label>{{ t('settings.loginPassword') }}</label>
              <input v-model="addUserForm.password" type="password" class="input" :placeholder="t('settings.loginPasswordPlaceholder')" autocomplete="new-password" />
            </div>
            <p v-if="userFormError" class="form-error">{{ userFormError }}</p>
            <div class="modal-footer-actions">
              <button type="button" class="btn-secondary" @click="showAddUserModal = false">{{ t('common.close') }}</button>
              <button type="button" class="btn-primary" :disabled="userFormSaving" @click="submitAddUser">{{ userFormSaving ? t('common.loading') : t('common.save') }}</button>
            </div>
          </div>
        </div>
      </div>
    </transition>

    <!-- 编辑用户弹窗 -->
    <transition name="fade">
      <div v-if="showEditUserModal" class="modal-backdrop" @click.self="showEditUserModal = false">
        <div class="modal-content card-glass">
          <div class="modal-header">
            <h2>{{ t('settings.editUser') }}</h2>
            <button type="button" class="close-btn" @click="showEditUserModal = false">✕</button>
          </div>
          <div class="modal-body">
            <div class="form-group">
              <label>{{ t('settings.loginUsername') }}</label>
              <input v-model="editUserForm.username" type="text" class="input" />
            </div>
            <div class="form-group">
              <label>{{ t('settings.newPasswordOptional') }}</label>
              <input v-model="editUserForm.password" type="password" class="input" :placeholder="t('settings.newPasswordPlaceholder')" autocomplete="new-password" />
            </div>
            <p v-if="userFormError" class="form-error">{{ userFormError }}</p>
            <div class="modal-footer-actions">
              <button type="button" class="btn-secondary" @click="showEditUserModal = false">{{ t('common.close') }}</button>
              <button type="button" class="btn-primary" :disabled="userFormSaving" @click="submitEditUser">{{ userFormSaving ? t('common.loading') : t('common.save') }}</button>
            </div>
          </div>
        </div>
      </div>
    </transition>

    <!-- 修改密码弹窗 -->
    <transition name="fade">
      <div v-if="showChangePasswordModal" class="modal-backdrop" @click.self="showChangePasswordModal = false">
        <div class="modal-content card-glass">
          <div class="modal-header">
            <h2>{{ t('settings.changePassword') }}: {{ changePasswordUser?.username }}</h2>
            <button type="button" class="close-btn" @click="showChangePasswordModal = false">✕</button>
          </div>
          <div class="modal-body">
            <div class="form-group">
              <label>{{ t('settings.newPassword') }}</label>
              <input v-model="changePasswordForm.password" type="password" class="input" autocomplete="new-password" />
            </div>
            <p v-if="userFormError" class="form-error">{{ userFormError }}</p>
            <div class="modal-footer-actions">
              <button type="button" class="btn-secondary" @click="showChangePasswordModal = false">{{ t('common.close') }}</button>
              <button type="button" class="btn-primary" :disabled="userFormSaving" @click="submitChangePassword">{{ userFormSaving ? t('common.loading') : t('common.save') }}</button>
            </div>
          </div>
        </div>
      </div>
    </transition>

    <!-- 修改当前用户密码弹窗 -->
    <transition name="fade">
      <div v-if="showChangeCurrentPasswordModal" class="modal-backdrop" @click.self="showChangeCurrentPasswordModal = false">
        <div class="modal-content card-glass">
          <div class="modal-header">
            <h2>{{ t('settings.changeCurrentPassword') }}</h2>
            <button type="button" class="close-btn" @click="showChangeCurrentPasswordModal = false">✕</button>
          </div>
          <div class="modal-body">
            <div class="form-group">
              <label>{{ t('settings.newPassword') }}</label>
              <input v-model="currentUserPasswordForm.password" type="password" class="input" :placeholder="t('settings.newPassword')" autocomplete="new-password" />
            </div>
            <div class="form-group">
              <label>{{ t('settings.confirmNewPassword') }}</label>
              <input v-model="currentUserPasswordForm.confirm" type="password" class="input" :placeholder="t('settings.confirmNewPassword')" autocomplete="new-password" />
            </div>
            <p v-if="userFormError" class="form-error">{{ userFormError }}</p>
            <div class="modal-footer-actions">
              <button type="button" class="btn-secondary" @click="showChangeCurrentPasswordModal = false">{{ t('common.close') }}</button>
              <button type="button" class="btn-primary" :disabled="userFormSaving" @click="submitChangeCurrentUserPassword">{{ userFormSaving ? t('common.loading') : t('common.save') }}</button>
            </div>
          </div>
        </div>
      </div>
    </transition>

    <!-- 删除用户确认 -->
    <transition name="fade">
      <div v-if="deleteUserTarget" class="modal-backdrop" @click.self="deleteUserTarget = null">
        <div class="modal-content card-glass delete-confirm-modal">
          <div class="modal-header">
            <h2>{{ t('common.delete') }}</h2>
            <button type="button" class="close-btn" @click="deleteUserTarget = null">✕</button>
          </div>
          <div class="modal-body">
            <p>{{ t('settings.deleteUserConfirm') }}</p>
            <p class="delete-target-name">{{ deleteUserTarget?.username }}</p>
            <div class="modal-footer-actions">
              <button type="button" class="btn-secondary" @click="deleteUserTarget = null">{{ t('common.close') }}</button>
              <button type="button" class="btn-danger" :disabled="userFormSaving" @click="submitDeleteUser">{{ userFormSaving ? t('common.loading') : t('common.delete') }}</button>
            </div>
          </div>
        </div>
      </div>
    </transition>
  </div>
</template>

<script>
import { ref, computed, onMounted, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useSettingsStore } from '@/store/modules/settings';
import { useLocaleStore } from '@/store/modules/locale';
import { useAuthStore } from '@/store/modules/auth';
import { useI18n } from '@/composables/useI18n';
import { usersAPI } from '@/api';
import SettingsSkills from '@/components/SettingsSkills.vue';

const SETTINGS_TABS = ['general', 'agent', 'models', 'users', 'skills', 'about'];

export default {
  name: 'Settings',
  components: { SettingsSkills },
  setup() {
    const route = useRoute();
    const router = useRouter();
    const settingsStore = useSettingsStore();
    const localeStore = useLocaleStore();
    const authStore = useAuthStore();
    const { t } = useI18n();

    const tabFromQuery = () => {
      const q = route.query?.tab;
      return SETTINGS_TABS.includes(q) ? q : 'general';
    };
    const activeTab = ref(tabFromQuery());

    watch(() => route.query?.tab, (q) => {
      if (SETTINGS_TABS.includes(q)) activeTab.value = q;
    });
    watch(activeTab, (tab) => {
      if (route.query?.tab !== tab) {
        router.replace({ path: '/settings', query: { ...route.query, tab } });
      }
      if (tab === 'users') loadUsers();
      if (tab === 'models') initModelConfigTab();
    });
    const localConfig = ref({});
    const modelConfigSubTab = ref('provider');
    const localProviderConfig = ref({});
    const localDefaultProvider = ref('');
    const localDefaultModel = ref('');
    const addProviderForm = ref({ provider: '', apiKey: '', baseUrl: '' });
    const editingProvider = ref(null);

    const usersList = ref([]);
    const usersLoading = ref(false);
    const showAddUserModal = ref(false);
    const showEditUserModal = ref(false);
    const showChangePasswordModal = ref(false);
    const addUserForm = ref({ username: '', password: '' });
    const editUserForm = ref({ id: '', username: '', password: '' });
    const changePasswordUser = ref(null);
    const changePasswordForm = ref({ password: '' });
    const deleteUserTarget = ref(null);
    const userFormError = ref('');
    const userFormSaving = ref(false);
    const showChangeCurrentPasswordModal = ref(false);
    const currentUserPasswordForm = ref({ password: '', confirm: '' });
    
    const config = computed(() => settingsStore.config);
    const providers = computed(() => settingsStore.providers || []);
    const models = computed(() => settingsStore.models || {});
    const supportedProviders = computed(() => Array.isArray(providers.value) ? providers.value : []);
    const configuredProviders = computed(() => {
      const cfg = localProviderConfig.value;
      if (!cfg || typeof cfg !== 'object') return [];
      return Object.keys(cfg).filter((p) => {
        const entry = cfg[p];
        return entry && typeof entry.apiKey === 'string' && entry.apiKey.trim() !== '';
      });
    });
    const platform = window.electronAPI?.platform || 'web';
    // Mock electron version if not available
    const electronVersion = window.process?.versions?.electron || 'Unknown';

    const currentLocale = computed({
      get: () => localeStore.locale,
      set: (v) => localeStore.setLocale(v),
    });

    const setTheme = (theme) => {
      settingsStore.setTheme(theme);
    };

    const loadAgentConfig = () => {
      try {
        const cfg = settingsStore.config || {};
        const effectiveAgentId = cfg.defaultAgentId ?? 'default';
        localConfig.value = { ...cfg, defaultAgentId: effectiveAgentId, loginPassword: '' };
      } catch (err) {
        console.warn('[Settings] loadAgentConfig error', err);
        localConfig.value = { loginPassword: '' };
      }
    };

    const saveAgentConfig = async () => {
      const payload = { ...localConfig.value };
      if (payload.loginPassword === '') delete payload.loginPassword;
      const agentId = payload.defaultAgentId ?? 'default';
      await settingsStore.updateConfig({ ...payload, defaultAgentId: agentId });
      localConfig.value = { ...settingsStore.config, defaultAgentId: settingsStore.config?.defaultAgentId ?? 'default', loginPassword: '' };
      alert(t('common.saved'));
    };

    const logout = () => {
      authStore.logout();
    };

    const resetAgentConfig = () => {
      loadAgentConfig();
    };

    function initModelConfigTab() {
      try {
        const cfg = config.value || {};
        const prov = cfg.providers && typeof cfg.providers === 'object' ? cfg.providers : {};
        const next = {};
        for (const [p, entry] of Object.entries(prov)) {
          if (p && typeof p === 'string') {
            next[p] = {
              apiKey: entry && typeof entry.apiKey === 'string' ? entry.apiKey : '',
              baseUrl: entry && typeof entry.baseUrl === 'string' ? entry.baseUrl : '',
            };
          }
        }
        localProviderConfig.value = next;
        const defProv = cfg.defaultProvider && typeof cfg.defaultProvider === 'string' ? cfg.defaultProvider : 'deepseek';
        const defModel = cfg.defaultModel && typeof cfg.defaultModel === 'string' ? cfg.defaultModel : 'deepseek-chat';
        const configured = Object.keys(next).filter((k) => (next[k].apiKey || '').trim() !== '');
        localDefaultProvider.value = configured.includes(defProv) ? defProv : (configured[0] || 'deepseek');
        localDefaultModel.value = defModel;
        ensureModelsLoaded(localDefaultProvider.value).catch((err) => console.warn('[Settings] ensureModelsLoaded', err));
      } catch (err) {
        console.error('[Settings] initModelConfigTab error', err);
        localProviderConfig.value = {};
        localDefaultProvider.value = 'deepseek';
        localDefaultModel.value = 'deepseek-chat';
      }
    }

    async function ensureModelsLoaded(provider) {
      if (!provider || typeof provider !== 'string') return;
      if (settingsStore.models && settingsStore.models[provider]) return;
      try {
        await settingsStore.loadModels(provider);
      } catch (err) {
        console.warn('[Settings] loadModels failed', provider, err);
      }
    }

    function onDefaultProviderChange(provider) {
      ensureModelsLoaded(provider).catch(() => {});
    }

    async function saveProviderConfig() {
      const payload = { providers: { ...localProviderConfig.value } };
      await settingsStore.updateConfig(payload);
      alert(t('common.saved'));
    }

    function saveAddProvider() {
      const { provider, apiKey, baseUrl } = addProviderForm.value;
      if (!provider || !(apiKey && apiKey.trim())) return;
      localProviderConfig.value = {
        ...localProviderConfig.value,
        [provider]: {
          apiKey: apiKey.trim(),
          baseUrl: (baseUrl || '').trim(),
        },
      };
      saveProviderConfig().then(() => {
        addProviderForm.value.apiKey = '';
        addProviderForm.value.baseUrl = '';
      }).catch(() => {});
    }

    function removeProvider(prov) {
      if (!prov) return;
      if (editingProvider.value === prov) editingProvider.value = null;
      const next = { ...localProviderConfig.value };
      delete next[prov];
      localProviderConfig.value = next;
      saveProviderConfig().catch(() => {});
    }

    function startEditProvider(prov) {
      editingProvider.value = prov;
    }

    function cancelEditProvider() {
      const prov = editingProvider.value;
      if (!prov) return;
      const fromConfig = config.value?.providers?.[prov];
      if (fromConfig) {
        localProviderConfig.value = {
          ...localProviderConfig.value,
          [prov]: {
            apiKey: fromConfig.apiKey ?? '',
            baseUrl: fromConfig.baseUrl ?? '',
          },
        };
      }
      editingProvider.value = null;
    }

    async function saveEditProvider() {
      await saveProviderConfig();
      editingProvider.value = null;
    }

    async function setDefaultModel() {
      const prov = localDefaultProvider.value;
      const model = localDefaultModel.value;
      if (!configuredProviders.value.includes(prov)) {
        alert(t('settings.noConfiguredProvider'));
        return;
      }
      await settingsStore.updateConfig({
        defaultProvider: prov,
        defaultModel: model,
      });
      alert(t('common.saved'));
    }

    async function loadUsers() {
      usersLoading.value = true;
      userFormError.value = '';
      try {
        const res = await usersAPI.list();
        usersList.value = res.data?.data ?? [];
      } catch (e) {
        usersList.value = [];
      } finally {
        usersLoading.value = false;
      }
    }

    function openAddUser() {
      addUserForm.value = { username: '', password: '' };
      userFormError.value = '';
      showAddUserModal.value = true;
    }

    function openEditUser(u) {
      editUserForm.value = { id: u.id, username: u.username, password: '' };
      userFormError.value = '';
      showEditUserModal.value = true;
    }

    function openChangePassword(u) {
      changePasswordUser.value = u;
      changePasswordForm.value = { password: '' };
      userFormError.value = '';
      showChangePasswordModal.value = true;
    }

    function confirmDeleteUser(u) {
      deleteUserTarget.value = u;
      userFormError.value = '';
    }

    function openChangeCurrentUserPassword() {
      currentUserPasswordForm.value = { password: '', confirm: '' };
      userFormError.value = '';
      showChangeCurrentPasswordModal.value = true;
    }

    async function submitChangeCurrentUserPassword() {
      const pwd = (currentUserPasswordForm.value.password || '').trim();
      const confirmPwd = (currentUserPasswordForm.value.confirm || '').trim();
      if (!pwd) {
        userFormError.value = t('settings.passwordRequired');
        return;
      }
      if (pwd !== confirmPwd) {
        userFormError.value = t('settings.passwordMismatch');
        return;
      }
      const cur = authStore.currentUser;
      if (!cur) return;
      userFormSaving.value = true;
      userFormError.value = '';
      try {
        await usersAPI.update(cur.id, { password: pwd });
        showChangeCurrentPasswordModal.value = false;
        currentUserPasswordForm.value = { password: '', confirm: '' };
      } catch (e) {
        userFormError.value = e.response?.data?.message ?? e.message ?? t('login.invalidCredentials');
      } finally {
        userFormSaving.value = false;
      }
    }

    async function submitAddUser() {
      const username = (addUserForm.value.username || '').trim();
      const password = (addUserForm.value.password || '').trim();
      if (!username) {
        userFormError.value = t('settings.usernameRequired');
        return;
      }
      if (!password) {
        userFormError.value = t('settings.passwordRequired');
        return;
      }
      userFormSaving.value = true;
      userFormError.value = '';
      try {
        await usersAPI.create(username, password);
        showAddUserModal.value = false;
        await loadUsers();
      } catch (e) {
        userFormError.value = e.response?.data?.message ?? e.message ?? t('login.invalidCredentials');
      } finally {
        userFormSaving.value = false;
      }
    }

    async function submitEditUser() {
      const username = (editUserForm.value.username || '').trim();
      if (!username) {
        userFormError.value = t('settings.usernameRequired');
        return;
      }
      userFormSaving.value = true;
      userFormError.value = '';
      try {
        const updates = { username };
        if (editUserForm.value.password.trim()) updates.password = editUserForm.value.password.trim();
        await usersAPI.update(editUserForm.value.id, updates);
        showEditUserModal.value = false;
        await loadUsers();
      } catch (e) {
        userFormError.value = e.response?.data?.message ?? e.message ?? t('login.invalidCredentials');
      } finally {
        userFormSaving.value = false;
      }
    }

    async function submitChangePassword() {
      const password = (changePasswordForm.value.password || '').trim();
      if (!password) {
        userFormError.value = t('settings.passwordRequired');
        return;
      }
      userFormSaving.value = true;
      userFormError.value = '';
      try {
        await usersAPI.update(changePasswordUser.value.id, { password });
        showChangePasswordModal.value = false;
        changePasswordUser.value = null;
      } catch (e) {
        userFormError.value = e.response?.data?.message ?? e.message ?? t('login.invalidCredentials');
      } finally {
        userFormSaving.value = false;
      }
    }

    async function submitDeleteUser() {
      if (!deleteUserTarget.value) return;
      userFormSaving.value = true;
      userFormError.value = '';
      try {
        await usersAPI.delete(deleteUserTarget.value.id);
        deleteUserTarget.value = null;
        await loadUsers();
      } catch (e) {
        userFormError.value = e.response?.data?.message ?? e.message ?? t('login.invalidCredentials');
      } finally {
        userFormSaving.value = false;
      }
    }

    onMounted(async () => {
      try {
        activeTab.value = tabFromQuery();
        await settingsStore.loadProviders();
        loadAgentConfig();
        initModelConfigTab();
      } catch (err) {
        console.error('[Settings] onMounted error', err);
      }
    });

    return {
      t,
      activeTab,
      config,
      localConfig,
      providers,
      models,
      modelConfigSubTab,
      localProviderConfig,
      localDefaultProvider,
      localDefaultModel,
      addProviderForm,
      supportedProviders,
      configuredProviders,
      saveAddProvider,
      removeProvider,
      editingProvider,
      startEditProvider,
      cancelEditProvider,
      saveEditProvider,
      ensureModelsLoaded,
      onDefaultProviderChange,
      saveProviderConfig,
      setDefaultModel,
      currentLocale,
      platform,
      electronVersion,
      setTheme,
      saveAgentConfig,
      resetAgentConfig,
      logout,
      authStore,
      usersList,
      usersLoading,
      showAddUserModal,
      showEditUserModal,
      showChangePasswordModal,
      showChangeCurrentPasswordModal,
      addUserForm,
      editUserForm,
      changePasswordUser,
      changePasswordForm,
      currentUserPasswordForm,
      deleteUserTarget,
      userFormError,
      userFormSaving,
      openAddUser,
      openEditUser,
      openChangePassword,
      openChangeCurrentUserPassword,
      confirmDeleteUser,
      submitAddUser,
      submitEditUser,
      submitChangePassword,
      submitChangeCurrentUserPassword,
      submitDeleteUser,
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
  padding: var(--spacing-md) var(--spacing-sm);
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.nav-item {
  position: relative;
  display: flex;
  align-items: center;
  gap: var(--spacing-md);
  padding: 12px 14px;
  margin: 0 2px;
  cursor: pointer;
  color: var(--color-text-secondary);
  font-size: 0.9375rem;
  border-radius: 10px;
  transition: background-color var(--transition-base), color var(--transition-base), transform var(--transition-fast);
}

.nav-item:hover {
  background: var(--color-bg-tertiary);
  color: var(--color-text-primary);
}

.nav-item.active {
  background: var(--color-bg-elevated);
  color: var(--color-accent-primary);
  font-weight: 600;
  box-shadow: var(--shadow-sm);
}

.nav-item.active::before {
  content: '';
  position: absolute;
  left: 0;
  top: 50%;
  transform: translateY(-50%);
  width: 3px;
  height: 20px;
  border-radius: 0 3px 3px 0;
  background: var(--color-accent-primary);
}

.nav-item:hover.active {
  background: var(--color-bg-elevated);
}

.nav-icon {
  font-size: 1.2rem;
  opacity: 0.9;
}

.nav-item.active .nav-icon {
  opacity: 1;
}

/* Content Area Styling */
.settings-content {
  flex: 1;
  overflow-y: auto;
  padding: var(--spacing-2xl);
}

.tab-title {
  font-size: var(--font-size-2xl);
  font-weight: 700;
  margin-bottom: var(--spacing-xl);
  color: var(--color-text-primary);
  letter-spacing: -0.02em;
}

/* 模型配置：子 Tab 与内容区文字层级 */
.model-config-tabs {
  display: flex;
  gap: 2px;
  margin-bottom: var(--spacing-xl);
  border-bottom: 1px solid var(--glass-border);
}
.model-config-tab {
  padding: 12px 20px;
  font-size: var(--font-size-base);
  font-weight: 500;
  color: var(--color-text-tertiary);
  background: none;
  border: none;
  border-bottom: 3px solid transparent;
  margin-bottom: -1px;
  cursor: pointer;
  transition: color 0.2s ease, border-color 0.2s ease;
}
.model-config-tab:hover {
  color: var(--color-text-secondary);
}
.model-config-tab.active {
  color: var(--color-accent-primary);
  font-weight: 600;
  border-bottom-color: var(--color-accent-primary);
}
.model-config-tabs + .settings-group .form-hint {
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
  line-height: 1.5;
  margin-bottom: var(--spacing-md);
}
.provider-add-form {
  margin-bottom: var(--spacing-xl);
}
.provider-add-form .subsection-title,
.provider-configured-list .subsection-title {
  font-size: var(--font-size-lg);
  font-weight: 600;
  color: var(--color-text-primary);
  margin: 0 0 var(--spacing-sm);
  letter-spacing: -0.01em;
}
.model-config-tabs ~ .settings-group .form-group label {
  font-size: var(--font-size-sm);
  font-weight: 500;
  color: var(--color-text-primary);
  margin-bottom: var(--spacing-xs);
}
.form-row-flex {
  display: flex;
  flex-wrap: wrap;
  gap: var(--spacing-md);
  align-items: flex-end;
}
.form-row-flex .flex-1 {
  flex: 1;
  min-width: 140px;
}
.form-group-actions {
  margin-bottom: 0;
}
.provider-configured-list {
  margin-top: var(--spacing-xl);
}
.provider-cards {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
}
.provider-card {
  padding: var(--spacing-lg);
  background: var(--color-bg-secondary);
  border-radius: 12px;
  border: 1px solid var(--glass-border);
}
.provider-card-header {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  margin-bottom: var(--spacing-md);
  flex-wrap: wrap;
}
.provider-name {
  font-size: var(--font-size-base);
  font-weight: 600;
  color: var(--color-text-primary);
  margin: 0;
}
.provider-badge {
  font-size: 0.8125rem;
  font-weight: 500;
  color: var(--color-text-secondary);
  background: var(--color-bg-tertiary);
  padding: 4px 10px;
  border-radius: var(--radius-sm);
}
.provider-delete {
  margin-left: auto;
}
.provider-readonly {
  margin: 0;
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
  line-height: 1.5;
}
.provider-readonly-line {
  margin: 0 0 var(--spacing-xs);
}
.provider-readonly-line .label {
  font-weight: 500;
  color: var(--color-text-primary);
  margin-right: var(--spacing-sm);
}
.provider-card-actions {
  display: flex;
  gap: var(--spacing-md);
  margin-top: var(--spacing-md);
}
.current-default {
  margin-top: var(--spacing-sm);
  margin-bottom: var(--spacing-md);
}
.form-hint-warn {
  font-size: var(--font-size-sm);
  color: var(--color-warning, #b8860b);
  font-weight: 500;
}
.actions .action-hint.form-hint {
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
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

.form-hint {
  font-size: var(--font-size-xs);
  color: var(--color-text-secondary);
  margin-top: var(--spacing-xs);
  margin-bottom: 0;
}
.settings-group .form-hint:first-child {
  margin-top: 0;
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
.input::placeholder {
  color: var(--color-text-tertiary);
  opacity: 1;
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
  background: linear-gradient(145deg, #fefcf9 0%, #f5efe6 100%);
  border: 1px solid rgba(180, 168, 152, 0.3);
}

.theme-preview.dark {
  background: #1e293b;
}

.theme-preview.cosmic {
  background: #fdfdfd;
  border: 1px solid #e5e5e5;
}

.theme-preview.neon {
  background: linear-gradient(145deg, #1a0b2e 0%, #2d1b4e 50%, #0d0221 100%);
  border: 1px solid rgba(5, 217, 232, 0.4);
  box-shadow: inset 0 0 20px rgba(5, 217, 232, 0.1), 0 0 12px rgba(255, 42, 109, 0.15);
}

/* Actions */
.actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--spacing-md);
  margin-top: var(--spacing-xl);
}
.actions .action-hint {
  width: 100%;
  margin-bottom: 0;
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

/* 用户管理 */
.users-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: var(--spacing-md);
  margin-bottom: var(--spacing-lg);
}

.users-toolbar .form-hint {
  flex: 1;
  min-width: 200px;
  margin: 0;
}

.users-table-wrap {
  overflow-x: auto;
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-lg);
  background: var(--color-bg-secondary);
}

.users-table {
  width: 100%;
  border-collapse: collapse;
}

.users-table th,
.users-table td {
  padding: var(--spacing-md) var(--spacing-lg);
  text-align: left;
  border-bottom: 1px solid var(--glass-border);
}

.users-table th {
  font-weight: 600;
  color: var(--color-text-secondary);
  font-size: var(--font-size-sm);
}

.users-table tbody tr:last-child td {
  border-bottom: none;
}

.users-table tbody tr:hover {
  background: var(--color-bg-tertiary);
}

.th-actions,
.td-actions {
  width: 1%;
  white-space: nowrap;
}

.username-cell {
  font-weight: 500;
  color: var(--color-text-primary);
}

.link-btn {
  background: none;
  border: none;
  padding: 0;
  color: var(--color-accent-primary);
  cursor: pointer;
  font-size: var(--font-size-sm);
}

.link-btn:hover {
  text-decoration: underline;
}

.link-btn.danger {
  color: var(--color-error, #e53e3e);
}

.sep {
  color: var(--color-text-tertiary);
  margin: 0 var(--spacing-xs);
}

.loading-state,
.empty-state {
  padding: var(--spacing-2xl);
  text-align: center;
  color: var(--color-text-secondary);
}

.empty-state .btn-primary {
  margin-top: var(--spacing-md);
}

/* 弹窗 */
.modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: var(--spacing-lg);
}

.modal-content {
  background: var(--color-bg-primary);
  border-radius: var(--radius-xl);
  border: 1px solid var(--glass-border);
  max-width: 440px;
  width: 100%;
  max-height: 90vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.modal-content.delete-confirm-modal {
  max-width: 400px;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--spacing-lg);
  border-bottom: 1px solid var(--glass-border);
}

.modal-header h2 {
  margin: 0;
  font-size: var(--font-size-xl);
  color: var(--color-text-primary);
}

.close-btn {
  background: none;
  border: none;
  font-size: 1.25rem;
  color: var(--color-text-secondary);
  cursor: pointer;
  padding: var(--spacing-xs);
}

.close-btn:hover {
  color: var(--color-text-primary);
}

.modal-body {
  padding: var(--spacing-lg);
  overflow-y: auto;
}

.form-error {
  color: var(--color-error, #e53e3e);
  font-size: var(--font-size-sm);
  margin: 0 0 var(--spacing-md) 0;
}

.modal-footer-actions {
  display: flex;
  justify-content: flex-end;
  gap: var(--spacing-md);
  margin-top: var(--spacing-xl);
}

.delete-target-name {
  font-weight: 600;
  color: var(--color-text-primary);
  margin-top: var(--spacing-sm);
}

.btn-danger {
  padding: var(--spacing-sm) var(--spacing-lg);
  background: var(--color-error, #e53e3e);
  color: white;
  border: none;
  border-radius: var(--radius-md);
  font-weight: 500;
  cursor: pointer;
}

.btn-danger:hover:not(:disabled) {
  filter: brightness(1.1);
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
