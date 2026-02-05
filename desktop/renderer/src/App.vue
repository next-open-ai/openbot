<template>
  <div id="app" class="app-container">
    <Sidebar />
    <div class="main-content">
      <Header />
      <div class="content-area" :class="{ 'chat-full-height': isChatRoute }">
        <router-view v-slot="{ Component }">
          <transition name="fade" mode="out-in">
            <component :is="Component" />
          </transition>
        </router-view>
      </div>
    </div>
  </div>
</template>

<script>
import { onMounted, computed } from 'vue';
import { useRoute } from 'vue-router';
import Sidebar from './components/Sidebar.vue';
import Header from './components/Header.vue';
import { useSettingsStore } from './store/modules/settings';
import { useAgentStore } from './store/modules/agent';

export default {
  name: 'App',
  components: {
    Sidebar,
    Header,
  },
  setup() {
    const route = useRoute();
    const settingsStore = useSettingsStore();
    const agentStore = useAgentStore();

    const isChatRoute = computed(() => route.name === 'AgentChat');

    onMounted(async () => {
      await settingsStore.loadConfig();
      await settingsStore.loadProviders();
      await agentStore.fetchSessions();
    });

    return { isChatRoute };
  },
};
</script>

<style scoped>
.app-container {
  display: flex;
  width: 100%;
  height: 100%;
  overflow: hidden;
}

.main-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.content-area {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  padding: var(--spacing-lg);
  background: var(--color-bg-primary);
}

/* 聊天页：只传递尺寸，不设 flex-direction，避免覆盖 AgentChat 的 row 布局（会话列 | 对话区 左右排列） */
.content-area.chat-full-height {
  padding: var(--spacing-md);
  height: 100%;
  min-width: 0;
}
.content-area.chat-full-height > * {
  flex: 1;
  min-height: 0;
  min-width: 0;
  width: 100%;
  height: 100%;
  overflow: hidden;
}
.content-area.chat-full-height > * > * {
  flex: 1;
  min-height: 0;
  min-width: 0;
  width: 100%;
  height: 100%;
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity var(--transition-base);
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
