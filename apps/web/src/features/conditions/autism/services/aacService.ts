import { getToolsSession } from "../../toolsSession";
import { RemoteAacService } from "./remoteServices";
import { createLocalDeviceStore, LocalDeviceStore } from "../../../wellness-ui";
import type { AacConfig, AacTile } from "../types";

export interface AacService {
  /** Retrieves custom tile label overrides. */
  getConfig(): Promise<AacConfig>;
  /** Customizes the label for a specific tile. */
  setCustomLabel(tileId: string, label: string): Promise<AacConfig>;
  /** Resets all tile labels to default. */
  resetCustomLabels(): Promise<void>;
}

const STORE_KEY = "autism.aac";

export const DEFAULT_AAC_TILES: AacTile[] = [
  { id: "yes", label: "Yes", emoji: "👍", category: "social" },
  { id: "no", label: "No", emoji: "👎", category: "social" },
  { id: "help", label: "Help", emoji: "🙋", category: "needs" },
  { id: "break", label: "Break", emoji: "⏸️", category: "needs" },
  { id: "hungry", label: "Hungry", emoji: "🍎", category: "needs" },
  { id: "thirsty", label: "Thirsty", emoji: "💧", category: "needs" },
  { id: "more", label: "More", emoji: "➕", category: "actions" },
  { id: "all_done", label: "All Done", emoji: "🏁", category: "actions" },
  { id: "happy", label: "Happy", emoji: "😊", category: "feelings" },
  { id: "sad", label: "Sad", emoji: "😢", category: "feelings" },
  { id: "bathroom", label: "Bathroom", emoji: "🚻", category: "needs" },
  { id: "quiet", label: "Quiet Please", emoji: "🤫", category: "needs" },
  { id: "play", label: "Play", emoji: "🧩", category: "actions" },
  { id: "stop", label: "Stop", emoji: "🛑", category: "actions" },
  { id: "hug", label: "Gentle Hug", emoji: "🫂", category: "social" },
  { id: "tired", label: "Sleepy", emoji: "🥱", category: "feelings" },
];

function isValidConfig(data: unknown): data is AacConfig {
  if (typeof data !== "object" || data === null) return false;
  const cfg = data as Record<string, unknown>;
  return typeof cfg.customLabels === "object" && cfg.customLabels !== null;
}

/**
 * Local device implementation storing AAC customizations in localStorage.
 * Shows a visible DeviceOnlyNote in the UI; never fakes cloud persistence.
 */
export class LocalAacService implements AacService {
  private readonly store: LocalDeviceStore<AacConfig>;

  constructor(customStore?: LocalDeviceStore<AacConfig>) {
    this.store =
      customStore ??
      createLocalDeviceStore<AacConfig>(STORE_KEY, {
        validator: isValidConfig,
      });
  }

  public async getConfig(): Promise<AacConfig> {
    return this.store.get({ customLabels: {} });
  }

  public async setCustomLabel(tileId: string, label: string): Promise<AacConfig> {
    const current = await this.getConfig();
    const updated: AacConfig = {
      customLabels: {
        ...current.customLabels,
        [tileId]: label.trim(),
      },
    };
    this.store.set(updated);
    return updated;
  }

  public async resetCustomLabels(): Promise<void> {
    this.store.remove();
  }
}

/**
 * One-line swap point for a future backend API:
 * When Siri's real API is ready, replace `return new LocalAacService();`
 * with `return new ApiAacService();`.
 */
export function createAacService(): AacService {
  // Role-flow 8e: the signed-in person's account, else this device.
  const session = getToolsSession();
  return session ? new RemoteAacService(session) : new LocalAacService();
}
