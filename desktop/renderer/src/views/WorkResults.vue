<template>
  <div class="work-results-view">
    <div class="results-header card-glass">
      <div class="header-left">
        <h1 class="view-title">{{ t('workResults.title') }}</h1>
        <p class="text-secondary">
          {{ t('workResults.currentWorkspace') }}: <strong>{{ currentWorkspace }}</strong>
        </p>
      </div>
      <button class="btn-primary" @click="showSwitchModal = true">
        {{ t('workResults.switchWorkspace') }}
      </button>
    </div>

    <div class="results-tabs">
      <button
        class="tab-btn"
        :class="{ active: activeTab === 'documents' }"
        @click="activeTab = 'documents'"
      >
        {{ t('workResults.documents') }}
      </button>
      <button
        class="tab-btn"
        :class="{ active: activeTab === 'news' }"
        @click="activeTab = 'news'"
      >
        {{ t('workResults.news') }}
      </button>
    </div>

    <!-- 文档 Tab -->
    <div v-show="activeTab === 'documents'" class="tab-panel documents-panel">
      <div class="doc-toolbar">
        <nav class="breadcrumb">
          <button class="breadcrumb-item" @click="docPath = ''">{{ currentWorkspace }}</button>
          <span v-for="(part, i) in docPathParts" :key="i" class="breadcrumb-chunk">
            <span class="breadcrumb-sep">/</span>
            <button class="breadcrumb-item" @click="docPath = docPathParts.slice(0, i + 1).join('/')">
              {{ part }}
            </button>
          </span>
        </nav>
        <div class="doc-view-toggle">
          <button
            type="button"
            class="toggle-btn"
            :class="{ active: docViewMode === 'list' }"
            @click="docViewMode = 'list'"
          >
            {{ t('workResults.viewList') }}
          </button>
          <button
            type="button"
            class="toggle-btn"
            :class="{ active: docViewMode === 'cards' }"
            @click="docViewMode = 'cards'"
          >
            {{ t('workResults.viewCards') }}
          </button>
        </div>
      </div>
      <div v-if="docLoading" class="loading-state">
        <div class="spinner"></div>
        <p>{{ t('common.loading') }}</p>
      </div>
      <div v-else-if="filteredDocuments.length === 0" class="empty-state">
        <div class="empty-icon">📂</div>
        <p>{{ t('workspace.emptyDocs') }}</p>
      </div>
      <template v-else>
        <!-- 卡片视图：仅图片文件以卡片展示 -->
        <div v-if="docViewMode === 'cards'" class="doc-cards-view">
          <div v-if="imageFiles.length > 0" class="image-cards-grid">
            <div
              v-for="item in imageFiles"
              :key="item.path"
              class="image-card"
              @click="openPreview(item)"
            >
              <img :src="fileServeUrl(item.path, false)" :alt="item.name" class="image-card-thumb" loading="lazy" />
              <span class="image-card-name">{{ item.name }}</span>
            </div>
          </div>
          <div v-else class="empty-state small">
            <p>{{ t('workResults.noImagesHere') }}</p>
          </div>
          <div v-if="nonImageItems.length > 0" class="other-files-section">
            <p class="other-files-label">{{ t('workResults.otherFiles') }}</p>
            <div class="doc-list">
              <div
                v-for="item in nonImageItems"
                :key="item.path"
                class="doc-item"
                :class="{ folder: item.isDirectory }"
              >
                <template v-if="item.isDirectory">
                  <span class="doc-icon">📁</span>
                  <button class="doc-name" @click="docPath = item.path">{{ item.name }}</button>
                </template>
                <template v-else>
                  <span class="doc-icon">📄</span>
                  <span class="doc-name">{{ item.name }}</span>
                  <span class="doc-actions">
                    <a :href="fileServeUrl(item.path, true)" download class="link-btn">{{ t('workspace.download') }}</a>
                  </span>
                </template>
              </div>
            </div>
          </div>
        </div>
        <!-- 列表视图 -->
        <div v-else class="doc-list">
          <div
            v-for="item in filteredDocuments"
            :key="item.path"
            class="doc-item"
            :class="{ folder: item.isDirectory }"
          >
            <template v-if="item.isDirectory">
              <span class="doc-icon">📁</span>
              <button class="doc-name" @click="docPath = item.path">{{ item.name }}</button>
              <span class="doc-actions">
                <button type="button" class="link-btn danger" @click="confirmDelete(item)">{{ t('common.delete') }}</button>
              </span>
            </template>
            <template v-else>
              <span class="doc-icon">📄</span>
              <span class="doc-name">{{ item.name }}</span>
              <span class="doc-actions">
                <template v-if="isPreviewable(item.name)">
                  <button type="button" class="link-btn" @click="openPreview(item)">
                    {{ t('workspace.preview') }}
                  </button>
                  <span class="sep">|</span>
                </template>
                <a :href="fileServeUrl(item.path, true)" download class="link-btn">{{ t('workspace.download') }}</a>
                <span class="sep">|</span>
                <button type="button" class="link-btn danger" @click="confirmDelete(item)">{{ t('common.delete') }}</button>
              </span>
            </template>
          </div>
        </div>
      </template>
    </div>

    <!-- 新闻 Tab -->
    <div v-show="activeTab === 'news'" class="tab-panel news-panel">
      <div class="empty-state">
        <div class="empty-icon">📰</div>
        <p>{{ t('workResults.noNews') }}</p>
        <p class="text-secondary">{{ t('workResults.noNewsHint') }}</p>
      </div>
    </div>

    <!-- Preview modal -->
    <transition name="fade">
      <div v-if="showPreviewModal" class="modal-backdrop preview-backdrop" @click.self="closePreview">
        <div class="modal-content preview-modal card-glass">
          <div class="modal-header">
            <h2 class="preview-title">{{ previewItem?.name }}</h2>
            <div class="preview-actions">
              <a
                v-if="previewItem && !previewItem.isDirectory"
                :href="fileServeUrl(previewItem.path, true)"
                download
                class="link-btn"
              >
                {{ t('workspace.download') }}
              </a>
              <button type="button" class="close-btn" @click="closePreview">✕</button>
            </div>
          </div>
          <div class="preview-body">
            <template v-if="previewType === 'image'">
              <img :src="previewUrl" :alt="previewItem?.name" class="preview-image" />
            </template>
            <template v-else-if="previewType === 'pdf'">
              <iframe :src="previewUrl" class="preview-iframe" title="PDF" />
            </template>
            <template v-else-if="previewType === 'html'">
              <iframe v-if="previewHtmlContent" :srcdoc="previewHtmlContent" class="preview-iframe" title="HTML" />
              <div v-else class="loading-state"><div class="spinner"></div></div>
            </template>
            <template v-else-if="previewType === 'text'">
              <pre v-if="previewTextContent !== null" class="preview-text">{{ previewTextContent }}</pre>
              <div v-else class="loading-state"><div class="spinner"></div></div>
            </template>
          </div>
        </div>
      </div>
    </transition>

    <!-- Delete confirm modal -->
    <transition name="fade">
      <div v-if="deleteTarget" class="modal-backdrop" @click.self="deleteTarget = null">
        <div class="modal-content card-glass delete-confirm-modal">
          <div class="modal-header">
            <h2>{{ t('common.delete') }}</h2>
            <button type="button" class="close-btn" @click="deleteTarget = null">✕</button>
          </div>
          <div class="modal-body">
            <p>{{ deleteTarget?.isDirectory ? t('workspace.deleteFolderConfirm') : t('workspace.deleteConfirm') }}</p>
            <p class="delete-target-name">{{ deleteTarget?.name }}</p>
            <div class="modal-footer-actions">
              <button type="button" class="btn-secondary" @click="deleteTarget = null">{{ t('common.close') }}</button>
              <button type="button" class="btn-danger" @click="doDelete">{{ t('common.delete') }}</button>
            </div>
          </div>
        </div>
      </div>
    </transition>

    <!-- Switch Workspace Modal -->
    <transition name="fade">
      <div v-if="showSwitchModal" class="modal-backdrop" @click.self="showSwitchModal = false">
        <div class="modal-content card-glass">
          <div class="modal-header">
            <h2>{{ t('workResults.selectWorkspace') }}</h2>
            <button class="close-btn" @click="showSwitchModal = false">✕</button>
          </div>
          <div class="modal-body">
            <div v-if="workspaces.length === 0" class="empty-state">
              <p>{{ t('workspace.emptyDocs') }}</p>
            </div>
            <ul class="workspace-list">
              <li
                v-for="name in workspaces"
                :key="name"
                class="workspace-option"
                :class="{ active: name === currentWorkspace }"
                @click="switchWorkspace(name)"
              >
                <span class="ws-icon">📁</span>
                <span class="ws-name">{{ name }}</span>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </transition>
  </div>
