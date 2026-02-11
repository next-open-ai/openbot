<template>
  <transition name="fade">
    <div v-if="visible" class="modal-backdrop local-install-backdrop" role="dialog" aria-modal="true" @click.self="close">
      <div class="modal-content card-glass local-install-modal" @click.stop>
        <div class="modal-header">
          <h2 class="modal-title">{{ t('agents.installLocal') }}</h2>
          <button type="button" class="close-btn" :title="t('common.close')" @click="close">✕</button>
        </div>
        <div class="modal-body">
          <p class="form-hint">{{ t('agents.installLocalHint') }}</p>
          <div v-if="!hasElectron" class="form-error">{{ t('agents.installLocalDesktopOnly') }}</div>
          <template v-else>
            <div class="path-row">
              <span v-if="selectedPath" class="path-text" :title="selectedPath">{{ selectedPath }}</span>
              <span v-else class="path-placeholder">{{ t('skills.selectFolder') }}</span>
              <button
                type="button"
                class="btn-secondary btn-pick"
                :disabled="saving"
                @click="pickDirectory"
              >
                {{ t('skills.chooseFolder') }}
              </button>
            </div>
            <p v-if="error" class="form-error">{{ error }}</p>
            <div class="modal-footer-actions">
              <button type="button" class="btn-secondary" @click="close">{{ t('common.close') }}</button>
              <button
                type="button"
                class="btn-primary"
                :disabled="!selectedPath || saving"
                @click="doInstall"
              >
                {{ saving ? t('common.loading') : t('agents.installConfirm') }}
              </button>
            </div>
          </template>
        </div>
      </div>
    </div>
  </transition>
</template>

<script>
import { ref, computed, watch } from 'vue';
import { useI18n } from '@/composables/useI18n';
import { skillsAPI } from '@/api';

export default {
  name: 'LocalInstallSkillDialog',
  props: {
    /** 安装目标：'global' 或 'workspace' */
    scope: { type: String, required: true },
    /** 当 scope 为 'workspace' 时的工作区名 */
    workspace: { type: String, default: 'default' },
    /** 是否显示弹窗（由父组件 v-if 控制，此处仅用于内部重置） */
    show: { type: Boolean, default: false },
  },
  emits: ['close', 'installed'],
  setup(props, { emit }) {
    const { t } = useI18n();
    const visible = computed(() => props.show);
    const hasElectron = computed(() => typeof window !== 'undefined' && !!window.electronAPI?.showOpenDirectoryDialog);

    const selectedPath = ref('');
    const error = ref('');
    const saving = ref(false);

    function close() {
      selectedPath.value = '';
      error.value = '';
      emit('close');
    }

    async function pickDirectory() {
      if (!hasElectron.value) return;
      error.value = '';
      try {
        const path = await window.electronAPI.showOpenDirectoryDialog();
        if (path) selectedPath.value = path;
      } catch (e) {
        error.value = e.message || 'Failed to open dialog';
      }
    }

    async function doInstall() {
      const path = selectedPath.value?.trim();
      if (!path || saving.value) return;
      error.value = '';
      saving.value = true;
      try {
        await skillsAPI.installSkillFromPath(path, {
          scope: props.scope,
          workspace: props.scope === 'workspace' ? props.workspace : undefined,
        });
        emit('installed');
        close();
      } catch (e) {
        error.value = e.response?.data?.message || e.message || t('agents.installFailed');
      } finally {
        saving.value = false;
      }
    }

    watch(visible, (v) => {
      if (!v) {
        selectedPath.value = '';
        error.value = '';
      }
    });

    return {
      t,
      visible,
      hasElectron,
      selectedPath,
      error,
      saving,
      close,
      pickDirectory,
      doInstall,
    };
  },
};
</script>

<style scoped>
.local-install-backdrop {
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1040;
}
.local-install-modal {
  max-width: 520px;
}
.modal-title {
  margin: 0;
  font-size: var(--font-size-lg);
}
.path-row {
  display: flex;
  align-items: center;
  gap: var(--spacing-md);
  margin: var(--spacing-lg) 0;
  min-height: 40px;
}
.path-text {
  flex: 1;
  min-width: 0;
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.path-placeholder {
  flex: 1;
  font-size: var(--font-size-sm);
  color: var(--color-text-tertiary);
}
.btn-pick {
  flex-shrink: 0;
}
.modal-footer-actions {
  display: flex;
  justify-content: flex-end;
  gap: var(--spacing-md);
  margin-top: var(--spacing-lg);
}
.form-error {
  margin-top: var(--spacing-sm);
}
</style>
