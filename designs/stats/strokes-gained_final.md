# Strokes gained — final study companion (APP-236)

Approved by Eric on a decision card, 17 Nov 2026 ("Goedkeuren, t.o.v. scratch"), after round 2 feedback the same evening.

- Canvas: [Fairway — Rounds & stats](https://claude.ai/artifact/Jgn4oew8xuPNXr9Sg869aj), page `APP-236 Strokes gained` (round history lives on the canvas).
- Final artboard source: [`strokes-gained_final/`](strokes-gained_final/). Open the `.dc.html` files on the canvas or read them as the visual reference; build from this file.

## Decisions

| # | Decision | Round |
| --- | --- | --- |
| 1 | Baseline is a scratch amateur. Label: "t.o.v. scratch" / "vs scratch". Record the table's source and licence in `@fairway/core`. | 1 (card) |
| 2 | Category names stay English in Dutch too: Off the tee, Approach, Around the green, Putting. | 2 (Eric) |
| 3 | Fairway result gains a miss side: Links / Geraakt / Rechts. Green in regulation gains a miss direction: Kort / Lang / Links / Rechts. | 2 (Eric) |
| 4 | Lie per marked shot, prefilled from course polygons, editable after Mark shot and in the score sheet. | 1 |
| 5 | A hole counts when marked non-green shots + putts = strokes. A round shows strokes gained when at least 9 holes count. Never a guessed number. | 1 |
| 6 | Filters (period, course) apply to everything below the would-be index; the index follows WHS and ignores filters. | 1 |
| 7 | Web Progress gets the same card and filters (feature `stats` is parity). | 1 |

## Data (additive only; no migration that breaks installed builds)

- `shots.lie?: "tee" | "fairway" | "rough" | "bunker" | "green"` and `shots.lieSource?: "map" | "player"`.
- `holeScores.firMiss?: "left" | "right"` (only when `fir === false`), `holeScores.girMiss?: "short" | "long" | "left" | "right"` (only when `gir === false`). Mirror in `scoreUpdateFields` with `null` to clear, and in `@fairway/core/round` types (the `ValidatorsMatchCore` assertion must still hold).
- Choosing Links/Rechts sets `fir=false` + `firMiss`; Geraakt sets `fir=true` and clears `firMiss`; "—" clears both. Same for green.
- Lie prefill: first shot on a hole = Tee; position inside a fairway / bunker / green polygon (`holeGeometry`) = that; otherwise Rough. No polygons: Tee for shot 1, else Rough, still editable.
- Distance to the hole: green centre (or pin when known) from `holeGeometry`/hole anchors. First putt distance = distance of the shot marked on the green.
- Pure functions in `@fairway/core` (e.g. `strokes-gained.ts`): expected strokes by (distance, lie), per-shot SG, per-hole counting rule, per-round and per-period aggregation by category. Unit tests against known baseline values.
- Categories: Off the tee = tee shot on par 4/5; Approach = shots from outside 30 m (not tee shot on par 4/5, includes par 3 tee shot); Around the green = within 30 m, not on the green; Putting = on the green.

## Screens and states

### Stats tab (`stats-tab.dc.html`)

Order: large title → would-be index card (unchanged) → filter menus → Strokes gained card → Averages list → (existing par types, scores, clubs).

- Filter menus: two pill pull-down buttons. Period: "Laatste 20 rondes" (default), "Dit jaar", "Afgelopen 12 maanden", "Alle rondes". Course: "Alle banen" + each course played. Selection persists per device.
- Strokes gained card, header "Strokes gained · t.o.v. scratch". Big number = average SG per round ("−6,8") + "slagen per ronde"; line "Grootste verlies: <category in lowercase English>" in `danger` when the worst category is negative (omit when all ≥ 0). Four rows: category · diverging bar (axis at centre, scale ±4, clamp) · value with one decimal and sign. Negative bars `danger`, positive `accentFill`; the number carries the sign so colour is never the only signal.
- Footer: "Uit {n} van {m} rondes met gemarkeerde slagen. Markeer elke slag om een ronde mee te laten tellen."
- Averages header: "Gemiddelden · {period label}". New rows (before existing ones): "Fairway gemist" → "{l}% links · {r}% rechts"; "Green gemist" → "{s}% kort · {l}% lang"; "Scrambling"; "Sand saves". Percentages over holes with a recorded miss; "—" when no data.
- Scrambling = par or better on holes with `gir === false`. Sand saves = par or better on holes where a shot was played with lie Bunker within 30 m of the green.
- No rounds with enough shots in the filter: the card body reads "Nog geen strokes gained" + "Markeer elke slag tijdens het spelen. Een ronde telt mee vanaf 9 holes waar slagen en putts kloppen."
- Filter menu open: `SG-States.dc.html` middle phone; hint under the index "Filters veranderen dit getal niet." only when a filter is not default.

### Round detail (`SG-Round.dc.html`)

- Card after the tiles: header "Strokes gained · t.o.v. scratch", big number for the round + "over {n} van {m} holes", the four rows, scale labels −4 / 0 / +4.
- Footer when some holes don't count: "Holes {list} tellen niet mee: daar kloppen gemarkeerde slagen en putts niet met je score. Tik een hole op de scorekaart om slagen en lies te corrigeren."
- Below 9 counting holes (`SG-States.dc.html` left): "Nog niet te berekenen" + "Op {n} van 18 holes kloppen gemarkeerde slagen en putts met je score. Er zijn er minstens 9 nodig." + progress bar n/9 + "Markeer volgende keer elke slag met Slag markeren. Ontbrekende slagen kun je hier niet achteraf plaatsen."
- Share card: unchanged in this issue.

### Play: lie after Mark shot (`SG-Play.dc.html`)

- The existing club tray gets a first row: caption "Lie · van de kaart, tik om te wijzigen", chips Tee, Fairway, Rough, Bunker, Green (radio group; selected chip uses `course.target` fill with `course.onTarget` text). Then "Welke club?" as today.
- Tapping a lie chip saves it immediately (`lieSource: "player"`); the tray stays open until a club is picked or skipped. Shot on the green: the club row may be skipped automatically (putter) — runtime question below.
- Play is not themed (course palette).

### Score sheet (`SG-Shots.dc.html`, `SG-States.dc.html` right)

Owner only, after the existing fields:

- Fairway row (par 4/5): segmented "— · ← Links · Geraakt · Rechts →".
- Green in regulation row: a plus-shaped picker (Lang top, Links left, Geraakt centre, Rechts right, Kort bottom), plus the current value as a caption ("Gemist: kort"). Each cell ≥ 34 pt high inside a 44 pt-wide hit area; VoiceOver reads it as a radio group "Green" with five options plus "—" via clearing (long-press or tapping the selected cell clears).
- Section "Slagen op deze hole": one row per marked shot: number, "{distance} tot de hole" (first) or "{distance}", club as secondary, and a lie pill (pull-down menu: Fairway, Rough, Bunker, Green, Tee; the map's value marked "van de kaart"). A shot on the green shows "{d} · eerste putt" and "{putts} putts".
- Footer when consistent: "{shots} slagen + {putts} putts = {strokes}. De lie komt van de baankaart; tik om te wijzigen."
- Mismatch: warn box "{shots} slagen + {putts} putts = {sum}, je score is {strokes}. Deze hole telt niet mee voor strokes gained. Verwijder een dubbel gemarkeerde slag (veeg naar links of houd vast) of pas je score aan." Deleting a shot uses the existing swipe/row menu pattern with confirm.
- No marked shots: section hidden; footnote "Markeer slagen tijdens het spelen voor strokes gained."

### Web Progress (`SG-Web.dc.html`)

English only (web has no i18n): "Strokes gained vs scratch", "From {n} of {m} rounds with marked shots.", "strokes per round", "Biggest loss: approach", rows as above with `flag` bars, new StatCards "Scrambling", "Sand saves". Filters as two `<select>`s styled as pills: "Last 20 rounds" / "All courses". The app column stays cream; only the page backdrop themes.

## Copy (English)

Off the tee, Approach, Around the green, Putting · "Strokes gained · vs scratch" · "strokes per round" · "Biggest loss: {category}" · "From {n} of {m} rounds with marked shots. Mark every shot to count a round." · "Missed fairway" "{l}% left · {r}% right" · "Missed green" "{s}% short · {l}% long" · Left / Hit / Right · Short / Long · "Shots on this hole" · "{d} to the hole" · "first putt" · "from the map" · "Lie · from the map, tap to change".

## Open runtime questions

1. Baseline table: pick the published scratch amateur table, confirm its licence allows embedding; record source in core.
2. Pin position is unknown; green centre is the default. Acceptable error for putting SG is part of the unit tests' documented tolerance.
3. Does a shot marked on the green skip the club question (always putter)?
4. Shot positions are marked where the ball lies before the shot; confirm against how Mark shot fills `shots.position` so the first mark of a hole is the tee.

## Verify

Per design-studies: iOS simulator light/dark/small screen for Stats, round detail (counting, partial, too few), score sheet (consistent, mismatch, lie menu, miss pickers), Play tray; web Progress light/dark page. Compare with the artboards and record pass / agreed deviation.