</template>

<script>
import { ref, computed, watch, onMounted } from 'vue';
import { useI18n } from '@/composables/useI18n';
import apiClient from '@/api';
import { workspaceAPI, configAPI } from '@/api';
import { useSettingsStore } from '@/store/modules/settings';

const PREVIEW_EXTS = new Set(['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'pdf', 'txt', 'html', 'htm', 'md', 'json']);

export default {
  name: 'WorkResults',
  setup() {
    const { t } = useI18n();
    const settingsStore = useSettingsStore();

    const activeTab = ref('documents');
    const currentWorkspace = ref('default');
    const workspaces = ref([]);
    const showSwitchModal = ref(false);
    const docPath = ref('');
    const documents = ref([]);
    const docLoading = ref(false);
    const docViewMode = ref('list');
    const previewItem = ref(null);
    const previewTextContent = ref(null);
    const previewHtmlContent = ref(null);
    const deleteTarget = ref(null);

    const docPathParts = computed(() =>
      docPath.value ? docPath.value.split('/').filter(Boolean) : []
    );

    const HIDDEN_DIR_NAMES = new Set(['skills', '.skills']);
    const filteredDocuments = computed(() =>
      documents.value.filter(
        (item) => !item.isDirectory || !HIDDEN_DIR_NAMES.has(item.name)
      )
    );
    const imageFiles = computed(() =>
      filteredDocuments.value.filter(
        (item) => !item.isDirectory && getPreviewType(item.name) === 'image'
      )
    );
    const nonImageItems = computed(() =>
      filteredDocuments.value.filter(
        (item) => item.isDirectory || getPreviewType(item.name) !== 'image'
      )
    );

    const showPreviewModal = computed(() => !!previewItem.value);
    const previewType = computed(() => (previewItem.value ? getPreviewType(previewItem.value.name) : ''));
    const previewUrl = computed(() =>
      previewItem.value && !previewItem.value.isDirectory
        ? fileServeUrl(previewItem.value.path, false)
        : ''
    );

    function fileServeUrl(relativePath, download) {
      const base = apiClient.defaults.baseURL || '/server-api';
      const params = new URLSearchParams({
        workspace: currentWorkspace.value,
        path: relativePath,
      });
      if (download) params.set('download', '1');
      return `${base}/workspace/files/serve?${params.toString()}`;
    }

    function isPreviewable(filename) {
      const ext = filename.split('.').pop()?.toLowerCase() || '';
      return PREVIEW_EXTS.has(ext);
    }

    function getPreviewType(filename) {
      const ext = filename.split('.').pop()?.toLowerCase() || '';
      if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(ext)) return 'image';
      if (ext === 'pdf') return 'pdf';
      if (['html', 'htm'].includes(ext)) return 'html';
      if (['txt', 'md', 'json'].includes(ext)) return 'text';
      return '';
    }

    async function openPreview(item) {
      if (item.isDirectory) return;
      previewItem.value = item;
      const type = getPreviewType(item.name);
      previewTextContent.value = null;
      previewHtmlContent.value = null;
      if (type === 'text') {
        try {
          const url = fileServeUrl(item.path, false);
          const res = await fetch(url);
          previewTextContent.value = await res.text();
        } catch (e) {
          previewTextContent.value = '';
        }
      } else if (type === 'html') {
        try {
          const url = fileServeUrl(item.path, false);
          const res = await fetch(url);
          previewHtmlContent.value = await res.text();
        } catch (e) {
          previewHtmlContent.value = '';
        }
      }
    }

    function closePreview() {
      previewItem.value = null;
      previewTextContent.value = null;
      previewHtmlContent.value = null;
    }

    function confirmDelete(item) {
      deleteTarget.value = item;
    }

    async function doDelete() {
      if (!deleteTarget.value) return;
      const item = deleteTarget.value;
      deleteTarget.value = null;
      try {
        await workspaceAPI.deleteDocument(currentWorkspace.value, item.path);
        loadDocuments();
      } catch (e) {
        console.error('Delete failed', e);
      }
    }

    async function loadWorkspaces() {
      try {
        const res = await workspaceAPI.listWorkspaces();
        workspaces.value = res.data?.data ?? [];
      } catch (e) {
        console.error('List workspaces failed', e);
      }
    }

    async function loadCurrentWorkspace() {
      try {
        const res = await workspaceAPI.getCurrentWorkspace();
        currentWorkspace.value = res.data?.data ?? 'default';
      } catch (e) {
        currentWorkspace.value = settingsStore.config?.defaultAgentId ?? 'default';
      }
    }

    async function loadDocuments() {
      docLoading.value = true;
      try {
        const res = await workspaceAPI.listDocuments(currentWorkspace.value, docPath.value);
        documents.value = res.data?.data ?? [];
      } catch (e) {
        console.error('List documents failed', e);
        documents.value = [];
      } finally {
        docLoading.value = false;
      }
    }

    async function switchWorkspace(name) {
      try {
        await configAPI.updateConfig({ defaultAgentId: name });
        currentWorkspace.value = name;
        showSwitchModal.value = false;
        await settingsStore.loadConfig();
        if (activeTab.value === 'documents') loadDocuments();
      } catch (e) {
        console.error('Switch workspace failed', e);
      }
    }

    watch([currentWorkspace, docPath], loadDocuments);
    onMounted(async () => {
      await loadCurrentWorkspace();
      await loadWorkspaces();
      loadDocuments();
    });

    return {
      t,
      activeTab,
      currentWorkspace,
      workspaces,
      showSwitchModal,
      docPath,
      docPathParts,
      docViewMode,
      documents,
      filteredDocuments,
      imageFiles,
      nonImageItems,
      docLoading,
      previewItem,
      previewType,
      previewUrl,
      previewTextContent,
      previewHtmlContent,
      showPreviewModal,
      deleteTarget,
      fileServeUrl,
      isPreviewable,
      openPreview,
      closePreview,
      confirmDelete,
      doDelete,
      switchWorkspace,
    };
  },
};
</script>

<style scoped>
.work-results-view {
  width: 100%;
  min-height: 0;
  height: 100%;
  display: flex;
  flex-direction: column;
  padding: var(--spacing-lg);
  overflow: hidden;
}

.results-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--spacing-lg);
  margin-bottom: var(--spacing-lg);
  border-radius: var(--radius-lg);
  border: 1px solid var(--glass-border);
}

