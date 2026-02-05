<template>
  <div class="skills-view">
    <div v-if="loading && !skills.length" class="loading-state">
      <div class="spinner"></div>
      <p>{{ t('common.loading') }}</p>
    </div>

    <div v-else-if="skills.length === 0" class="empty-state card-glass">
      <div class="empty-icon">🎯</div>
      <h3>{{ t('skills.noSkills') }}</h3>
      <p class="text-secondary">{{ t('skills.noSkillsHint') }}</p>
    </div>

    <div v-else class="skills-content">
      <div v-for="(categorySkills, category) in skillsByCategory" :key="category" class="skill-category-section">
        <h2 class="category-title">{{ category }}</h2>
        <div class="skills-grid">
          <SkillCard
            v-for="skill in categorySkills"
            :key="skill.name"
            :skill="skill"
            @click="selectSkill(skill.name)"
          />
        </div>
      </div>

      <!-- Skill Detail Modal -->
      <transition name="fade">
        <div v-if="selectedSkill" class="skill-modal-backdrop" @click.self="closeSkill">
          <div class="modal-content card-glass">
            <div class="modal-header">
              <div class="modal-title-group">
                <div class="skill-icon-large">
                  <span v-if="selectedSkill.icon">{{ selectedSkill.icon }}</span>
                  <span v-else>🎯</span>
                </div>
                <div>
                  <h2>{{ selectedSkill.name }}</h2>
                  <div class="modal-badges">
                    <span class="badge badge-info">{{ selectedSkill.category || 'Uncategorized' }}</span>
                    <span v-if="selectedSkill.workspace" class="badge badge-secondary">{{ selectedSkill.workspace }}</span>
                  </div>
                </div>
              </div>
              <button @click="closeSkill" class="close-btn btn-ghost" :title="t('common.close')">✕</button>
            </div>
            
            <div class="modal-body">
              <div v-if="loadingContent" class="loading-content">
                <div class="spinner"></div>
              </div>
              <div v-else-if="skillContent" class="skill-documentation markdown-body" v-html="renderedContent"></div>
              <div v-else class="no-content">
                <p>{{ t('skills.noDocumentation') }}</p>
              </div>
            </div>
          </div>
        </div>
      </transition>
    </div>
  </div>
</template>

<script>
import { computed, onMounted, ref, watch } from 'vue';
import { useSkillStore } from '@/store/modules/skill';
import { marked } from 'marked';
import { useI18n } from '@/composables/useI18n';
import SkillCard from '@/components/SkillCard.vue';

export default {
  name: 'Skills',
  components: {
    SkillCard,
  },
  setup() {
    const skillStore = useSkillStore();
    const { t } = useI18n();
    const loadingContent = ref(false);

    const skills = computed(() => skillStore.skills);
    const skillsByCategory = computed(() => skillStore.skillsByCategory);
    const selectedSkill = computed(() => skillStore.selectedSkill);
    const skillContent = computed(() => skillStore.skillContent);
    const loading = computed(() => skillStore.loading);

    const renderedContent = computed(() => {
      if (skillContent.value) {
        return marked(skillContent.value);
      }
      return '';
    });

    const selectSkill = async (name) => {
      loadingContent.value = true;
      await skillStore.selectSkill(name);
      loadingContent.value = false;
    };

    const closeSkill = () => {
      skillStore.clearSelection();
    };

    onMounted(() => {
      skillStore.fetchSkills();
    });

    return {
      t,
      skills,
      skillsByCategory,
      selectedSkill,
      skillContent,
      loading,
      loadingContent,
      renderedContent,
      selectSkill,
      closeSkill,
    };
  },
};
</script>

<style scoped>
.skills-view {
  max-width: 1200px;
  margin: 0 auto;
  padding-bottom: var(--spacing-2xl);
}

.loading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: var(--spacing-2xl);
  gap: var(--spacing-md);
  min-height: 400px;
}

.spinner {
  width: 40px;
  height: 40px;
  border: 3px solid var(--color-bg-elevated);
  border-top-color: var(--color-accent-primary);
  border-radius: 50%;
  animation: spin 1s linear infinite;
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

.skill-category-section {
  margin-bottom: var(--spacing-2xl);
}

.category-title {
  font-size: var(--font-size-xl);
  font-weight: 600;
  margin-bottom: var(--spacing-lg);
  color: var(--color-text-primary);
  display: flex;
  align-items: center;
}

.category-title::before {
  content: '';
  display: block;
  width: 4px;
  height: 24px;
  background: var(--color-accent-primary);
  margin-right: var(--spacing-md);
  border-radius: var(--radius-sm);
}

.skills-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: var(--spacing-lg);
}

/* Modal Styles */
.skill-modal-backdrop {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: var(--z-modal);
  padding: var(--spacing-lg);
}

.modal-content {
  width: 100%;
  max-width: 900px;
  height: 85vh;
  display: flex;
  flex-direction: column;
  background: var(--color-bg-primary);
  box-shadow: var(--shadow-2xl);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-xl);
  overflow: hidden;
}

.modal-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  padding: var(--spacing-xl);
  background: var(--color-bg-secondary);
  border-bottom: 1px solid var(--glass-border);
}

.modal-title-group {
  display: flex;
  gap: var(--spacing-lg);
}

.skill-icon-large {
  width: 64px;
  height: 64px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 2.5rem;
  background: var(--color-bg-elevated);
  border-radius: var(--radius-lg);
  border: 1px solid var(--glass-border);
}

.modal-header h2 {
  font-size: var(--font-size-2xl);
  margin-bottom: var(--spacing-xs);
  color: var(--color-text-primary);
}

.modal-badges {
  display: flex;
  gap: var(--spacing-sm);
}

.close-btn {
  font-size: 1.5rem;
  padding: var(--spacing-xs) var(--spacing-sm);
  color: var(--color-text-secondary);
  border-radius: var(--radius-md);
  transition: all var(--transition-fast);
}

.close-btn:hover {
  background: var(--color-bg-tertiary);
  color: var(--color-text-primary);
}

.modal-body {
  flex: 1;
  overflow-y: auto;
  padding: var(--spacing-xl) var(--spacing-2xl);
}

.loading-content {
  display: flex;
  justify-content: center;
  padding: var(--spacing-2xl);
}

.skill-documentation {
  color: var(--color-text-primary);
  line-height: 1.6;
}

/* Markdown Styles Override */
.skill-documentation :deep(h1) {
  font-size: 2em;
  border-bottom: 1px solid var(--glass-border);
  padding-bottom: 0.3em;
  margin-top: 0;
  margin-bottom: 1em;
}

.skill-documentation :deep(h2) {
  font-size: 1.5em;
  margin-top: 1.5em;
  margin-bottom: 1em;
}

.skill-documentation :deep(p) {
  margin-bottom: 1em;
}

.skill-documentation :deep(ul), 
.skill-documentation :deep(ol) {
  padding-left: 2em;
  margin-bottom: 1em;
}

.skill-documentation :deep(code) {
  background: var(--color-bg-tertiary);
  padding: 0.2em 0.4em;
  border-radius: var(--radius-sm);
  font-family: var(--font-family-mono);
  font-size: 0.9em;
}

.skill-documentation :deep(pre) {
  background: var(--color-bg-tertiary);
  padding: var(--spacing-md);
  border-radius: var(--radius-md);
  overflow-x: auto;
  margin: 1.5em 0;
}

.skill-documentation :deep(pre code) {
  background: transparent;
  padding: 0;
  font-size: 0.9em;
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
