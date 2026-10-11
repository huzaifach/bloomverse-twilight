# BLOOMVERSE: TWILIGHT HAVEN — Build Plan (locked 11 Oct 2026)

## 1. Vision (design locked by Huzaifa's progressive approvals)
Cozy fantasy merge-and-grow. "Twilight Haven" design language: warm Ghibli haven
where restored, NecroMerger-inspired umbral dark where withered; restoring flips
dark→warm (Merge Dragons dead-land-heal parallel). 2.5D depth (layered tiles,
parallax, scale-by-row). Palette: haven `#1B2A4A/#F5E6C8/#E8A87C/#7FB069`,
umbral `#12101D/#4A3B6B/#B9A7E6`, accent `#D98E4A`. Strictly no neon.
Full GDD + final design live in the side chat (text). Mockups approved ("Hn ye Sahi ha").

## 2. Stack (his order: game-dev libraries/frameworks)
Phaser 3 + TypeScript + Vite. Texture atlases. 60fps budget on Mali-class
(his Realme C71). Unified pointer input (drag + tap-tap). Versioned
localStorage save. All content in JSON under data/.

## 3. Repo layout (his order: one folder, subfolders)
```
bloomverse-twilight/
  PLAN.md  QA.md  LICENSE-LOG.md
  index.html  package.json  vite.config.ts  tsconfig.json
  src/            # scenes, systems (Boot, Title, Board, Grove, Atlas, Wings, overlays, save, audio, ui-kit)
  assets/sprites/ # 58 sliced transparent PNGs (copied from ../game-assets/bloomverse/sliced/)
  assets/backgrounds/ # 4 plates (copied, bg-*.webp)
  assets/ui/      # 12 UI kit PNGs (in sliced/)
  assets/fonts/   # 8 TTFs (copied from ../game-assets/bloomverse/fonts/)
  assets/audio/   # CC0 sfx + music (see §7)
  data/           # families.json, hybrids.json, wishes.json, wings.json,
                  # upgrades.json, achievements.json, blessings.json, spirits.json
```

## 4. Asset manifest (source of truth — copy, don't regenerate)
- Sprites/UI: `~/workspace/game-assets/bloomverse/sliced/*.png` (70 files)
- Backgrounds: `~/workspace/game-assets/bloomverse/media-generation-bg-*.webp` (4)
- Fonts: `~/workspace/game-assets/bloomverse/fonts/*.ttf` (8)
- If more assets are genuinely needed, generate with the same chroma-key sheet
  pipeline; never upscale; 512px source discipline.

## 5. Content systems — the ~100-hour engine (his order: big game, ~100h)
- 40 plants: 4 families × 8 tiers + 8 hybrids (all authored in families.json)
- 120 authored wishes, fixed order, 3 active, dayIndex rotation (zero RNG)
- 4 wings × 5 upgrade levels = 20 wing upgrades
- Grove: 8 pots; 3 upgrade lines (Raincaller/Moths/Star Pots) × 10 levels
- 24 authored achievements, deterministic triggers
- 14-day fixed blessing rotation
- Star Atlas: 40 codex entries, completion rewards
- **Starfall Rebirth (prestige):** reset board/wishes/upgrades, keep atlas;
  Star Medals = f(highest tier reached); each medal +5% permanent Moondew
  (multiplicative, sane cap). This + exponential cost curves (×1.35–1.6/level)
  is the long-tail 100h engine. Tune so pot-10/upgrades take weeks.
- Offline gains: rate × min(elapsed, 12h), deterministic
- Tutorial: 7 fixed steps. Fixed spirit visit timetable. Ambient = fixed choreography.

## 6. Zero randomness (his hard order)
No `Math.random` anywhere — build fails lint if found (`grep -r Math.random src`).
Deterministic functions only (index/day-based). "Mystery" = atlas order.

## 7. Audio (his order: AI or free commercial-use)
Priority: real CC0 sounds first — Kenney.nl + OpenGameArt (direct curl, no signup).
Log every file + license in LICENSE-LOG.md. Needed: click, merge pop,
tier-up fanfare, wish claim, moondew collect, soft error, night ambient loop,
music-box lullaby loop. Synth (WebAudio) ONLY for parametric: merge-chime
pitch escalation. Missing CC0 → synth fallback. Never silence, never placeholder.

## 8. QA gates (his standing rules)
1. Headless boot test (data-shape: JSON loads, no TypeError) — never ship without it.
2. `npm run build` clean; no console errors in browser smoke test of live link.
3. Smoke: every screen reachable, merge works, wish claim works, grove accrues,
   save survives reload, no placeholders (every button functional).
4. `?v=N` bump on every deploy changing JS/CSS/assets. Branch `main`.
   gh-push quirk: empty repo → seed one commit via contents API first (409 fix).
5. His phone (Realme C71) is the final QA gate — report asks for his playtest.

## 9. Deploy
GitHub repo `huzaifach/bloomverse-twilight` + GitHub Pages (zero-user-action path
that worked before). Live link + ZIP in Library (`~/workspace/your_files/`).

## 10. Cut policy (his no-placeholders rule)
Every UI element must be functional. If something can't be production-grade,
CUT it and log the reason here — never ship a fake button.

## 11. Autonomy
Huzaifa granted full autonomy in this direction (11 Oct 2026): decide everything,
expand as needed, don't stop until final code. Stay in this chat's scope;
do not touch other chats' directories (killed v0.1 repo stays parked).
