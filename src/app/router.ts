// mobile/src/app/router.ts — hash 路由（无第三方依赖）

import { useEffect, useState } from 'react';

export type RouteName =
  | 'sessions' | 'chat' | 'tasks' | 'files' | 'settings'
  | 'models' | 'logs' | 'plugins' | 'history' | 'notifications' | 'account' | 'pair';

export interface Route { name: RouteName; param?: string }

function parse(hash: string): Route {
  const [, name, param] = hash.replace(/^#\/?/, '').split('/');
  const known: RouteName[] = ['sessions', 'chat', 'tasks', 'files', 'settings', 'models', 'logs', 'plugins', 'history', 'notifications', 'account', 'pair'];
  return { name: (known.includes(name as RouteName) ? name : 'sessions') as RouteName, param };
}

export function navigate(name: RouteName, param?: string): void {
  location.hash = `#/${name}${param ? `/${param}` : ''}`;
}

export function useRoute(): Route {
  const [route, setRoute] = useState<Route>(() => parse(location.hash));
  useEffect(() => {
    const onHash = () => setRoute(parse(location.hash));
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);
  return route;
}
