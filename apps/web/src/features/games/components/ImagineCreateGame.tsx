import React, { useState } from "react";
import { useGames } from "../GamesContext";
import { imagineContent, symbolName } from "../lib/content";
import {
  characterIntro,
  characterIsComplete,
  cleanOwnText,
  composeStory,
  emptyCharacter,
  emptyScene,
  emptyStory,
  placeSticker,
  sceneIsComplete,
  stickerCount,
  storyIsComplete,
  type CharacterDraft,
  type Creation,
  type SceneDraft,
  type StoryDraft,
} from "../lib/imagine";
import { Buddy, GameShell } from "./GameShell";
import { RoundSummary } from "./RoundSummary";

interface Props {
  onExit: () => void;
  onAgain: () => void;
}

type Mode = "menu" | "character" | "scene" | "story" | "done";

const chip = (on: boolean) =>
  `rounded-2xl border-2 px-3 py-2 text-base focus:outline-none focus:ring-4 focus:ring-olive-500 ${on ? "border-deepGreen bg-deepGreen-50" : "border-olive-200 bg-white hover:bg-olive-50"}`;
const primary =
  "rounded-full bg-darkBtn px-8 py-3 font-medium text-white focus:outline-none focus:ring-2 focus:ring-olive-500 focus:ring-offset-2 disabled:opacity-40";
const ghost =
  "rounded-full border border-olive-200 bg-white px-5 py-2 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-olive-500";

