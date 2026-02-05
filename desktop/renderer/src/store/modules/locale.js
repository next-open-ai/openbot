import { defineStore } from 'pinia';
import zh from '@/locales/zh';
import en from '@/locales/en';

const STORAGE_KEY = 'openbot-locale';
const messages = { zh, en };

function getStoredLocale() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'zh' || stored === 'en') return stored;
  } catch (_) {}
  return 'zh';
}

export const useLocaleStore = defineStore('locale', {
  state: () => ({
    locale: getStoredLocale(),
  }),

  getters: {
    messages: (state) => messages[state.locale] || zh,
    /** 当前语言显示名 */
    localeLabel: (state) => (state.locale === 'zh' ? '中文' : 'English'),
  },

  actions: {
    setLocale(locale) {
      if (locale !== 'zh' && locale !== 'en') return;
      this.locale = locale;
      try {
        localStorage.setItem(STORAGE_KEY, locale);
      } catch (_) {}
    },
    /** 根据 key 取文案，key 如 'nav.dashboard' */
    t(key) {
      const msg = this.messages;
      const value = key.split('.').reduce((o, k) => (o != null ? o[k] : undefined), msg);
      return value != null ? value : key;
    },
  },
});
