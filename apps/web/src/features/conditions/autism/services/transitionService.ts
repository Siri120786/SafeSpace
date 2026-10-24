import { getToolsSession } from "../../toolsSession";
import { RemoteTransitionService } from "./remoteServices";
import { createLocalDeviceStore, LocalDeviceStore } from "../../../wellness-ui";
import type { TransitionConfig } from "../types";

/**
 * Service interface for persisting transition countdown preferences.
 */
export interface TransitionService {
  /** Retrieves saved activity name and duration. */
  getSavedConfig(): Promise<TransitionConfig>;
  /** Updates saved activity name and duration on this device. */
  saveConfig(config: TransitionConfig): Promise<void>;
}

const STORE_KEY = "autism.transition-config";

export const DEFAULT_TRANSITION_CONFIG: TransitionConfig = {
  activity: "Quiet Reading",
  totalSeconds: 300, // 5 minutes
};

function isValidConfig(data: unknown): data is TransitionConfig {
  if (typeof data !== "object" || data === null) return false;
  const c = data as Record<string, unknown>;
  return typeof c.activity === "string" && typeof c.totalSeconds === "number" && c.totalSeconds > 0;
}

/**
 * Local device implementation storing transition presets in localStorage.
 * Shows a visible DeviceOnlyNote in the UI; never fakes cloud persistence.
 */
export class LocalTransitionService implements TransitionService {
  private readonly store: LocalDeviceStore<TransitionConfig>;

  constructor(customStore?: LocalDeviceStore<TransitionConfig>) {
    this.store =
      customStore ??
      createLocalDeviceStore<TransitionConfig>(STORE_KEY, {
        validator: isValidConfig,
      });
  }

  public async getSavedConfig(): Promise<TransitionConfig> {
    return this.store.get(DEFAULT_TRANSITION_CONFIG);
  }

  public async saveConfig(config: TransitionConfig): Promise<void> {
    this.store.set({
      activity: config.activity.trim() || DEFAULT_TRANSITION_CONFIG.activity,
      totalSeconds: Math.max(10, Math.floor(config.totalSeconds)),
    });
  }
}

/**
 * One-line swap point for a future backend API:
 * When Siri's real API is ready, replace `return new LocalTransitionService();`
 * with `return new ApiTransitionService();`.
 */
export function createTransitionService(): TransitionService {
  // Role-flow 8e: the signed-in person's account, else this device.
  const session = getToolsSession();
  return session ? new RemoteTransitionService(session) : new LocalTransitionService();
}
