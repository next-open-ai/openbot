<template>
  <div class="login-view">
    <div class="login-bg" aria-hidden="true" />
    <div class="login-card">
      <div class="login-header">
        <div class="login-logo-wrap">
          <img src="@/assets/logo.png" alt="OpenBot" class="login-logo" />
        </div>
        <h1 class="login-title">{{ t('login.title') }}</h1>
        <p class="login-subtitle">{{ t('login.subtitle') }}</p>
      </div>
      <form class="login-form" @submit.prevent="submit">
        <div class="form-group">
          <label for="login-username">{{ t('login.username') }}</label>
          <input
            id="login-username"
            v-model="username"
            type="text"
            class="form-input"
            :placeholder="t('login.usernamePlaceholder')"
            autocomplete="username"
          />
        </div>
        <div class="form-group">
          <label for="login-password">{{ t('login.password') }}</label>
          <input
            id="login-password"
            v-model="password"
            type="password"
            class="form-input"
            :placeholder="t('login.passwordPlaceholder')"
            autocomplete="current-password"
          />
        </div>
        <p v-if="error" class="form-error">{{ error }}</p>
        <button type="submit" class="btn-primary btn-block" :disabled="loading">
          {{ loading ? t('common.loading') : t('login.submit') }}
        </button>
      </form>
      <p class="login-hint">{{ t('login.defaultHint') }}</p>
    </div>
  </div>
</template>

<script>
import { ref } from 'vue';
import { useI18n } from '@/composables/useI18n';
import { useAuthStore } from '@/store/modules/auth';

export default {
  name: 'Login',
  setup() {
    const { t } = useI18n();
    const authStore = useAuthStore();
    const username = ref('');
    const password = ref('');
    const error = ref('');
    const loading = ref(false);

    async function submit() {
      error.value = '';
      loading.value = true;
      try {
        await authStore.login(username.value, password.value);
      } catch (e) {
        const msg = e.response?.data?.message ?? e.message ?? t('login.invalidCredentials');
        error.value = msg;
      } finally {
        loading.value = false;
      }
    }

    return { t, username, password, error, loading, submit };
  },
};
</script>

<style scoped>
.login-view {
  position: fixed;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--spacing-xl);
  z-index: 0;
}

.login-bg {
  position: absolute;
  inset: 0;
  background: linear-gradient(135deg, var(--color-bg-primary) 0%, var(--color-bg-secondary) 50%, var(--color-bg-tertiary) 100%);
  opacity: 0.98;
}

.login-bg::before {
  content: '';
  position: absolute;
  inset: 0;
  background-image: radial-gradient(circle at 20% 30%, rgba(99, 102, 241, 0.08) 0%, transparent 50%),
    radial-gradient(circle at 80% 70%, rgba(99, 102, 241, 0.06) 0%, transparent 45%);
  pointer-events: none;
}

.login-card {
  position: relative;
  width: 100%;
  max-width: 400px;
  padding: var(--spacing-2xl) var(--spacing-3xl);
  border-radius: 20px;
  border: 1px solid var(--glass-border);
  background: var(--color-bg-primary);
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.2), 0 0 0 1px rgba(255, 255, 255, 0.05) inset;
}

.login-header {
  text-align: center;
  margin-bottom: var(--spacing-2xl);
}

.login-logo-wrap {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 80px;
  height: 80px;
  margin-bottom: var(--spacing-lg);
  border-radius: 20px;
  background: linear-gradient(145deg, var(--color-bg-elevated), var(--color-bg-tertiary));
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.1);
}

.login-logo {
  width: 48px;
  height: 48px;
  object-fit: contain;
}

.login-title {
  font-size: 1.75rem;
  font-weight: 700;
  margin: 0 0 var(--spacing-xs) 0;
  color: var(--color-text-primary);
  letter-spacing: -0.02em;
}

.login-subtitle {
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
  margin: 0;
}

.login-form {
  margin-bottom: var(--spacing-lg);
}

.form-group {
  margin-bottom: var(--spacing-md);
}

.form-group label {
  display: block;
  font-size: var(--font-size-sm);
  font-weight: 500;
  color: var(--color-text-secondary);
  margin-bottom: var(--spacing-xs);
}

.form-input {
  width: 100%;
  padding: 12px 14px;
  border: 1px solid var(--glass-border);
  border-radius: 12px;
  background: var(--color-bg-secondary);
  color: var(--color-text-primary);
  font-size: var(--font-size-base);
  transition: border-color 0.2s, box-shadow 0.2s;
}

.form-input::placeholder {
  color: var(--color-text-tertiary);
}

.form-input:focus {
  outline: none;
  border-color: var(--color-accent-primary);
  box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.15);
}

.form-error {
  color: var(--color-error, #e53e3e);
  font-size: var(--font-size-sm);
  margin: 0 0 var(--spacing-md) 0;
  padding: var(--spacing-sm);
  background: rgba(229, 62, 62, 0.08);
  border-radius: 8px;
}

.btn-block {
  width: 100%;
  margin-top: var(--spacing-sm);
  padding: 12px;
  font-weight: 600;
  border-radius: 12px;
}

.login-hint {
  font-size: var(--font-size-xs);
  color: var(--color-text-tertiary);
  margin: 0;
  text-align: center;
  line-height: 1.4;
}
</style>
