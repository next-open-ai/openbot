<template>
  <div class="agent-chat">
    <!-- Left Panel: Chat Sessions -->
    <ChatSessionsPanel
      :visible="sessionsPanelVisible"
      :sessions="sessions"
      :current-session-id="currentSession?.id ?? routeSessionId"
      @create="createNewSession"
      @select="selectSession"
    />

    <!-- Right Panel: Chat Area -->
    <div class="chat-container">
      <!-- Messages Area -->
      <div class="messages-area" ref="messagesContainer">
        <!-- Virtual Session State: No session active -->
        <div v-if="!currentSession" class="empty-chat">
          <div class="empty-icon">💬</div>
          <h3>{{ t('chat.startConversation') }}</h3>
          <p class="text-secondary">{{ t('chat.startConversationHint') }}</p>
        </div>
        
        <!-- Active Session State -->
        <template v-else>
          <!-- Empty Session History -->
          <div v-if="messages.length === 0" class="empty-chat">
            <div class="empty-icon">💬</div>
            <h3>{{ t('chat.startConversation') }}</h3>
            <p class="text-secondary">{{ t('chat.startConversationHint') }}</p>
          </div>
          
          <!-- Message List -->
          <ChatMessage
            v-for="message in messages"
            :key="message.id"
            :role="message.role"
            :content="message.content"
            :timestamp="message.timestamp"
            :tool-calls="message.toolCalls"
            :content-parts="message.contentParts"
          />

          <!-- Streaming Message -->
          <div v-if="isStreaming || toolExecutions.length > 0" class="streaming-message">
            <ChatMessage
              :role="'assistant'"
              :content="currentMessage || (toolExecutions.length > 0 ? t('chat.thinking') : '')"
              :timestamp="Date.now()"
              :tool-calls="toolExecutions"
              :content-parts="streamContentParts"
            />
          </div>
        </template>
      </div>

      <!-- Input Area -->
      <div class="input-area">
        <div class="input-container">
          <textarea
            v-model="inputMessage"
            @keydown.enter.exact.prevent="sendMessage"
            @keydown.enter.shift.exact="inputMessage += '\n'"
            :placeholder="t('chat.placeholder')"
            class="message-input"
            rows="3"
            :disabled="isStreaming"
          ></textarea>
          <button
            @click="sendMessage"
            :disabled="!inputMessage.trim() || isStreaming"
            class="send-button"
            :title="isStreaming ? t('common.sending') : t('common.send')"
          >
            <svg v-if="!isStreaming" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-6 h-6"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>
            <svg v-else class="pulse" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-6.219-8.56"></path></svg>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, computed, watch, nextTick, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useAgentStore } from '@/store/modules/agent';
import { useUIStore } from '@/store/modules/ui';
import { useI18n } from '@/composables/useI18n';
import ChatMessage from '@/components/ChatMessage.vue';
import ChatSessionsPanel from '@/components/ChatSessionsPanel.vue';
import ToolExecutionCard from '@/components/ToolExecutionCard.vue';

