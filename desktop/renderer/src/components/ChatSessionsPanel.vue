<template>
  <div class="chat-sessions-panel" :class="{ collapsed: !visible }">
    <div v-show="visible" class="panel-content">

      <button class="btn-new-session" @click="$emit('create')">
        + {{ t('chat.newSession') }}
      </button>
      <div class="sessions-list">
        <button
          v-for="session in sessions"
          :key="session.id"
          type="button"
          class="session-item"
          :class="{ active: currentSessionId === session.id }"
          @click="$emit('select', session.id)"
        >
          <span class="session-title">{{ sessionTitle(session) }}</span>
          <span class="session-badge" :class="`badge-${session.status}`">{{ session.status }}</span>
        </button>
      </div>
    </div>
  </div>
</template>

<script>
import { useI18n } from '@/composables/useI18n';

export default {
  name: 'ChatSessionsPanel',
  props: {
    visible: { type: Boolean, required: true },
    sessions: { type: Array, default: () => [] },
    currentSessionId: { type: String, default: null },
  },
  emits: ['create', 'select'],
  setup() {
    const { t } = useI18n();
    const sessionTitle = (session) => {
      if (session.title) return session.title;
      const id = session.id || '';
      return id.length > 16 ? id.substring(0, 16) + '…' : id || 'Session';
    };
    return { t, sessionTitle };
  },
};
</script>

<style scoped>
.chat-sessions-panel {
  display: flex;
  flex: 0 0 200px;
  width: 200px;
  min-width: 200px;
  max-width: 200px;
  height: 100%;
  background: var(--color-bg-secondary);
  border-right: 1px solid var(--glass-border);
  will-change: width, min-width, flex-basis;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.chat-sessions-panel.collapsed {
  width: 0 !important;
  min-width: 0 !important;
  max-width: 0 !important;
  flex: 0 0 0 !important;
  border-right: none !important;
  opacity: 0;
  overflow: hidden;
  margin: 0;
  padding: 0;
}

.panel-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
  overflow: hidden;
}



.btn-new-session {
  margin: var(--spacing-md);
  padding: var(--spacing-sm) var(--spacing-md);
  background: var(--color-bg-tertiary);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-md);
  color: var(--color-text-primary);
  font-size: var(--font-size-sm);
  cursor: pointer;
  transition: all var(--transition-fast);
  text-align: center;
}

.btn-new-session:hover {
  background: var(--color-bg-elevated);
  border-color: var(--color-accent-primary);
}

.sessions-list {
  flex: 1;
  overflow-y: auto;
  padding: var(--spacing-sm);
}

.session-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  padding: var(--spacing-md);
  margin-bottom: var(--spacing-xs);
  border: none;
  border-radius: var(--radius-md);
  background: transparent;
  color: var(--color-text-primary);
  font-size: var(--font-size-sm);
  text-align: left;
  cursor: pointer;
  transition: background var(--transition-fast);
}

.session-item:hover {
  background: var(--color-bg-tertiary);
}

.session-item.active {
  background: var(--color-bg-tertiary);
  border-left: 3px solid var(--color-accent-primary);
  padding-left: calc(var(--spacing-md) - 3px);
}

.session-title {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.session-badge {
  flex-shrink: 0;
  font-size: 10px;
  padding: 2px 6px;
  border-radius: var(--radius-sm);
  margin-left: var(--spacing-sm);
}

.badge-idle {
  background: var(--color-bg-elevated);
  color: var(--color-text-secondary);
}

.badge-active {
  background: var(--color-status-active);
  color: var(--color-bg-primary);
}

.badge-error {
  background: var(--color-error);
  color: white;
}

</style>
