import { useSyncExternalStore, type AnchorHTMLAttributes, type MouseEvent } from 'react';

export type Route = '/' | '/signin' | '/studio' | '/history';
const routes: Route[] = ['/', '/signin', '/studio', '/history'];
const listeners = new Set<() => void>();
const emit = () => listeners.forEach(l => l());
if (typeof window !== 'undefined') window.addEventListener('popstate', emit);

function subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; }
const current = (): Route => {
  const path = window.location.pathname.replace(/\/+$/, '') || '/';
  return routes.includes(path as Route) ? path as Route : '/';
};

export function navigate(to: Route, { replace = false } = {}) {
  if (to === current() && !window.location.hash) return;
  window.history[replace ? 'replaceState' : 'pushState'](null, '', to);
  window.scrollTo(0, 0);
  emit();
}

export const useRoute = () => useSyncExternalStore(subscribe, current, () => '/' as Route);

export function Link({ to, onClick, ...props }: AnchorHTMLAttributes<HTMLAnchorElement> & { to: Route }) {
  return <a href={to} {...props} onClick={(e: MouseEvent<HTMLAnchorElement>) => {
    onClick?.(e);
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    navigate(to);
  }}/>;
}
