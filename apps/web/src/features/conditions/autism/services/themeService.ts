import { createLocalDeviceStore, LocalDeviceStore } from "../../../wellness-ui";
import type { AutismThemeKey, ThemeDefinition } from "../types";

export interface ThemeService {
  /** Retrieves currently saved theme choice. */
  getSelectedTheme(): Promise<AutismThemeKey>;
  /** Updates saved theme choice on this device. */
  saveTheme(theme: AutismThemeKey): Promise<void>;
}

const STORE_KEY = "autism.theme";

export const THEME_DEFINITIONS: Record<AutismThemeKey, ThemeDefinition> = {
  calm: {
    key: "calm",
    label: "Gentle Calm",
    icon: "🌱",
    description: "Standard botanical palette with soothing neutral tones.",
    cssVariables: {
      "--theme-bg": "#FAF7F2",
      "--theme-surface": "#FFFFFF",
      "--theme-border": "#E8EFE0",
      "--theme-accent": "#5C713F",
      "--theme-accent-soft": "#F4F7EE",
      "--theme-text": "#1C2826",
      "--theme-text-muted": "#606D69",
    },
  },
  space: {
    key: "space",
    label: "Deep Space",
    icon: "🚀",
    description: "Cosmic deep indigo and soft nebula tones with high contrast.",
    cssVariables: {
      "--theme-bg": "#141726",
      "--theme-surface": "#1F233A",
      "--theme-border": "#31385B",
      "--theme-accent": "#8AA7FF",
      "--theme-accent-soft": "#282E4D",
      "--theme-text": "#F3F5FA",
      "--theme-text-muted": "#A2AAC2",
    },
  },
  animals: {
    key: "animals",
    label: "Friendly Safari",
    icon: "🦁",
    description: "Warm meadow, fawn, and gentle woodland earth tones.",
    cssVariables: {
      "--theme-bg": "#FBF8F1",
      "--theme-surface": "#FFFFFF",
      "--theme-border": "#E8DFCF",
      "--theme-accent": "#9E5A2A",
      "--theme-accent-soft": "#F7EFE3",
      "--theme-text": "#2C2219",
      "--theme-text-muted": "#756555",
    },
  },
  trains: {
    key: "trains",
    label: "Steam Trains",
    icon: "🚂",
    description: "Classic railway steel blue and quiet carriage slate.",
    cssVariables: {
      "--theme-bg": "#F3F5F7",
      "--theme-surface": "#FFFFFF",
      "--theme-border": "#D2D9E0",
      "--theme-accent": "#2B526D",
      "--theme-accent-soft": "#E4ECF2",
      "--theme-text": "#1A2530",
      "--theme-text-muted": "#5A6A78",
    },
  },
  nature: {
    key: "nature",
    label: "Forest Walk",
    icon: "🌲",
    description: "Lush botanical moss and pine needle greens.",
    cssVariables: {
      "--theme-bg": "#F4F7F2",
      "--theme-surface": "#FFFFFF",
      "--theme-border": "#CFDDC7",
      "--theme-accent": "#385E2F",
      "--theme-accent-soft": "#E5EDE1",
      "--theme-text": "#192816",
      "--theme-text-muted": "#566B53",
    },
  },
  ocean: {
    key: "ocean",
    label: "Tide Pool",
    icon: "🐋",
    description: "Calm marine teal and sea glass coastal blues.",
    cssVariables: {
      "--theme-bg": "#F1F7F8",
      "--theme-surface": "#FFFFFF",
      "--theme-border": "#C6DFE3",
      "--theme-accent": "#286873",
      "--theme-accent-soft": "#E0EFF2",
      "--theme-text": "#132529",
      "--theme-text-muted": "#546E73",
    },
  },
};

/**
 * Pure rule resolving the active theme:
 * Whenever low-sensory / reduced motion is active, ALWAYS overrides any custom
 * special-interest theme to the standard "calm" theme.
 */
export function resolveActiveTheme(
  selectedTheme: AutismThemeKey,
  isLowSensory: boolean
): AutismThemeKey {
  if (isLowSensory) {
    return "calm";
  }
  return selectedTheme in THEME_DEFINITIONS ? selectedTheme : "calm";
}

/**
 * Local device implementation storing theme selection in localStorage.
 * Shows a visible DeviceOnlyNote in the UI; never fakes cloud persistence.
 */
export class LocalThemeService implements ThemeService {
  private readonly store: LocalDeviceStore<AutismThemeKey>;

  constructor(customStore?: LocalDeviceStore<AutismThemeKey>) {
    this.store =
      customStore ??
      createLocalDeviceStore<AutismThemeKey>(STORE_KEY, {
        validator: (t): t is AutismThemeKey => typeof t === "string" && t in THEME_DEFINITIONS,
      });
  }

  public async getSelectedTheme(): Promise<AutismThemeKey> {
    return this.store.get("calm");
  }

  public async saveTheme(theme: AutismThemeKey): Promise<void> {
    this.store.set(theme);
  }
}

/**
 * One-line swap point for a future backend API:
 * When Siri's real API is ready, replace `return new LocalThemeService();`
 * with `return new ApiThemeService();`.
 */
export function createThemeService(): ThemeService {
  return new LocalThemeService();
}