export const ImagineCreateGame: React.FC<Props> = ({ onExit, onAgain }) => {
  const { prefs, audio, finishRound, addCreation, state, t, lang } = useGames();
  const [mode, setMode] = useState<Mode>("menu");
  const [character, setCharacter] = useState<CharacterDraft>(emptyCharacter);
  const [scene, setScene] = useState<SceneDraft>(emptyScene);
  const [story, setStory] = useState<StoryDraft>(emptyStory);
  const [sticker, setSticker] = useState<string | null>(null);
  const [message, setMessage] = useState(t("ic.how"));
  const [kept, setKept] = useState(false);
  const [praise, setPraise] = useState(0);
  const [lastKind, setLastKind] = useState<Creation["kind"]>("character");

  const C = imagineContent.character;
  const S = imagineContent.scene;
  const backdrop = S.backdrops.find((b) => b.id === scene.backdropId);
  const color = C.colors.find((c) => c.id === character.colorId);

  function finish(kind: Creation["kind"]) {
    finishRound({ gameId: "imagine-create", difficulty: prefs.difficulty, score: null, mistakes: 0, hints: 0 });
    setMessage(t(["ic.encourage", "ic.encourage2", "ic.encourage3"][praise % 3]));
    setPraise((n) => n + 1);
    setLastKind(kind);
    setMode("done");
  }

  function keep(kind: Creation["kind"]) {
    // Kept on this device only: anything typed never goes to the account.
    addCreation({
      id: `${kind}-${Date.now()}`,
      kind,
      createdAt: new Date().toISOString(),
      character: kind === "character" ? character : undefined,
      scene: kind === "scene" ? scene : undefined,
      story: kind === "story" ? { ...story, ownText: cleanOwnText(story.ownText) } : undefined,
    });
    setKept(true);
    audio.play("cheer");
  }

  const back = () => {
    setKept(false);
    setMode("menu");
  };

  const Preview: React.FC = () => (
    <div
      className="flex h-32 w-32 items-center justify-center rounded-full border-4 border-white text-7xl shadow-card"
      style={{ background: color?.hex ?? "#F3EFE6" }}
      role="img"
      aria-label={character.body ? symbolName(character.body, lang) : "your character"}
    >
      <span aria-hidden="true" className="relative">
        {character.body ?? "❓"}
        {character.accessory && <span className="absolute -right-4 -top-3 text-4xl">{character.accessory}</span>}
      </span>
    </div>
  );

  return (
    <GameShell gameId="imagine-create" onExit={onExit} readText={message}>
      {() => {
        if (mode === "done") {
          const kind = lastKind;
          return (
            <div className="space-y-4">
              <RoundSummary gameId="imagine-create" score={null} message={message} onAgain={onAgain} onExit={onExit} />
              <div className="flex justify-center">
                <button type="button" className={ghost} disabled={kept} onClick={() => keep(kind)}>
                  <span aria-hidden="true">📌 </span>
                  {kept ? t("ic.saved") : t("ic.save")}
                </button>
              </div>
            </div>
          );
        }

        if (mode === "menu") {
          return (
            <div className="space-y-4">
              <Buddy message={message} />
              <div className="grid gap-3 sm:grid-cols-3">
                {(
                  [
                    ["character", "🦄"],
                    ["scene", "🏝️"],
                    ["story", "📖"],
                  ] as const
                ).map(([m, icon]) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => {
                      audio.unlock();
                      audio.play("tap");
                      setKept(false);
                      setMode(m);
                    }}
                    className="flex flex-col items-center gap-2 rounded-3xl border-2 border-olive-200 bg-white p-5 text-textHeading shadow-sm hover:bg-olive-50 focus:outline-none focus:ring-4 focus:ring-olive-500"
                  >
                    <span className="text-5xl" aria-hidden="true">{icon}</span>
                    <span className="font-display text-lg">{t(`ic.mode.${m}`)}</span>
                  </button>
                ))}
              </div>
              {state.creations.length > 0 && (
                <section aria-label={t("ic.gallery")} className="space-y-2 rounded-3xl bg-white p-4 shadow-card">
                  <h2 className="font-display text-lg text-textHeading">{t("ic.gallery")}</h2>
                  <ul className="flex flex-wrap gap-2">
                    {state.creations.map((c) => (
                      <li key={c.id} className="rounded-2xl border border-olive-200 bg-olive-50 px-3 py-2 text-3xl">
                        <span role="img" aria-label={t(`ic.mode.${c.kind}`)}>
                          {c.kind === "character" ? c.character?.body ?? "🦄" : c.kind === "scene" ? imagineContent.scene.backdrops.find((b) => b.id === c.scene?.backdropId)?.emoji ?? "🏝️" : "📖"}
                        </span>
                      </li>
                    ))}
                  </ul>
                  <p className="text-xs text-textMuted">{t("ui.savedHere")}</p>
                </section>
              )}
            </div>
          );
        }

        if (mode === "character") {
          return (
            <div className="space-y-5">
              <div className="flex justify-center"><Preview /></div>
              <fieldset className="space-y-2">
                <legend className="font-display text-lg text-textHeading">{t("ic.character.body")}</legend>
                <div className="flex flex-wrap gap-2">
                  {C.bodies.map((b) => (
                    <button key={b} type="button" className={chip(character.body === b)} aria-pressed={character.body === b} aria-label={symbolName(b, lang)}
                      onClick={() => { audio.unlock(); audio.play("place"); setCharacter({ ...character, body: b }); }}>
                      <span aria-hidden="true" className="text-3xl">{b}</span>
                    </button>
                  ))}
                </div>
              </fieldset>
              <fieldset className="space-y-2">
                <legend className="font-display text-lg text-textHeading">{t("ic.character.color")}</legend>
                <div className="flex flex-wrap gap-2">
                  {C.colors.map((c) => (
                    <button key={c.id} type="button" className={chip(character.colorId === c.id)} aria-pressed={character.colorId === c.id}
                      onClick={() => { audio.play("tap"); setCharacter({ ...character, colorId: c.id }); }}>
                      <span aria-hidden="true" className="mr-2 inline-block h-5 w-5 rounded-full align-middle" style={{ background: c.hex }} />
                      {t(c.nameKey)}
                    </button>
                  ))}
                </div>
              </fieldset>
              <fieldset className="space-y-2">
                <legend className="font-display text-lg text-textHeading">{t("ic.character.accessory")}</legend>
                <div className="flex flex-wrap gap-2">
                  {C.accessories.map((a) => (
                    <button key={a} type="button" className={chip(character.accessory === a)} aria-pressed={character.accessory === a} aria-label={symbolName(a, lang)}
                      onClick={() => { audio.play("tap"); setCharacter({ ...character, accessory: character.accessory === a ? null : a }); }}>
                      <span aria-hidden="true" className="text-2xl">{a}</span>
                    </button>
                  ))}
                </div>
              </fieldset>
              <fieldset className="space-y-2">
                <legend className="font-display text-lg text-textHeading">{t("ic.character.power")}</legend>
                <div className="flex flex-wrap gap-2">
                  {C.powers.map((p) => (
                    <button key={p} type="button" className={chip(character.powerKey === p)} aria-pressed={character.powerKey === p}
                      onClick={() => { audio.play("tap"); setCharacter({ ...character, powerKey: p }); }}>
                      {t(p)}
                    </button>
                  ))}
                </div>
              </fieldset>
              <label className="block space-y-1">
                <span className="font-display text-lg text-textHeading">{t("ic.character.name")}</span>
                <input
                  type="text"
                  value={character.name}
                  maxLength={24}
                  placeholder={t("ic.character.namePlaceholder")}
                  onChange={(e) => setCharacter({ ...character, name: e.target.value })}
                  className="w-full rounded-2xl border-2 border-olive-200 bg-white px-4 py-3 text-base focus:outline-none focus:ring-4 focus:ring-olive-500"
                />
              </label>
              {characterIsComplete(character) && (
                <p className="rounded-2xl bg-white px-4 py-3 text-center text-base text-textHeading shadow-sm" role="status">
                  {characterIntro(character, lang)}
                </p>
              )}
              <div className="flex flex-wrap justify-center gap-2">
                <button type="button" className={ghost} onClick={back}>{t("ui.back")}</button>
                <button type="button" className={ghost} disabled={!characterIsComplete(character)}
                  onClick={() => audio.speak(characterIntro(character, lang), true)}>
                  <span aria-hidden="true">📣 </span>{t("ui.readAloud")}
                </button>
                <button type="button" className={primary} disabled={!characterIsComplete(character)}
                  onClick={() => finish("character")}>
                  {t("ic.finish")}
                </button>
              </div>
            </div>
          );
        }

        if (mode === "scene") {
          return (
            <div className="space-y-4">
              <fieldset className="space-y-2">
                <legend className="font-display text-lg text-textHeading">{t("ic.scene.pick")}</legend>
                <div className="flex flex-wrap gap-2">
                  {S.backdrops.map((b) => (
                    <button key={b.id} type="button" className={chip(scene.backdropId === b.id)} aria-pressed={scene.backdropId === b.id}
                      onClick={() => { audio.unlock(); audio.play("tap"); setScene({ ...scene, backdropId: b.id }); }}>
                      <span aria-hidden="true">{b.emoji} </span>{t(b.nameKey)}
                    </button>
                  ))}
                </div>
              </fieldset>
              <p className="text-sm text-textBody">{t("ic.scene.stickers")}</p>
              <div role="group" aria-label={t("ic.scene.stickers")} className="flex flex-wrap gap-2">
                {S.stickers.map((s) => (
                  <button key={s} type="button" className={chip(sticker === s)} aria-pressed={sticker === s} aria-label={symbolName(s, lang)}
                    onClick={() => { audio.play("tap"); setSticker(sticker === s ? null : s); }}>
                    <span aria-hidden="true" className="text-2xl">{s}</span>
                  </button>
                ))}
              </div>
              <div
                role="grid"
                aria-label={backdrop ? t(backdrop.nameKey) : t("ic.mode.scene")}
                className="grid gap-1 rounded-3xl border-4 border-white p-2 shadow-card"
                style={{
                  gridTemplateColumns: `repeat(${S.grid.columns}, minmax(0, 1fr))`,
                  background: backdrop ? `linear-gradient(${backdrop.from}, ${backdrop.to})` : "#F3EFE6",
                }}
              >
                {scene.cells.map((cell, i) => (
                  <button
                    key={i}
                    type="button"
                    role="gridcell"
                    aria-label={cell ? `${symbolName(cell, lang)}, tap to remove` : `Empty square ${i + 1}`}
                    onClick={() => {
                      if (cell) { audio.play("undo"); setScene(placeSticker(scene, i, null)); }
                      else if (sticker) { audio.unlock(); audio.play("place"); setScene(placeSticker(scene, i, sticker)); }
                    }}
                    className="aspect-square rounded-xl bg-white/40 text-3xl focus:outline-none focus:ring-4 focus:ring-olive-500 sm:text-4xl"
                  >
                    <span aria-hidden="true">{cell}</span>
                  </button>
                ))}
              </div>
              <div className="flex flex-wrap justify-center gap-2">
                <button type="button" className={ghost} onClick={back}>{t("ui.back")}</button>
                <button type="button" className={ghost} disabled={stickerCount(scene) === 0} onClick={() => setScene({ ...scene, cells: scene.cells.map(() => null) })}>
                  {t("ic.scene.clear")}
                </button>
                <button type="button" className={primary} disabled={!sceneIsComplete(scene)} onClick={() => finish("scene")}>
                  {t("ic.finish")}
                </button>
              </div>
            </div>
          );
        }

        // story
        const starter = imagineContent.story.starters.find((x) => x.id === story.starterId);
        return (
          <div className="space-y-5">
            <fieldset className="space-y-2">
              <legend className="font-display text-lg text-textHeading">{t("ic.story.pick")}</legend>
              <div className="space-y-2">
                {imagineContent.story.starters.map((st) => (
                  <button key={st.id} type="button" className={`${chip(story.starterId === st.id)} block w-full text-left`} aria-pressed={story.starterId === st.id}
                    onClick={() => { audio.unlock(); audio.play("tap"); audio.speak(t(st.textKey)); setStory({ ...emptyStory(), starterId: st.id }); }}>
                    {t(st.textKey)}
                  </button>
                ))}
              </div>
            </fieldset>
            {starter && (
              <>
                <fieldset className="space-y-2">
                  <legend className="font-display text-lg text-textHeading">{t("ic.story.middle")}</legend>
                  <div className="space-y-2">
                    {starter.nextKeys.map((k) => (
                      <button key={k} type="button" className={`${chip(story.nextKey === k)} block w-full text-left`} aria-pressed={story.nextKey === k}
                        onClick={() => { audio.play("tap"); setStory({ ...story, nextKey: k }); }}>
                        {t(k)}
                      </button>
                    ))}
                  </div>
                </fieldset>
                <fieldset className="space-y-2">
                  <legend className="font-display text-lg text-textHeading">{t("ic.story.end")}</legend>
                  <div className="space-y-2">
                    {starter.endKeys.map((k) => (
                      <button key={k} type="button" className={`${chip(story.endKey === k)} block w-full text-left`} aria-pressed={story.endKey === k}
                        onClick={() => { audio.play("tap"); setStory({ ...story, endKey: k }); }}>
                        {t(k)}
                      </button>
                    ))}
                  </div>
                </fieldset>
                <label className="block space-y-1">
                  <span className="text-sm text-textBody">{t("ic.story.own")}</span>
                  <textarea
                    value={story.ownText}
                    maxLength={imagineContent.story.maxOwnTextLength}
                    rows={3}
                    onChange={(e) => setStory({ ...story, ownText: e.target.value })}
                    className="w-full rounded-2xl border-2 border-olive-200 bg-white px-4 py-3 text-base focus:outline-none focus:ring-4 focus:ring-olive-500"
                  />
                </label>
              </>
            )}
            {storyIsComplete(story) && (
              <section className="space-y-2 rounded-3xl bg-white p-4 shadow-card" aria-label={t("ic.story.yours")}>
                <h2 className="font-display text-lg text-textHeading">{t("ic.story.yours")}</h2>
                <p className="text-base text-textBody">{composeStory(story, lang)}</p>
              </section>
            )}
            <div className="flex flex-wrap justify-center gap-2">
              <button type="button" className={ghost} onClick={back}>{t("ui.back")}</button>
              <button type="button" className={ghost} disabled={!storyIsComplete(story)} onClick={() => audio.speak(composeStory(story, lang), true)}>
                <span aria-hidden="true">📣 </span>{t("ic.story.read")}
              </button>
              <button type="button" className={primary} disabled={!storyIsComplete(story)} onClick={() => finish("story")}>
                {t("ic.finish")}
              </button>
            </div>
          </div>
        );
      }}
    </GameShell>
  );
};
