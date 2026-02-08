<template>
  <div class="agent-detail-view">
    <div v-if="loading && !agent" class="loading-state full">
      <div class="spinner"></div>
      <p>{{ t('common.loading') }}</p>
    </div>
    <div v-else-if="!agent" class="empty-state full">
      <p>{{ t('agents.notFound') }}</p>
      <router-link to="/agents" class="btn-primary">{{ t('agents.backToList') }}</router-link>
    </div>
    <template v-else>
      <div class="detail-header card-glass">
        <router-link to="/agents" class="back-link">← {{ t('agents.backToList') }}</router-link>
        <h1 class="view-title">{{ agent.name }}</h1>
        <p class="text-secondary">
          {{ t('agents.workspace') }}: <code>{{ agent.workspace }}</code>
        </p>
      </div>

      <div class="detail-layout">
        <div class="detail-tabs card-glass">
          <button
            v-for="tab in tabs"
            :key="tab.id"
            class="tab-btn"
            :class="{ active: activeTab === tab.id }"
            @click="activeTab = tab.id"
          >
            <span class="tab-icon">{{ tab.icon }}</span>
            <span class="tab-label">{{ tab.label }}</span>
          </button>
        </div>

        <div class="detail-content">
          <!-- 基本配置 -->
          <div v-show="activeTab === 'config'" class="tab-panel config-panel">
            <h2 class="panel-title">{{ t('agents.basicConfig') }}</h2>
            <div class="form-group">
              <label>{{ t('agents.displayName') }}</label>
              <input
                v-model="configForm.name"
                type="text"
                class="form-input"
                :class="{ readonly: agent.isDefault }"
                :placeholder="agent.workspace"
                :readonly="agent.isDefault"
                :disabled="agent.isDefault"
              />
              <p v-if="agent.isDefault" class="form-hint">{{ t('agents.nameReadonly') }}</p>
            </div>
            <div class="form-group">
              <label>{{ t('agents.workspaceName') }}</label>
              <input
                :value="agent.workspace"
                type="text"
                class="form-input readonly"
                readonly
                disabled
              />
              <p class="form-hint">{{ t('agents.workspaceReadonly') }}</p>
            </div>
            <div class="form-group">
              <label>{{ t('settings.provider') }} (LLM)</label>
              <select v-model="configForm.provider" class="form-input">
                <option value="">—</option>
                <option v-for="p in providers" :key="p" :value="p">{{ p }}</option>
              </select>
            </div>
            <div class="form-group">
              <label>{{ t('settings.model') }}</label>
              <select v-model="configForm.model" class="form-input">
                <option value="">—</option>
                <option v-for="m in modelOptions" :key="m" :value="m">{{ m }}</option>
              </select>
            </div>
            <button class="btn-primary" :disabled="configSaving" @click="saveConfig">
              {{ configSaving ? t('common.loading') : t('agents.saveConfig') }}
            </button>
          </div>

          <!-- Skills 配置：仅当前智能体的 skills，支持删除 -->
          <div v-show="activeTab === 'skills'" class="tab-panel skills-panel">
            <div class="panel-header">
              <h2 class="panel-title">{{ t('agents.skillsConfig') }}</h2>
              <div class="panel-header-buttons">
                <button class="btn-secondary" @click="openSmartInstallModal">
                  {{ t('agents.installSmart') }}
                </button>
                <button class="btn-primary" @click="openManualInstallModal">
                  {{ t('agents.installManual') }}
                </button>
              </div>
            </div>
            <div v-if="skillsLoading" class="loading-state">
              <div class="spinner"></div>
              <p>{{ t('common.loading') }}</p>
            </div>
            <div v-else-if="agentSkills.length === 0" class="empty-state">
              <div class="empty-icon">🎯</div>
              <p>{{ t('skills.noSkills') }}</p>
              <div class="empty-actions">
                <button class="btn-secondary" @click="openSmartInstallModal">{{ t('agents.installSmart') }}</button>
                <button class="btn-primary" @click="openManualInstallModal">{{ t('agents.installManual') }}</button>
              </div>
            </div>
            <div v-else class="skills-grid">
              <div
                v-for="skill in agentSkills"
                :key="skill.name"
                class="skill-card card-glass"
                @click="openSkillDetail(skill)"
              >
                <span class="skill-card-icon">🎯</span>
                <span class="skill-card-name">{{ skill.name }}</span>
                <p class="skill-card-desc">{{ skill.description }}</p>
                <button
                  v-if="canDeleteWorkspaceSkill"
                  type="button"
                  class="link-btn danger skill-delete"
                  @click.stop="confirmDeleteSkill(skill)"
                >
                  {{ t('common.delete') }}
                </button>
              </div>
            </div>
          </div>

          </div>
      </div>

      <!-- 智能安装：复用 SmartInstallDialog，传当前智能体 id 安装到其工作区 -->
      <SmartInstallDialog
        v-if="showSmartInstallModal"
        :target-agent-id="agent?.id ?? 'default'"
        session-id="skill-install"
        @close="closeSmartInstallModal"
        @installed="loadSkills"
      />

      <!-- 手工新增 Skill 弹窗 -->
      <transition name="fade">
        <div v-if="showManualInstallModal" class="modal-backdrop" @click.self="showManualInstallModal = false">
          <div class="modal-content card-glass add-skill-modal">
            <div class="modal-header">
              <h2>{{ t('agents.installManual') }}</h2>
              <button type="button" class="close-btn" @click="showManualInstallModal = false">✕</button>
            </div>
            <div class="modal-body">
              <p class="form-hint">{{ t('agents.installManualHint') }}</p>
              <div class="form-group">
                <label>{{ t('agents.skillGitUrl') }}</label>
                <input
                  v-model="manualInstallUrl"
                  type="text"
                  class="form-input"
                  :placeholder="t('agents.skillGitUrlPlaceholder')"
                />
              </div>
              <p v-if="installError" class="form-error">{{ installError }}</p>
              <div class="modal-footer-actions">
                <button type="button" class="btn-secondary" @click="showManualInstallModal = false">{{ t('common.close') }}</button>
                <button type="button" class="btn-primary" :disabled="installManualSaving" @click="doManualInstall">
                  {{ installManualSaving ? t('common.loading') : t('agents.installConfirm') }}
                </button>
              </div>
            </div>
          </div>
        </div>
      </transition>

      <!-- Skill 详情弹窗 -->
      <transition name="fade">
        <div v-if="selectedSkill" class="modal-backdrop" @click.self="selectedSkill = null">
          <div class="modal-content card-glass skill-detail-modal">
            <div class="modal-header">
              <h2>{{ selectedSkill.name }}</h2>
              <button type="button" class="close-btn" @click="selectedSkill = null">✕</button>
            </div>
            <div class="modal-body">
              <div v-if="skillDetailContent" class="skill-documentation markdown-body" v-html="renderedSkillContent"></div>
              <div v-else class="no-content">{{ t('skills.noDocumentation') }}</div>
            </div>
          </div>
        </div>
      </transition>

      <transition name="fade">
        <div v-if="deleteSkillTarget" class="modal-backdrop" @click.self="deleteSkillTarget = null">
          <div class="modal-content card-glass delete-confirm-modal">
            <div class="modal-header">
              <h2>{{ t('common.delete') }}</h2>
              <button type="button" class="close-btn" @click="deleteSkillTarget = null">✕</button>
            </div>
            <div class="modal-body">
              <p>{{ t('agents.deleteSkillConfirm') }}</p>
              <p class="delete-target-name">{{ deleteSkillTarget?.name }}</p>
              <div class="modal-footer-actions">
                <button type="button" class="btn-secondary" @click="deleteSkillTarget = null">{{ t('common.close') }}</button>
                <button type="button" class="btn-danger" @click="doDeleteSkill">{{ t('common.delete') }}</button>
              </div>
            </div>
          </div>
        </div>
      </transition>
    </template>
  </div>
