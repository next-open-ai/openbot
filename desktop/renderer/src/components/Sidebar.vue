<template>
  <div class="sidebar">
    <div class="sidebar-header">
      <div class="logo" :title="'OpenBot'">
        <img src="@/assets/logo.png" alt="OpenBot" class="logo-image" />
      </div>
    </div>

    <nav class="sidebar-nav">
      <router-link
        v-for="item in navItems"
        :key="item.path"
        :to="item.path"
        class="nav-item"
        :class="{ active: isActive(item.path) }"
        :title="item.label"
      >
        <span class="nav-icon" aria-hidden="true">
          <component :is="item.iconComponent" />
        </span>
        <span class="nav-label">{{ item.label }}</span>
      </router-link>
    </nav>

    <div class="sidebar-footer">
      <router-link
        to="/settings"
        class="nav-item"
        :class="{ active: isActive('/settings') }"
        :title="t('nav.settings')"
      >
        <span class="nav-icon" aria-hidden="true">
          <IconSettings />
        </span>
        <span class="nav-label">{{ t('nav.settings') }}</span>
      </router-link>
    </div>
  </div>
</template>

<script>
import { computed } from 'vue';
import { useRoute } from 'vue-router';
import { useI18n } from '@/composables/useI18n';
import IconChat from '@/components/icons/IconChat.vue';
import IconAgents from '@/components/icons/IconAgents.vue';
import IconSkills from '@/components/icons/IconSkills.vue';
import IconSettings from '@/components/icons/IconSettings.vue';

export default {
  name: 'Sidebar',
  components: { IconChat, IconAgents, IconSkills, IconSettings },
  setup() {
    const route = useRoute();
    const { t } = useI18n();

    const navItems = computed(() => [
      { path: '/chat', label: t('nav.agentChat'), iconComponent: IconChat },
      { path: '/agents', label: t('nav.agents'), iconComponent: IconAgents },
      { path: '/skills', label: t('nav.skills'), iconComponent: IconSkills },
    ]);

    const isActive = (path) => {
      if (path === '/') return route.path === '/';
      return route.path.startsWith(path);
    };

    return {
      navItems,
      isActive,
      t,
    };
  },
};
</script>

<style scoped>
/* 放宽以容纳顶部窗口控制按钮（如 macOS 红黄绿） */
.sidebar {
  width: 80px;
  min-width: 80px;
  height: 100%;
  background: var(--color-bg-secondary);
  border-right: 1px solid var(--glass-border);
  display: flex;
  flex-direction: column;
  padding: 40px var(--spacing-sm) var(--spacing-md); /* Top padding for window controls */
  align-items: center;
  gap: var(--spacing-xl);
}

.sidebar-header {
  margin-bottom: var(--spacing-sm);
  display: flex;
  justify-content: center;
  width: 100%;
}

.logo {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 48px;
  height: 48px;
  border-radius: var(--radius-lg);
  background: linear-gradient(135deg, rgba(255, 255, 255, 0.1), rgba(255, 255, 255, 0.05));
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  overflow: hidden;
  transition: transform 0.3s ease;
}

.logo:hover {
  transform: scale(1.05);
  box-shadow: 0 6px 16px rgba(100, 100, 255, 0.2);
}

.logo-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.sidebar-nav {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
  width: 100%;
  align-items: center;
}

.nav-item {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  padding: 0;
  border-radius: var(--radius-md);
  color: var(--color-text-secondary);
  text-decoration: none;
  transition: all var(--transition-fast);
  position: relative;
}

.nav-item:hover,
.nav-item.active {
  background: var(--color-bg-elevated);
  color: var(--color-accent-primary);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
}

.nav-item.active::after {
  content: '';
  position: absolute;
  left: -10px;
  width: 4px;
  height: 20px;
  background: var(--color-accent-primary);
  border-radius: 0 4px 4px 0;
}

.nav-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 1.25rem;
  height: 1.25rem;
  line-height: 0;
}

.nav-label {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

.sidebar-footer {
  padding-top: var(--spacing-md);
  border-top: 1px solid var(--glass-border);
  width: 100%;
  display: flex;
  justify-content: center;
}
</style>
