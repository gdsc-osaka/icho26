import { useCallback, useSyncExternalStore } from "react";

const listeners = new Map<string, Set<() => void>>();

function notify(key: string) {
  listeners.get(key)?.forEach((cb) => cb());
}

function subscribeFor(key: string) {
  return (cb: () => void) => {
    let perKey = listeners.get(key);
    if (!perKey) {
      perKey = new Set();
      listeners.set(key, perKey);
    }
    perKey.add(cb);
    const onStorage = (e: StorageEvent) => {
      if (e.key === key) cb();
    };
    window.addEventListener("storage", onStorage);
    return () => {
      perKey?.delete(cb);
      window.removeEventListener("storage", onStorage);
    };
  };
}

export function useLocalStorageNumber(
  key: string,
  defaultValue: number,
): [number, (next: number) => void] {
  const subscribe = useCallback(subscribeFor(key), [key]);
  const getSnapshot = useCallback(() => {
    const stored = window.localStorage.getItem(key);
    if (stored === null) return defaultValue;
    const parsed = Number(stored);
    return Number.isFinite(parsed) ? parsed : defaultValue;
  }, [key, defaultValue]);
  const getServerSnapshot = useCallback(() => defaultValue, [defaultValue]);

  const value = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const setValue = useCallback(
    (next: number) => {
      window.localStorage.setItem(key, String(next));
      notify(key);
    },
    [key],
  );

  return [value, setValue];
}