</template>

<script>
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useI18n } from '@/composables/useI18n';
import { useAgentStore } from '@/store/modules/agent';
import { agentConfigAPI, skillsAPI, configAPI, agentAPI } from '@/api';
import { marked } from 'marked';
import ChatMessage from '@/components/ChatMessage.vue';
import SmartInstallDialog from '@/components/SmartInstallDialog.vue';

/** 主智能体兜底：工作空间为 workspace/default，API 失败时仍可显示管理界面 */
const MAIN_AGENT_FALLBACK = { id: 'default', name: '主智能体', workspace: 'default', isDefault: true };

export default {
  name: 'AgentDetail',
  components: { ChatMessage, SmartInstallDialog },
  setup() {
    const route = useRoute();
    const router = useRouter();
    const { t } = useI18n();
    const agentStore = useAgentStore();
    const agentId = computed(() => route.params.id);

    const agent = ref(null);
    const loading = ref(true);
    const activeTab = ref('config');
    const tabs = computed(() => [
      { id: 'config', label: t('agents.basicConfig'), icon: '⚙️' },
      { id: 'skills', label: t('agents.skillsConfig'), icon: '🎯' },
    ]);

    const configForm = ref({ name: '', provider: '', model: '' });
    const providers = ref([]);
    const modelOptions = ref([]);
    const configSaving = ref(false);

    const agentSkills = ref([]);
    const skillsLoading = ref(false);
    const showSmartInstallModal = ref(false);
    const showManualInstallModal = ref(false);
    const manualInstallUrl = ref('');
    const installError = ref('');
    const installManualSaving = ref(false);
    const selectedSkill = ref(null);
    const skillDetailContent = ref('');
    const deleteSkillTarget = ref(null);

    const canDeleteWorkspaceSkill = computed(() => agent.value && !agent.value.isDefault && agent.value.workspace !== 'default');
    const renderedSkillContent = computed(() => (skillDetailContent.value ? marked(skillDetailContent.value) : ''));

    async function loadAgent() {
      if (!agentId.value) return;
      loading.value = true;
      try {
        const res = await agentConfigAPI.getAgent(agentId.value);
        agent.value = res.data?.data ?? null;
        if (agent.value) {
          configForm.value = {
            name: agent.value.name,
            provider: agent.value.provider ?? '',
            model: agent.value.model ?? '',
          };
          await loadProviders();
          if (agent.value.provider) await loadModels(agent.value.provider);
        } else if (agentId.value === 'default') {
          agent.value = { ...MAIN_AGENT_FALLBACK };
          configForm.value = { name: agent.value.name, provider: '', model: '' };
          await loadProviders();
        }
      } catch (e) {
        if (agentId.value === 'default') {
          agent.value = { ...MAIN_AGENT_FALLBACK };
          configForm.value = { name: agent.value.name, provider: '', model: '' };
          loadProviders();
        } else {
          agent.value = null;
        }
      } finally {
        loading.value = false;
      }
    }
    async function loadProviders() {
      try {
        const res = await configAPI.getProviders();
        providers.value = res.data?.data ?? [];
      } catch {
        providers.value = [];
      }
    }
    async function loadModels(provider) {
      if (!provider) {
        modelOptions.value = [];
        return;
      }
      try {
        const res = await configAPI.getModels(provider);
        modelOptions.value = res.data?.data ?? [];
      } catch {
        modelOptions.value = [];
      }
    }
    watch(() => configForm.value.provider, (p) => {
      if (p) loadModels(p);
      else modelOptions.value = [];
    });

    async function saveConfig() {
      if (!agent.value) return;
      configSaving.value = true;
      try {
        const payload = {
          provider: configForm.value.provider || undefined,
          model: configForm.value.model || undefined,
        };
        if (!agent.value.isDefault) {
          payload.name = configForm.value.name || agent.value.workspace;
        }
        await agentConfigAPI.updateAgent(agent.value.id, payload);
        agent.value = {
          ...agent.value,
          provider: configForm.value.provider,
          model: configForm.value.model,
        };
        if (!agent.value.isDefault) {
          agent.value.name = configForm.value.name || agent.value.workspace;
        }
      } catch (e) {
        console.error('Save config failed', e);
      } finally {
        configSaving.value = false;
      }
    }

    async function loadSkills() {
      if (!agent.value) return;
      skillsLoading.value = true;
      try {
        const res = await skillsAPI.getSkills(agent.value.workspace);
        agentSkills.value = res.data?.data ?? [];
      } catch (e) {
        agentSkills.value = [];
      } finally {
        skillsLoading.value = false;
      }
    }
    function openSkillDetail(skill) {
      selectedSkill.value = skill;
      skillDetailContent.value = '';
      skillsAPI.getSkillContent(skill.name, agent.value?.workspace).then((res) => {
        skillDetailContent.value = res.data?.data?.content ?? '';
      }).catch(() => {});
    }
    function confirmDeleteSkill(skill) {
      deleteSkillTarget.value = skill;
    }
    async function doDeleteSkill() {
      const target = deleteSkillTarget.value;
      if (!agent.value || !target) return;
      try {
        await skillsAPI.deleteSkill(agent.value.workspace, target.name);
        deleteSkillTarget.value = null;
        await loadSkills();
      } catch (e) {
        console.error('Delete skill failed', e);
      }
    }
    function openSmartInstallModal() {
      if (!agent.value) return;
      agentStore.clearCurrentSession();
      showSmartInstallModal.value = true;
    }
    function closeSmartInstallModal() {
      showSmartInstallModal.value = false;
      installError.value = '';
    }
    function openManualInstallModal() {
      manualInstallUrl.value = '';
      installError.value = '';
      showManualInstallModal.value = true;
    }
    async function doManualInstall() {
      const url = (manualInstallUrl.value || '').trim();
      if (!url) {
        installError.value = t('agents.skillGitUrl');
        return;
      }
      installError.value = '';
      installManualSaving.value = true;
      try {
        await skillsAPI.installSkill(url, {
          scope: 'workspace',
          workspace: agent.value?.workspace ?? 'default',
        });
        showManualInstallModal.value = false;
        manualInstallUrl.value = '';
        await loadSkills();
      } catch (e) {
        installError.value = e.response?.data?.message || e.message || t('agents.installFailed');
      } finally {
        installManualSaving.value = false;
      }
    }

    watch(agentId, loadAgent);
    watch([agent, activeTab], () => {
      if (agent.value && activeTab.value === 'skills') loadSkills();
    });
    watch(
      () => route.query.smartInstallSession,
      async (sessionId) => {
        if (!sessionId) return;
        showSmartInstallModal.value = true;
        try {
          await agentStore.selectSession(sessionId);
          router.replace({ path: route.path, query: {} });
        } catch (e) {
          installError.value = e.response?.data?.message || e.message || 'Failed';
        }
      },
      { immediate: true },
    );
    watch(showSmartInstallModal, (open) => {
      if (open) {
        document.body.style.overflow = 'hidden';
      } else {
        document.body.style.overflow = '';
      }
    });
    onBeforeUnmount(() => {
      if (showSmartInstallModal.value) {
        document.body.style.overflow = '';
      }
    });
    onMounted(() => {
      loadAgent();
    });

    return {
      t,
      agent,
      loading,
      activeTab,
      tabs,
      configForm,
      providers,
      modelOptions,
      configSaving,
      saveConfig,
      agentSkills,
      skillsLoading,
      canDeleteWorkspaceSkill,
      showSmartInstallModal,
      showManualInstallModal,
      manualInstallUrl,
      installError,
      installManualSaving,
      openSmartInstallModal,
      openManualInstallModal,
      closeSmartInstallModal,
      selectedSkill,
      skillDetailContent,
      renderedSkillContent,
      openSkillDetail,
      confirmDeleteSkill,
      deleteSkillTarget,
      doDeleteSkill,
    };
  },
};
</script>

