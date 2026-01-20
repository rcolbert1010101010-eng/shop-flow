import { useEffect, useMemo, useState } from 'react';

export type ThemeOption = 'light' | 'dark' | 'system';

const STORAGE_KEY = 'theme';

const getInitialTheme = (): ThemeOption => {
  if (typeof window === 'undefined') return 'system';
  const stored = window.localStorage.getItem(STORAGE_KEY) as ThemeOption | null;
  return stored === 'light' || stored === 'dark' || stored === 'system' ? stored : 'system';
};

const resolveTheme = (theme: ThemeOption): 'light' | 'dark' => {
  if (theme === 'light' || theme === 'dark') return theme;
  const prefersDark = typeof window !== 'undefined' && window.matchMedia
    ? window.matchMedia('(prefers-color-scheme: dark)').matches
    : false;
  return prefersDark ? 'dark' : 'light';
};

const applyTheme = (theme: ThemeOption) => {
  if (typeof document === 'undefined') return;
  const resolved = resolveTheme(theme);
  const shouldUseDark = resolved === 'dark';
  document.documentElement.classList.toggle('dark', shouldUseDark);
  document.documentElement.style.colorScheme = resolved;
};

export function useTheme() {
  const [theme, setThemeState] = useState<ThemeOption>(() => getInitialTheme());

  const setTheme = (next: ThemeOption) => {
    setThemeState(next);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(STORAGE_KEY, next);
    }
    applyTheme(next);
  };

  const systemMatcher = useMemo(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return null;
    return window.matchMedia('(prefers-color-scheme: dark)');
  }, []);

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  useEffect(() => {
    if (!systemMatcher) return;
    if (theme !== 'system') return;
    const handler = () => applyTheme('system');
    systemMatcher.addEventListener('change', handler);
    return () => systemMatcher.removeEventListener('change', handler);
  }, [systemMatcher, theme]);

  const resolvedTheme = resolveTheme(theme);

  return { theme, setTheme, resolvedTheme };
}
