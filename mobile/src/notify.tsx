import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { Banner } from './ui';

type Kind = 'ok' | 'error' | 'info';
const NotifyCtx = createContext<(kind: Kind, text: string) => void>(() => {});
export const useNotify = () => useContext(NotifyCtx);

export function NotifyProvider({ children }: { children: React.ReactNode }) {
  const [msg, setMsg] = useState<{ kind: Kind; text: string } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const notify = useCallback((kind: Kind, text: string) => {
    setMsg({ kind, text });
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setMsg(null), kind === 'error' ? 8000 : 4000);
  }, []);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  return (
    <NotifyCtx.Provider value={notify}>
      {msg ? <Banner kind={msg.kind} text={msg.text} onClose={() => setMsg(null)} /> : null}
      {children}
    </NotifyCtx.Provider>
  );
}