<style scoped>
.agent-detail-view {
  width: 100%;
  min-height: 0;
  height: 100%;
  display: flex;
  flex-direction: column;
  padding: var(--spacing-lg);
  overflow: hidden;
}

.loading-state.full,
.empty-state.full {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: var(--spacing-2xl);
  color: var(--color-text-secondary);
}

.detail-header {
  padding: var(--spacing-lg);
  margin-bottom: var(--spacing-lg);
  border-radius: var(--radius-lg);
  border: 1px solid var(--glass-border);
}

.back-link {
  display: inline-block;
  margin-bottom: var(--spacing-sm);
  color: var(--color-accent-primary);
  text-decoration: none;
  font-size: var(--font-size-sm);
}

.back-link:hover {
  text-decoration: underline;
}

.view-title {
  font-size: var(--font-size-2xl);
  font-weight: 700;
  margin: 0 0 var(--spacing-xs) 0;
  color: var(--color-text-primary);
}

.detail-header code {
  background: var(--color-bg-tertiary);
  padding: 0.1em 0.4em;
  border-radius: var(--radius-sm);
  font-size: var(--font-size-sm);
}

.detail-layout {
  flex: 1;
  min-height: 0;
  display: flex;
  gap: var(--spacing-lg);
  overflow: hidden;
}

