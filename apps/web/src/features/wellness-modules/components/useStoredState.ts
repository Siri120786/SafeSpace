import { useCallback, useEffect, useRef, useState } from "react";
import { readJson, writeJson } from "../lib/deviceStore";

/**
 * State that is kept on this device only (browser storage). Bad or missing data falls back to
 * `fallback`. `saveFailed` becomes true when the browser would not store it, so the screen can say so.
 */
export function useStoredState<T>(key: string, fallback: T, sanitize: (raw: unknown) => T): [T, (next: T) => void, boolean] {
  const [value, setValue] = useState<T>(() => sanitize(readJson<unknown>(key, fallback)));
  const [saveFailed, setSaveFailed] = useState(false);
  const first = useRef(true);

  useEffect(() => {
    // Do not write on the first render: nothing has changed yet.
    if (first.current) {
      first.current = false;
      return;
    }
    setSaveFailed(!writeJson(key, value));
  }, [key, value]);

  const set = useCallback((next: T) => setValue(next), []);
  return [value, set, saveFailed];
}