.view-title {
  font-size: var(--font-size-2xl);
  font-weight: 700;
  margin: 0 0 var(--spacing-xs) 0;
  color: var(--color-text-primary);
}

.results-tabs {
  display: flex;
  gap: var(--spacing-sm);
  margin-bottom: var(--spacing-lg);
}

.tab-btn {
  padding: var(--spacing-sm) var(--spacing-lg);
  border-radius: var(--radius-md);
  border: 1px solid var(--glass-border);
  background: var(--color-bg-secondary);
  color: var(--color-text-secondary);
  font-weight: 500;
  transition: var(--transition-fast);
}

.tab-btn:hover {
  background: var(--color-bg-tertiary);
  color: var(--color-text-primary);
}

.tab-btn.active {
  background: var(--color-accent-primary);
  color: white;
  border-color: var(--color-accent-primary);
}

.tab-panel {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: var(--color-bg-secondary);
  border-radius: var(--radius-lg);
  border: 1px solid var(--glass-border);
  padding: var(--spacing-lg);
}

.doc-toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: var(--spacing-md);
  margin-bottom: var(--spacing-md);
}

.doc-view-toggle {
  display: flex;
  gap: 2px;
}

.doc-view-toggle .toggle-btn {
  padding: var(--spacing-xs) var(--spacing-md);
  font-size: var(--font-size-sm);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-md);
  background: var(--color-bg-secondary);
  color: var(--color-text-secondary);
  cursor: pointer;
  transition: var(--transition-fast);
}