.detail-tabs {
  width: 200px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xs);
  padding: var(--spacing-md);
  border-radius: var(--radius-lg);
  border: 1px solid var(--glass-border);
}

.tab-btn {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  padding: var(--spacing-md);
  border: none;
  border-radius: var(--radius-md);
  background: transparent;
  color: var(--color-text-secondary);
  text-align: left;
  cursor: pointer;
  transition: var(--transition-fast);
}

.tab-btn:hover {
  background: var(--color-bg-tertiary);
  color: var(--color-text-primary);
}

.tab-btn.active {
  background: var(--color-accent-primary);
  color: white;
}

.tab-icon {
  font-size: 1.25rem;
}

.detail-content {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  background: var(--color-bg-secondary);
  border-radius: var(--radius-lg);
  border: 1px solid var(--glass-border);
  padding: var(--spacing-lg);
}

.panel-title {
  font-size: var(--font-size-xl);
  margin: 0 0 var(--spacing-lg) 0;
  color: var(--color-text-primary);
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--spacing-lg);
}

.panel-header .panel-title {
  margin: 0;
}

.panel-header-buttons {
  display: flex;
  gap: var(--spacing-sm);
}

.empty-actions {
  display: flex;
  gap: var(--spacing-md);
  margin-top: var(--spacing-lg);
}

