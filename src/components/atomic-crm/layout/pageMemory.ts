import { useCallback, useState } from "react";
import { useLocation } from "react-router";

const PREFIX = "lab.page.";

const read = <T>(key: string, fallback: T): T => {
  try {
    const raw = localStorage.getItem(key);
    return raw == null ? fallback : (JSON.parse(raw) as T);
  } catch {
    return fallback;
  }
};

/**
 * State that survives leaving the page: the tab you were on, a toggle you
 * flipped. It is kept per page address, so coming back (or reopening the app)
 * finds it as you left it, and a different customer starts fresh.
 */
export const usePageMemory = <T>(
  name: string,
  initial: T,
): [T, (value: T) => void] => {
  const { pathname } = useLocation();
  const key = `${PREFIX}${pathname}.${name}`;
  const [value, setValue] = useState<T>(() => read(key, initial));
  const update = useCallback(
    (next: T) => {
      setValue(next);
      try {
        localStorage.setItem(key, JSON.stringify(next));
      } catch {
        // Private mode or a full store: the choice just is not remembered
      }
    },
    [key],
  );
  return [value, update];
};
