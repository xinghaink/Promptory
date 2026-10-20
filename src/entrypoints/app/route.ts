import { useEffect, useState } from 'react';

export type Nav =
  | { kind: 'all' }
  | { kind: 'inbox' }
  | { kind: 'favorites' }
  | { kind: 'recent' }
  | { kind: 'trash' }
  | { kind: 'folder'; id: string }
  | { kind: 'tag'; tag: string };

export type Route =
  | { page: 'library'; nav: Nav; welcome?: boolean; useId?: string }
  | { page: 'edit'; id: string }
  | { page: 'new'; folderId?: string }
  | { page: 'history'; id: string };

export function parseHash(hash: string): Route {
  const parts = hash.replace(/^#\/?/, '').split('/').map(decodeURIComponent);
  const [head, arg] = parts;
  switch (head) {
    case 'edit':
      if (arg) return { page: 'edit', id: arg };
      break;
    case 'new':
      return { page: 'new', folderId: arg || undefined };
    case 'history':
      if (arg) return { page: 'history', id: arg };
      break;
    case 'use':
      if (arg) return { page: 'library', nav: { kind: 'all' }, useId: arg };
      break;
    case 'welcome':
      return { page: 'library', nav: { kind: 'all' }, welcome: true };
    case 'inbox':
    case 'favorites':
    case 'recent':
    case 'trash':
      return { page: 'library', nav: { kind: head } };
    case 'folder':
      if (arg) return { page: 'library', nav: { kind: 'folder', id: arg } };
      break;
    case 'tag':
      if (arg) return { page: 'library', nav: { kind: 'tag', tag: arg } };
      break;
  }
  return { page: 'library', nav: { kind: 'all' } };
}

export function navHash(nav: Nav): string {
  switch (nav.kind) {
    case 'all':
      return '/';
    case 'folder':
      return `/folder/${encodeURIComponent(nav.id)}`;
    case 'tag':
      return `/tag/${encodeURIComponent(nav.tag)}`;
    default:
      return `/${nav.kind}`;
  }
}

export function go(path: string): void {
  location.hash = path;
}

export function useRoute(): Route {
  const [route, setRoute] = useState(() => parseHash(location.hash));
  useEffect(() => {
    const onChange = () => setRoute(parseHash(location.hash));
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);
  return route;
}