/* 智能安装：严格模态，点击背板不关闭，仅通过关闭按钮退出 */
.smart-install-dialog-backdrop {
  position: fixed;
  inset: 0;
  z-index: var(--z-modal-backdrop, 1040);
  background: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--spacing-xl);
  box-sizing: border-box;
}

.smart-install-dialog-backdrop.smart-install-expanded {
  padding: 0;
}

.smart-install-dialog {
  position: relative;
  z-index: var(--z-modal, 1050);
  max-width: 680px;
  width: 100%;
  min-width: 360px;
  max-height: 82vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border-radius: var(--radius-xl);
  border: 1px solid var(--glass-border);
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.35);
  background: var(--color-bg-primary);
}

.smart-install-dialog.expanded {
  max-width: none;
  width: 100%;
  height: 100%;
  max-height: none;
  border-radius: 0;
}

.smart-install-header {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--spacing-lg) var(--spacing-xl);
  border-bottom: 1px solid var(--glass-border);
  background: var(--color-bg-secondary);
}

.smart-install-title {
  margin: 0;
  font-size: var(--font-size-lg);
  font-weight: 600;
  color: var(--color-text-primary);
}

.smart-install-header-actions {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
}

.btn-icon-header {
  padding: var(--spacing-xs) var(--spacing-md);
  font-size: var(--font-size-sm);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-md);
  background: var(--color-bg-tertiary);
  color: var(--color-text-secondary);
  cursor: pointer;
  transition: background 0.15s, color 0.15s, border-color 0.15s;
}

.btn-icon-header:hover {
  background: var(--color-bg-elevated);
  color: var(--color-text-primary);
  border-color: var(--color-accent-primary);
}

.btn-icon-text {
  white-space: nowrap;
}

.smart-install-close-btn {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  border: none;
  border-radius: var(--radius-md);
  background: transparent;
  color: var(--color-text-secondary);
  font-size: 1.1rem;
  cursor: pointer;
  transition: background 0.15s, color 0.15s;
}

.smart-install-close-btn:hover {
  background: var(--color-bg-elevated);
  color: var(--color-text-primary);
}

.smart-install-dialog.expanded .smart-install-messages {
  max-height: none;
  flex: 1;
}

.smart-install-body {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.smart-install-body.loading-inline {
  align-items: center;
  justify-content: center;
  padding: var(--spacing-2xl);
  color: var(--color-text-secondary);
}

.smart-install-messages {
  flex: 1;
  min-height: 280px;
  max-height: 52vh;
  overflow-y: auto;
  padding: var(--spacing-lg) var(--spacing-xl);
  background: var(--color-bg-primary);
}

.smart-install-dialog.expanded .smart-install-messages {
  max-height: none;
}

.empty-chat-inline {
  padding: var(--spacing-xl);
  text-align: center;
  color: var(--color-text-secondary);
  font-size: var(--font-size-sm);
}

.smart-install-messages .chat-message {
  margin-bottom: var(--spacing-md);
}

.smart-install-messages .streaming-message {
  margin-bottom: var(--spacing-md);
}

/* 输入区：一个圆角框内，左侧输入框 + 右侧发送/中止按钮，视觉一体 */
.smart-install-input-row {
  flex-shrink: 0;
  display: flex;
  align-items: flex-end;
  gap: var(--spacing-sm);
  padding: var(--spacing-md) var(--spacing-lg);
  background: var(--color-bg-secondary);
  border-top: 1px solid var(--glass-border);
}

.smart-install-input-wrap {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  padding: 8px 10px;
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-md);
  background: var(--color-bg-primary);
  transition: border-color 0.15s, box-shadow 0.15s;
}

