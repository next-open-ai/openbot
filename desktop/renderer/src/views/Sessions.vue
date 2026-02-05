<template>
  <div class="sessions-view">
    <div class="sessions-header">
      <button @click="createNewSession" class="btn-primary">
        <span>➕</span>
        <span>Create New Session</span>
      </button>
    </div>

    <div v-if="sessions.length === 0" class="empty-state card-glass">
      <div class="empty-icon">📝</div>
      <h3>No Sessions Yet</h3>
      <p class="text-secondary">Create your first session to get started</p>
    </div>

    <div v-else class="sessions-grid">
      <div
        v-for="session in sessions"
        :key="session.id"
        class="session-card card-glass"
      >
        <div class="session-header">
          <div class="session-id">{{ session.id.substring(0, 12) }}...</div>
          <span class="badge" :class="`badge-${session.status}`">
            {{ session.status }}
          </span>
        </div>
        <div class="session-meta">
          <div class="meta-item">
            <span class="meta-label">Created:</span>
            <span class="meta-value">{{ formatDate(session.createdAt) }}</span>
          </div>
          <div class="meta-item">
            <span class="meta-label">Messages:</span>
            <span class="meta-value">{{ session.messageCount }}</span>
          </div>
          <div v-if="session.workspace" class="meta-item">
            <span class="meta-label">Workspace:</span>
            <span class="meta-value">{{ session.workspace }}</span>
          </div>
        </div>
        <div class="session-actions">
          <button @click="openSession(session.id)" class="btn-primary">
            Open Chat
          </button>
          <button @click="deleteSession(session.id)" class="btn-ghost">
            Delete
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { computed } from 'vue';
import { useRouter } from 'vue-router';
import { useAgentStore } from '@/store/modules/agent';

export default {
  name: 'Sessions',
  setup() {
    const router = useRouter();
    const agentStore = useAgentStore();

    const sessions = computed(() => agentStore.sessions);

    const formatDate = (timestamp) => {
      return new Date(timestamp).toLocaleString();
    };

    const createNewSession = async () => {
      const session = await agentStore.createSession();
      router.push(`/chat/${session.id}`);
    };

    const openSession = (sessionId) => {
      router.push(`/chat/${sessionId}`);
    };

    const deleteSession = async (sessionId) => {
      if (confirm('Are you sure you want to delete this session?')) {
        await agentStore.deleteSession(sessionId);
      }
    };

    return {
      sessions,
      formatDate,
      createNewSession,
      openSession,
      deleteSession,
    };
  },
};
</script>

<style scoped>
.sessions-view {
  max-width: 1400px;
  margin: 0 auto;
}

.sessions-header {
  margin-bottom: var(--spacing-xl);
}

.sessions-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
  gap: var(--spacing-lg);
}

.session-card {
  padding: var(--spacing-xl);
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
}

.session-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-bottom: var(--spacing-md);
  border-bottom: 1px solid var(--glass-border);
}

.session-id {
  font-family: var(--font-family-mono);
  font-size: var(--font-size-lg);
  font-weight: 600;
  color: var(--color-text-primary);
}

.session-meta {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
}

.meta-item {
  display: flex;
  justify-content: space-between;
  font-size: var(--font-size-sm);
}

.meta-label {
  color: var(--color-text-secondary);
  font-weight: 500;
}

.meta-value {
  color: var(--color-text-primary);
  font-family: var(--font-family-mono);
}

.session-actions {
  display: flex;
  gap: var(--spacing-sm);
  margin-top: var(--spacing-md);
}

.session-actions button {
  flex: 1;
}

.empty-state {
  max-width: 600px;
  margin: var(--spacing-2xl) auto;
  padding: var(--spacing-2xl);
  text-align: center;
}

.empty-icon {
  font-size: 4rem;
  margin-bottom: var(--spacing-lg);
}
</style>