export default {
  name: 'AgentChat',
  components: {
    ChatMessage,
    ChatSessionsPanel,
    ToolExecutionCard,
  },
  setup() {
    const route = useRoute();
    const router = useRouter();
    const agentStore = useAgentStore();
    const uiStore = useUIStore();
    const { t } = useI18n();

    const sessionsPanelVisible = computed(() => uiStore.sessionsPanelVisible);
    const toggleSessionsPanel = () => uiStore.toggleSessionsPanel();
    
    const inputMessage = ref('');
    const messagesContainer = ref(null);

    const routeSessionId = computed(() => route.params.sessionId || null);
    const currentSession = computed(() => agentStore.currentSession);
    const sessions = computed(() => agentStore.sessions);
    const messages = computed(() => agentStore.messages);
    const isStreaming = computed(() => agentStore.isStreaming);
    const currentMessage = computed(() => agentStore.currentMessage);
    const toolExecutions = computed(() => agentStore.toolExecutions);
    const streamContentParts = computed(() => {
      const parts = agentStore.currentStreamParts;
      if (parts && parts.length > 0) return parts;
      const msg = agentStore.currentMessage;
      const tools = agentStore.toolExecutions;
      if (!msg && (!tools || tools.length === 0)) return [];
      const synthetic = [];
      if (msg) synthetic.push({ type: 'text', content: msg });
      if (tools && tools.length) tools.forEach((t) => synthetic.push({ type: 'tool', toolId: t.id }));
      return synthetic;
    });

    const createNewSession = async () => {
        // Virtual Create: Navigate to root (empty state)
        if (route.name !== 'AgentChat' || route.params.sessionId) {
            router.push('/');
        }
        agentStore.clearCurrentSession();
    };

    const selectSession = (sessionId) => {
      router.push(`/chat/${sessionId}`);
    };

    const sendMessage = async () => {
      if (!inputMessage.value.trim() || isStreaming.value) return;
      
      const message = inputMessage.value;
      inputMessage.value = '';
      
      try {
        const session = await agentStore.sendMessage(message);
        if (session && !routeSessionId.value) {
            router.replace(`/chat/${session.id}`);
        }
        await scrollToBottom();
      } catch (e) {
        console.error('Send message failed', e);
      }
    };

    const scrollToBottom = async () => {
      await nextTick();
      if (messagesContainer.value) {
        messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight;
      }
    };

    watch(() => messages.value.length, scrollToBottom);
    watch(() => currentMessage.value, scrollToBottom);

    // Sync Route -> Session
    watch(
      () => route.params.sessionId,
      async (sessionId) => {
        if (sessionId) {
          if (agentStore.currentSession?.id !== sessionId) {
            try {
              await agentStore.selectSession(sessionId);
            } catch (e) {
              console.error('Select session failed', e);
              router.replace('/'); 
            }
          }
        } else {
             agentStore.clearCurrentSession();
        }
      }
    );
    
    // Startup Logic
    onMounted(async () => {
        try {
            if (agentStore.sessions.length === 0) {
                 await agentStore.fetchSessions();
            }

            const sessionId = route.params.sessionId;
            if (sessionId) {
                if (agentStore.currentSession?.id !== sessionId) {
                    await agentStore.selectSession(sessionId);
                }
            } else if (route.path === '/') {
                // Auto-open most recent only on root
                const recent = agentStore.sessions[0];
                if (recent) {
                    router.replace(`/chat/${recent.id}`);
                }
            }
        } catch (e) {
            console.error('AgentChat mount error', e);
        }
    });

    return {
      t,
      routeSessionId,
      sessionsPanelVisible,
      toggleSessionsPanel,
      currentSession,
      sessions,
      messages,
      isStreaming,
      currentMessage,
      toolExecutions,
      streamContentParts,
      inputMessage,
      messagesContainer,
      createNewSession,
      selectSession,
      sendMessage,
      Date,
    };
  },
};
</script>

<style scoped>
.agent-chat {
  flex: 1 1 0%;
  min-height: 0;
  min-width: 0;
  width: 100%;
  max-width: 100%;
  height: 100%;
  display: flex;
  flex-direction: row;
  align-items: stretch;
  overflow: hidden;
}

.chat-container {
  flex: 1 1 0%;
  min-width: 0;
  min-height: 0;
  height: 100%;
  display: flex;
  flex-direction: column;
  max-width: 100%;
  background: var(--color-bg-primary);
}

.messages-area {
  flex: 1 1 0;
  min-height: 0;
  overflow-y: auto;
  padding: var(--spacing-lg) var(--spacing-xl);
  background: var(--color-bg-secondary);
  border-radius: var(--radius-lg) var(--radius-lg) 0 0;
  display: flex;
  flex-direction: column;
}

.empty-chat {
  flex: 1;
  min-height: 200px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  padding: var(--spacing-2xl);
}

.empty-icon {
  font-size: 4rem;
  margin-bottom: var(--spacing-lg);
}

.streaming-message {
  opacity: 0.9;
}

.input-area {
  flex-shrink: 0;
  padding: var(--spacing-lg);
  background: var(--color-bg-secondary);
  border-top: 1px solid var(--glass-border);
  border-radius: 0 0 var(--radius-lg) var(--radius-lg);
}

.input-container {
  display: flex;
  position: relative;
  width: 100%;
}

.message-input {
  width: 100%;
  padding: var(--spacing-md);
  padding-right: 50px;
  font-size: var(--font-size-base);
  font-family: var(--font-family-base);
  color: var(--color-text-primary);
  background: var(--color-bg-tertiary);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-md);
  resize: none;
  outline: none;
  transition: all var(--transition-fast);
}

.message-input:focus {
  border-color: var(--color-accent-primary);
  box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
}

.message-input:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.send-button {
  position: absolute;
  right: var(--spacing-xs);
  bottom: var(--spacing-xs);
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  border: none;
  background: transparent;
  color: var(--color-accent-primary);
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: all var(--transition-fast);
  opacity: 0.8;
}

.send-button:hover:not(:disabled) {
  background: var(--color-bg-elevated);
  opacity: 1;
  transform: scale(1.05);
}

.send-button:disabled {
  opacity: 0.3;
  cursor: not-allowed;
  filter: grayscale(1);
}

.pulse {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
</style>