.smart-install-input-wrap:focus-within {
  border-color: var(--color-accent-primary);
  box-shadow: 0 0 0 2px rgba(102, 126, 234, 0.15);
}

.smart-install-input {
  flex: 1;
  width: 100%;
  min-width: 0;
  padding: var(--spacing-sm) var(--spacing-md);
  border: none;
  background: transparent;
  color: var(--color-text-primary);
  font-size: var(--font-size-base);
  font-family: var(--font-family-base);
  resize: none;
  min-height: 44px;
  outline: none;
}

.smart-install-input::placeholder {
  color: var(--color-text-tertiary);
}

.smart-install-input:disabled {
  opacity: 0.7;
  cursor: not-allowed;
}

.smart-install-btn {
  flex-shrink: 0;
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  border: none;
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: opacity 0.15s, background 0.15s, transform 0.1s;
}

.smart-install-btn .btn-icon-svg {
  width: 20px;
  height: 20px;
}

.smart-install-btn-send {
  background: var(--color-accent-primary);
  color: white;
}

.smart-install-btn-send:hover:not(:disabled) {
  opacity: 0.95;
  transform: scale(1.02);
}

.smart-install-btn-send:disabled {
  opacity: 0.45;
  cursor: not-allowed;
  transform: none;
}

.smart-install-btn-abort {
  background: rgba(220, 38, 38, 0.14);
  color: var(--color-error, #dc2626);
}

.smart-install-btn-abort:hover {
  background: rgba(220, 38, 38, 0.22);
  transform: scale(1.02);
}

.smart-install-error {
  margin: 0;
  padding: var(--spacing-sm) var(--spacing-lg);
  flex-shrink: 0;
}

.form-group {
  margin-bottom: var(--spacing-lg);
}

.form-group label {
  display: block;
  margin-bottom: var(--spacing-xs);
  font-weight: 500;
  color: var(--color-text-primary);
}

.form-input {
  width: 100%;
  max-width: 400px;
  padding: var(--spacing-sm) var(--spacing-md);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-md);
  background: var(--color-bg-primary);
  color: var(--color-text-primary);
  font-size: var(--font-size-base);
}

.form-input.readonly {
  opacity: 0.8;
  cursor: not-allowed;
}

.form-hint {
  font-size: var(--font-size-sm);
  color: var(--color-text-tertiary);
  margin: var(--spacing-xs) 0 0 0;
}

.btn-primary {
  padding: var(--spacing-sm) var(--spacing-lg);
  background: var(--color-accent-primary);
  color: white;
  border: none;
  border-radius: var(--radius-md);
  font-weight: 500;
  cursor: pointer;
}

.btn-primary:disabled {
  opacity: 0.7;
  cursor: not-allowed;
}

.btn-secondary {
  padding: var(--spacing-sm) var(--spacing-lg);
  background: var(--color-bg-tertiary);
  color: var(--color-text-primary);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-md);
  cursor: pointer;
}

.skills-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  gap: var(--spacing-lg);
}

.skill-card {
  padding: var(--spacing-lg);
  border-radius: var(--radius-md);
  border: 1px solid var(--glass-border);
  cursor: pointer;
  transition: var(--transition-fast);
}

.skill-card:hover {
  border-color: var(--color-accent-primary);
}

.skill-card-icon {
  font-size: 1.5rem;
  display: block;
  margin-bottom: var(--spacing-sm);
}

.skill-card-name {
  font-weight: 600;
  color: var(--color-text-primary);
}

