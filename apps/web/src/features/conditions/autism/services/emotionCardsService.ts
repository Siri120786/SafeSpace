import { getToolsSession } from "../../toolsSession";
import { RemoteEmotionCardsService } from "./remoteServices";
import { createLocalDeviceStore, LocalDeviceStore } from "../../../wellness-ui";
import type { EmotionCardItem, EmotionSelection } from "../types";

/**
 * Service interface for persisting on-device emotion card selections.
 */
export interface EmotionCardsService {
  /** Retrieves recent emotion card taps on this device, newest first. */
  getRecentSelections(): Promise<EmotionSelection[]>;
  /** Records a new card tap (stores only identifier & timestamp, never free text). */
  recordSelection(card: EmotionCardItem): Promise<EmotionSelection>;
  /** Clears the local tap history on this device. */
  clearRecentSelections(): Promise<void>;
}

const MAX_HISTORY_ITEMS = 10;
const STORE_KEY = "autism.emotion-cards";

/**
 * Runtime validator for stored emotion selections.
 */
function isValidSelectionArray(data: unknown): data is EmotionSelection[] {
  if (!Array.isArray(data)) return false;
  return data.every(
    (item) =>
      typeof item?.cardId === "string" &&
      typeof item?.label === "string" &&
      typeof item?.emoji === "string" &&
      typeof item?.selectedAt === "string"
  );
}

/**
 * Local device implementation storing selections in localStorage.
 * Shows a visible DeviceOnlyNote in the UI; never fakes cloud persistence.
 */
export class LocalEmotionCardsService implements EmotionCardsService {
  private readonly store: LocalDeviceStore<EmotionSelection[]>;

  constructor(customStore?: LocalDeviceStore<EmotionSelection[]>) {
    this.store =
      customStore ??
      createLocalDeviceStore<EmotionSelection[]>(STORE_KEY, {
        validator: isValidSelectionArray,
      });
  }

  public async getRecentSelections(): Promise<EmotionSelection[]> {
    return this.store.get([]);
  }

  public async recordSelection(card: EmotionCardItem): Promise<EmotionSelection> {
    const existing = this.store.get([]);
    const newEntry: EmotionSelection = {
      cardId: card.id,
      label: card.label,
      emoji: card.emoji,
      selectedAt: new Date().toISOString(),
    };

    // Prepend newest selection and clamp to max history
    const updated = [newEntry, ...existing.filter((e) => e.cardId !== card.id)].slice(
      0,
      MAX_HISTORY_ITEMS
    );

    this.store.set(updated);
    return newEntry;
  }

  public async clearRecentSelections(): Promise<void> {
    this.store.remove();
  }
}

/**
 * One-line swap point for a future backend API:
 * When Siri's real API is ready, replace `return new LocalEmotionCardsService();`
 * with `return new ApiEmotionCardsService();`.
 */
export function createEmotionCardsService(): EmotionCardsService {
  // Role-flow 8e: the signed-in person's account, else this device.
  const session = getToolsSession();
  return session ? new RemoteEmotionCardsService(session) : new LocalEmotionCardsService();
}
