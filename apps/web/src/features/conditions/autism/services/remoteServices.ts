/**
 * SafeSpace autism services backed by the database (role-flow 8e).
 *
 * The same interfaces as the device-only services, saving to the signed-in
 * person's account through @safespace/api-client. A child can't clear their
 * feelings choices (like mood check-ins) or change their countdown preset and
 * sentence words: a caregiver sets those (step 8f), so those calls are refused
 * (and the countdown simply doesn't remember a child's last choice).
 */
import * as realApi from "@safespace/api-client";
import type { AppSession } from "@safespace/shared-types";
import type { AacConfig, EmotionCardItem, EmotionSelection, TransitionConfig } from "../types";
import { DEFAULT_EMOTION_CARDS } from "../emotionCardsData";
import type { EmotionCardsService } from "./emotionCardsService";
import { DEFAULT_TRANSITION_CONFIG, type TransitionService } from "./transitionService";
import type { AacService } from "./aacService";

export type AutismToolsApi = Pick<
  typeof realApi,
  "listEmotionChoices" | "addEmotionChoice" | "clearMyEmotionChoices" | "getToolSettings" | "saveMyToolSettings"
>;

const isChild = (s: AppSession) => s?.kind === "child";

export function toSelection(c: realApi.EmotionChoice, cards: EmotionCardItem[] = DEFAULT_EMOTION_CARDS): EmotionSelection {
  const card = cards.find((k) => k.id === c.cardId);
  return { cardId: c.cardId, label: card?.label ?? c.cardId, emoji: card?.emoji ?? "💬", selectedAt: c.createdAt };
}

export class RemoteEmotionCardsService implements EmotionCardsService {
  constructor(private session: AppSession, private api: AutismToolsApi = realApi) {}

  // Newest first, one per card (as the device version shows them).
  async getRecentSelections(): Promise<EmotionSelection[]> {
    const seen = new Set<string>();
    return (await this.api.listEmotionChoices(this.session))
      .filter((c) => (seen.has(c.cardId) ? false : (seen.add(c.cardId), true)))
      .map((c) => toSelection(c));
  }

  async recordSelection(card: EmotionCardItem): Promise<EmotionSelection> {
    return toSelection(await this.api.addEmotionChoice(this.session, card.id));
  }

  async clearRecentSelections(): Promise<void> {
    await this.api.clearMyEmotionChoices(this.session);
  }
}

export class RemoteTransitionService implements TransitionService {
  constructor(private session: AppSession, private api: AutismToolsApi = realApi) {}

  async getSavedConfig(): Promise<TransitionConfig> {
    return (await this.api.getToolSettings(this.session)).transitionPreset ?? DEFAULT_TRANSITION_CONFIG;
  }

  async saveConfig(config: TransitionConfig): Promise<void> {
    if (isChild(this.session)) return;
    await this.api.saveMyToolSettings(this.session, {
      transitionPreset: {
        activity: config.activity.trim().slice(0, 60) || DEFAULT_TRANSITION_CONFIG.activity,
        totalSeconds: Math.min(3600, Math.max(10, Math.round(config.totalSeconds))),
      },
    });
  }
}

export class RemoteAacService implements AacService {
  constructor(private session: AppSession, private api: AutismToolsApi = realApi) {}

  async getConfig(): Promise<AacConfig> {
    return { customLabels: (await this.api.getToolSettings(this.session)).aacLabels };
  }

  async setCustomLabel(tileId: string, label: string): Promise<AacConfig> {
    const { customLabels } = await this.getConfig();
    const next = { ...customLabels, [tileId]: label.trim().slice(0, 30) };
    await this.api.saveMyToolSettings(this.session, { aacLabels: next });
    return { customLabels: next };
  }

  async resetCustomLabels(): Promise<void> {
    await this.api.saveMyToolSettings(this.session, { aacLabels: {} });
  }
}