.doc-view-toggle .toggle-btn:hover {
  color: var(--color-text-primary);
  background: var(--color-bg-tertiary);
}

.doc-view-toggle .toggle-btn.active {
  background: var(--color-accent-primary);
  color: white;
  border-color: var(--color-accent-primary);
}

.doc-cards-view {
  flex: 1;
  overflow-y: auto;
}

.image-cards-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
  gap: var(--spacing-lg);
  margin-bottom: var(--spacing-xl);
}

.image-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: var(--spacing-sm);
  background: var(--color-bg-tertiary);
  border-radius: var(--radius-lg);
  border: 1px solid var(--glass-border);
  cursor: pointer;
  transition: var(--transition-fast);
}

.image-card:hover {
  border-color: var(--color-accent-primary);
  background: var(--color-bg-elevated);
}

.image-card-thumb {
  width: 100%;
  aspect-ratio: 1;
  object-fit: cover;
  border-radius: var(--radius-md);
  margin-bottom: var(--spacing-xs);
}

.image-card-name {
  font-size: var(--font-size-sm);
  color: var(--color-text-primary);
  text-align: center;
  word-break: break-all;
  line-height: 1.3;
}

.other-files-section {
  margin-top: var(--spacing-xl);
  padding-top: var(--spacing-lg);
  border-top: 1px solid var(--glass-border);
}

