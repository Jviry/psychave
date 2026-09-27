'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

interface RouterContextValue {
  pathname: string;
  navigate: (href: string) => void;
  params: Record<string, string>;
}

const RouterContext = createContext<RouterContextValue>({
  pathname: '/',
  navigate: () => {},
  params: {},
});

function extractParams(pathname: string): Record<string, string> {
  if (pathname.startsWith('/proposal/')) {
    const id = pathname.replace('/proposal/', '').split('/')[0];
    return { id: id || 'BK-2026-102' };
  }
  return {};
}

export function PrototypeRouterProvider({ children }: { children: React.ReactNode }) {
  const [pathname, setPathname] = useState<string>(() => {
    if (typeof window !== 'undefined' && window.location.pathname) {
      return window.location.pathname === '' ? '/' : window.location.pathname;
    }
    return '/';
  });

  useEffect(() => {
    const handlePopState = () => {
      setPathname(window.location.pathname || '/');
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const navigate = useCallback((href: string) => {
    setPathname(href);
    if (typeof window !== 'undefined') {
      try {
        window.history.pushState({}, '', href);
        window.scrollTo({ top: 0, behavior: 'smooth' });
      } catch {
        // Ignore history push restrictions inside sandboxed iframes
      }
    }
  }, []);

  const params = extractParams(pathname);

  return (
    <RouterContext.Provider value={{ pathname, navigate, params }}>
      {children}
    </RouterContext.Provider>
  );
}

export function useAppRouter() {
  return useContext(RouterContext);
}

export function AppLink({
  href,
  children,
  className = '',
  onClick,
}: {
  href: string;
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
}) {
  const { navigate } = useAppRouter();
  return (
    <a
      href={href}
      onClick={(e) => {
        e.preventDefault();
        if (onClick) onClick();
        navigate(href);
      }}
      className={className}
    >
      {children}
    </a>
  );
}
