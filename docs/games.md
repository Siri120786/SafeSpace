# Games Corner (Sprint 4)

Five gentle games for children and adults, on web and Flutter, built from the brief in `GAMES FOR SAFESPACE.pdf`.

| Game | Tier in the brief | Skills | Levels |
| --- | --- | --- | --- |
| Memory Match | MVP | visual memory, attention, recognition | 3 / 6 / 8 pairs |
| Pattern Quest | MVP | pattern recognition, reasoning | repeating, ABC, AAB, ABB, +n / -n, doubling, Fibonacci, gaps |
| Feelings Detective | MVP | emotional vocabulary, perspective-taking | 4 + 4 + 4 stories, mixed feelings at the higher levels |
| Imagine & Create | next | creativity, expression | open-ended: invent a character, build a scene, finish a story |
| Maze Explorer | stretch | planning, persistence | 9x9 / 13x13 / 17x17, three mazes each |

The brief said to deliver the three MVP games first and add the creative game and the maze only after privacy and integration were tested. All five are in; the first three are first in the menu.

## What makes it different
- **You can hear the pattern.** Pattern Quest turns a row into notes (the same picture is always the same note), so the pattern can be heard as well as seen.
- **Voice.** "Read to me" speaks the prompt. "Read aloud" (off by default) also speaks cards, clues, hints, directions and stories. Web uses the browser's speech; Flutter uses the phone's text-to-speech (`flutter_tts`).
- **Gentle sound.** Every effect is a few soft sine notes made on the device (no audio files). A "miss" is a low, quiet boop, never a buzzer. Sound is a switch at the top of every game, starts **off** in calm mode, and any failure to play is ignored.
- **Pip the owl** explains, cheers and never scolds. In Feelings Detective, anything not marked "unlikely" is accepted, and the feedback says several feelings can fit.
- **Calm mode** (reduced motion, longer pauses, quiet by default) follows the device setting, the caregiver's low-sensory default for a child, and the player's own switch.
- **Optional level suggestion.** After three smooth rounds at a level the summary offers one step up; after three rounds with many tries it offers one step down. It is only an offer, and scores are never used to infer ability, a diagnosis or intelligence.
- **A mood nudge.** After Feelings Detective the player can go straight to the mood check-in.
- **Pause, exit, hints, undo and retry** everywhere; Escape pauses; every control is a real button with a name for screen readers; every picture has a spoken name.

## Where things are
| What | Web | Flutter |
| --- | --- | --- |
| Shared content (the one source) | `packages/game-content/*.json` | copied to `apps/mobile/assets/games/` by `node scripts/sync-game-content.mjs` |
| Content access | `apps/web/src/features/games/lib/content.ts` | `lib/features/games/game_content.dart` |
| Rules (pure, tested) | `lib/memory.ts`, `pattern.ts`, `feelings.ts`, `maze.ts`, `imagine.ts`, `scoring.ts` | `memory_logic.dart`, `pattern_logic.dart`, `feelings_logic.dart`, `maze_logic.dart`, `imagine_logic.dart`, `game_scoring.dart` |
| Sound script | `lib/soundScript.ts`, `lib/audio.ts` | `sound_script.dart`, `game_audio.dart` |
| Local-first progress | `lib/progress.ts`, `GamesContext.tsx` | `game_progress.dart`, `games_controller.dart` |
| Screens | `components/*.tsx`, `GamesRoutes.tsx` | `*_screen.dart`, `games_widgets.dart`, `games_screens.dart` |
| Routes | `/games` (Individual), `/child/games` (Child) | `/games` |
| Entry points | Individual dashboard tile, child home tile | user dashboard button, child home tile |
| Account storage | `packages/api-client/src/games.ts`, migration `20261029100000_game_progress.sql`, Edge Function `games` | Supabase RPC for signed-in adults |
| Caregiver view | "Games" section on `/caregiver/children/:id` | not built (the mobile caregiver screens are placeholders) |

Content keeps puzzles away from UI code, has localisation keys (`strings.en`; any other language falls back to English and says so), accessibility names for every picture (`symbols.json`), and a version number.

## Privacy and the identity model
- **Game rules run on the device.** Nothing is sent per move. When a round finishes, a short record is saved: game, level, score (0-100 or none), time. What a player makes in Imagine & Create (characters, scenes, stories, any text they type) is kept **on the device only**.
- **Local first.** Progress is saved on the device immediately. The account copy is best effort: if the network is down the app says so ("kept on this device and will be saved later"), keeps up to 50 waiting rounds, and sends them in order next time. Play never waits.
- **Adults** have a Supabase login: `game_progress` and `game_preferences` under row-level security, written through `record_game_round` and `save_game_preferences` (owner is always `auth.uid()`, never a parameter).
- **Children have no Supabase login.** They use the `games` Edge Function, which checks the signed child-session token (and session version, so a PIN reset ends it), takes the child id from the token only, and calls functions that only the service role can run. A child id sent by a client is ignored. No service-role key is ever in the web or mobile app.
- **Caregivers** can read their own children's progress only (`caregiver_can_see_child_activity`), so it follows the same age-15 sharing rule as mood and routines: a young person who chose not to share is hidden. Comfort settings are readable by their caregivers. Caregivers cannot write.
- **Linked caregivers of an adult** see nothing. **Anon** sees nothing. Knowing a child's id gives no access.
- The caregiver view shows counts of rounds, levels and the last time played, with a note that it is not an assessment. Best score only becomes a star count.
- The mobile app's child sign-in is still a placeholder, so on mobile a child's games stay on the device until that exists.

## Verification
- `npx tsx apps/web/tests/games.test.mts` (content, rules, scoring, suggestions, progress, offline queue, sound scripts, mobile asset copy).
- `npx tsx supabase/tests/games.test.mts` (migration under hosted default privileges, RLS for adults, caregivers, strangers, linked caregivers and anon, the 15+ rule, child functions, the Edge Function with real child tokens, cross-user isolation, repeated and concurrent saves, database errors not leaking).
- `flutter test test/games_test.dart` (the same rules and content in Dart, plus screen smoke tests).
- Both test files are part of `pnpm test`.
- Not done here: a run on a real phone or tablet, hearing the voice on a real device, a screen-reader pass, a run against a hosted Supabase project, and the manual demo checklist below.

## Demo checklist
1. Individual: Dashboard, Games Corner. Play each game once; check stars and the "Saved privately" line.
2. Turn off Wi-Fi, finish a round, see "kept on this device"; turn it back on, play another, check the account catches up.
3. Switch sound and read-aloud on and off; press "Read to me"; press "Hear the pattern".
4. Turn on the OS "reduce motion" setting; the games start quiet and still.
5. Resize to a phone; use only the keyboard (Tab, Enter, arrows in the maze, Escape to pause).
6. Child: sign in with family code and PIN, open Games, play, then reset the PIN from the caregiver side and check the next save asks for the PIN again.
7. Caregiver: open the child, see the Games section; for a 15+ child who chose not to share, see it hidden.
8. Second family's caregiver cannot see the first family's child.

## Open questions
- The wording of Feelings Detective and Imagine & Create is placeholder (see `docs/content-needing-review.md`).
- Voices differ by device; some phones have no English voice installed, and then read-aloud is silent.
- Whether caregivers may set a child's starting level (not built; the child or the optional suggestion chooses).