.skill-card-desc {
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
  margin: var(--spacing-xs) 0 var(--spacing-sm) 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.skill-delete {
  font-size: var(--font-size-sm);
}

.add-skill-modal .form-hint {
  margin-bottom: var(--spacing-md);
}

.doc-toolbar {
  margin-bottom: var(--spacing-md);
}

.breadcrumb {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: var(--spacing-xs);
}

.breadcrumb-item {
  background: none;
  border: none;
  color: var(--color-accent-primary);
  cursor: pointer;
  padding: 0;
  font-size: var(--font-size-base);
}

.breadcrumb-sep {
  color: var(--color-text-tertiary);
}

.doc-list {
  overflow-y: auto;
}

.doc-item {
  display: flex;
  align-items: center;
  gap: var(--spacing-md);
  padding: var(--spacing-sm) var(--spacing-md);
  border-radius: var(--radius-md);
}

.doc-item:hover {
  background: var(--color-bg-tertiary);
}

.doc-item.folder .doc-name {
  cursor: pointer;
  color: var(--color-accent-primary);
}

.doc-icon {
  font-size: 1.25rem;
}

.doc-name {
  flex: 1;
  text-align: left;
  border: none;
  background: none;
  color: var(--color-text-primary);
  font-size: var(--font-size-base);
}

.doc-actions {
  display: flex;
  align-items: center;
  gap: var(--spacing-xs);
}

.link-btn {
  color: var(--color-accent-primary);
  text-decoration: none;
  font-size: var(--font-size-sm);
  background: none;
  border: none;
  cursor: pointer;
}

.link-btn.danger {
  color: var(--color-error);
}

.sep {
  color: var(--color-text-tertiary);
}

.loading-state,
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: var(--spacing-2xl);
  color: var(--color-text-secondary);
}

.empty-icon {
  font-size: 3rem;
  margin-bottom: var(--spacing-md);
  opacity: 0.6;
}

.mt-4 {
  margin-top: var(--spacing-lg);
}

.spinner {
  width: 40px;
  height: 40px;
  border: 3px solid var(--color-bg-elevated);
  border-top-color: var(--color-accent-primary);
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin-bottom: var(--spacing-md);
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: var(--z-modal, 1000);
  padding: var(--spacing-lg);
}

.modal-content {
  background: var(--color-bg-primary);
  border-radius: var(--radius-xl);
  border: 1px solid var(--glass-border);
  max-width: 480px;
  width: 100%;
  max-height: 80vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.modal-content.skill-detail-modal {
  max-width: 720px;
}

.modal-content.preview-modal {
  max-width: 90vw;
  max-height: 90vh;
  width: 900px;
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

.modal-body {
  padding: var(--spacing-lg);
  overflow-y: auto;
}

.form-error {
  color: var(--color-error);
  font-size: var(--font-size-sm);
  margin-bottom: var(--spacing-md);
}

.modal-footer-actions {
  display: flex;
  justify-content: flex-end;
  gap: var(--spacing-md);
  margin-top: var(--spacing-xl);
}

.delete-confirm-modal {
  max-width: 420px;
}

.delete-target-name {
  font-weight: 600;
  color: var(--color-text-primary);
  margin-top: var(--spacing-sm);
}

.btn-danger {
  padding: var(--spacing-sm) var(--spacing-lg);
  background: var(--color-error);
  color: white;
  border: none;
  border-radius: var(--radius-md);
  font-weight: 500;
  cursor: pointer;
}

.preview-backdrop {
  align-items: center;
  justify-content: center;
}

.preview-title {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 60%;
}

.preview-body {
  flex: 1;
  min-height: 200px;
  overflow: auto;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--color-bg-tertiary);
}

.preview-image {
  max-width: 100%;
  max-height: 70vh;
  object-fit: contain;
}

.preview-iframe {
  width: 100%;
  height: 70vh;
  border: none;
}

.preview-text {
  width: 100%;
  margin: 0;
  padding: var(--spacing-lg);
  font-size: var(--font-size-sm);
  font-family: var(--font-family-mono);
  white-space: pre-wrap;
  word-break: break-all;
  text-align: left;
  color: var(--color-text-primary);
}

.skill-documentation :deep(h1) { font-size: 1.5em; margin: 0 0 0.5em 0; }
.skill-documentation :deep(h2) { font-size: 1.25em; margin: 1em 0 0.5em 0; }
.skill-documentation :deep(p) { margin-bottom: 0.75em; }
.skill-documentation :deep(code) { background: var(--color-bg-tertiary); padding: 0.15em 0.35em; border-radius: var(--radius-sm); }

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