.other-files-label {
  font-size: var(--font-size-sm);
  font-weight: 600;
  color: var(--color-text-secondary);
  margin: 0 0 var(--spacing-md);
}

.empty-state.small {
  padding: var(--spacing-lg);
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

.breadcrumb-item:hover {
  text-decoration: underline;
}

.breadcrumb-chunk {
  display: inline-flex;
  align-items: center;
  gap: var(--spacing-xs);
}

.breadcrumb-sep {
  color: var(--color-text-tertiary);
}

.doc-list {
  flex: 1;
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

.doc-item.folder .doc-name:hover {
  text-decoration: underline;
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

.sep {
  color: var(--color-text-tertiary);
}

.link-btn {
  color: var(--color-accent-primary);
  text-decoration: none;
  font-size: var(--font-size-sm);
}

.link-btn:hover {
  text-decoration: underline;
}

.link-btn.danger {
  color: var(--color-error, #e53e3e);
}

.preview-backdrop {
  align-items: center;
  justify-content: center;
}

.preview-modal {
  max-width: 90vw;
  max-height: 90vh;
  width: 900px;
  display: flex;
  flex-direction: column;
}

.preview-title {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 60%;
}

.preview-actions {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
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
  font-family: var(--font-family-mono, monospace);
  white-space: pre-wrap;
  word-break: break-all;
  text-align: left;
  color: var(--color-text-primary);
}

.delete-confirm-modal {
  max-width: 420px;
}

.delete-target-name {
  font-weight: 600;
  color: var(--color-text-primary);
  margin-top: var(--spacing-sm);
}

.modal-footer-actions {
  display: flex;
  justify-content: flex-end;
  gap: var(--spacing-md);
  margin-top: var(--spacing-xl);
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

.btn-danger:hover {
  filter: brightness(1.1);
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

.workspace-list {
  list-style: none;
  margin: 0;
  padding: 0;
}

.workspace-option {
  display: flex;
  align-items: center;
  gap: var(--spacing-md);
  padding: var(--spacing-md);
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: var(--transition-fast);
}

.workspace-option:hover,
.workspace-option.active {
  background: var(--color-bg-tertiary);
  color: var(--color-accent-primary);
}

.ws-icon {
  font-size: 1.25rem;
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
