import { useCallback, useState } from "react";
import { createLocalDeviceStore } from "../wellness-ui";
import { isToolTheme, type ToolTheme } from "./toolThemes";

// An Individual's tools theme, kept on this device for this person (cleared
// on sign-out, like their other tool preferences).
const store = createLocalDeviceStore<ToolTheme>("tools.theme", { validator: isToolTheme });

export function useToolTheme(): [ToolTheme, (theme: ToolTheme) => void] {
  const [theme, setTheme] = useState<ToolTheme>(() => store.get("calm"));
  const choose = useCallback((next: ToolTheme) => {
    setTheme(next);
    store.set(next);
  }, []);
  return [theme, choose];
}
