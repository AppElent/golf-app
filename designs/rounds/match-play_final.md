# Match play and skins — final study companion (APP-148)

Approved by Eric on a decision card, 17 Nov 2026 ("Goedkeuren, telefoon en web").

- Canvas: [Fairway — Rounds & stats](https://claude.ai/artifact/Jgn4oew8xuPNXr9Sg869aj), page `APP-148 Match play & skins`.
- Final artboard source: [`match-play_final/`](match-play_final/). Build from this file; the artboards are the visual reference.

## Decisions

1. Format is a choice list with four options: Stableford, Strokeplay, Matchplay (exactly 2 players), Skins (2–4 players). An option that doesn't fit the player count is disabled and says why.
2. Matchplay: Netto (default) or Bruto. Net gives the lower-handicap player's opponent the difference in playing handicap as strokes, one per hole on the lowest stroke-index holes (difference > 18 wraps: two strokes on the lowest indexes).
3. Skins: Netto (default) or Bruto; "Doorschuiven bij gelijkspel" switch, default on. Each player's net strokes per hole use their own playing handicap (full allowance).
4. Standing is shown on the score sheet, as a capsule on Play, as an extra row on the scorecard, on the round detail and on the share card.
5. When a match is decided, an alert offers "Verder spelen" (default, bold) or "Ronde afronden". Strokes keep counting for stats and the handicap differential either way.
6. Web: setup offers the same four formats and options; the web card shows the Match/Skins row. Round history and sharing stay phone-only (ADR 0001).
7. Out of scope (issue): Nassau, money/bets, team formats.

## Data (additive)

- `roundFormat` gains literals `"match"` and `"skins"` (validator + `RoundFormat` in core).
- `rounds.formatOptions?: { scoring: "net" | "gross"; carryOver?: boolean }`. Absent = net, carry-over on.
- Standing is derived, never stored: pure functions in `@fairway/core` (e.g. `match-play.ts`, `skins.ts`) from hole scores, stroke indexes and playing handicaps. Unit tests: halves, dormie, early finish (e.g. 3&2, 1 up after 18, 10&8 wrap), carry-overs including trailing carries left on the table, 9-hole rounds, picked-up holes (NR loses the hole in match play; NR can't win a skin).
- Stats and differentials unchanged: strokes are still stored per player per hole.

## Screens and states (Dutch copy as shipped in nl; English in en)

### Round setup (`MP-Setup.dc.html`, `MP-States.dc.html` right)

- Section "Spelvorm": radio rows with secondary line:
  - Stableford — "Punten per hole, met je handicap"
  - Strokeplay — "Je totaal aantal slagen"
  - Matchplay — "Hole voor hole tegen één speler · 2 spelers"; disabled: "Alleen met precies 2 spelers. Je hebt er nu {n}."
  - Skins — "Wie een hole alleen wint, pakt de skin · 2–4 spelers"; disabled with 1 player: "Voeg minstens één speler toe."
- If players change so the chosen format no longer fits, fall back to Stableford and show the disabled reason.
- Section "Matchplay": segmented "Score: Netto | Bruto"; footer "{name} krijgt {n} slagen: één op elke hole met HCP 1 t/m {n}. Slagen tellen ook gewoon mee voor je score en handicap." (Bruto: "Zonder handicapslagen.")
- Section "Skins": segmented Netto | Bruto, switch "Doorschuiven bij gelijkspel", footer "Bij gelijkspel gaat de skin naar de volgende hole. Uit: niemand krijgt hem."
- Matchplay needs handicap indexes for net; missing index: footer "Vul voor beide spelers een handicap in voor netto, of kies Bruto."

### Score sheet (`MP-Score.dc.html`)

- Standing box at the top (`accentDim`): Match: "{leader} {n} UP" / "All square", sub "Nog {holes} holes · {name} krijgt een slag op deze hole (HCP {si})". Skins: "Skin op hole {n} is {value} waard", sub "{c} doorgeschoven van hole {list}" or "Geen doorgeschoven skins".
- A player receiving a stroke on this hole shows a "+1 slag" chip by their name; their stroke row shows "netto {n}".
- After all players have strokes, a result box: Match "{name} wint de hole · {new standing}" / "Hole gedeeld · {standing}", sub "Netto {a} tegen {b}. Opslaan zet de stand op …". Skins "{name} pakt {n} skins" / "Gelijk: {names} netto {n}" + "Niemand wint alleen, dus de skin schuift door. Hole {next} is {v} waard." (carry-over off: "… niemand krijgt de skin.")

### Play (`MP-States.dc.html` left)

- Glass capsule under the top bar, `role=status`: "{leader} {n} UP · nog {holes}", "All square · nog {holes}", "Dormie · {leader} {n} UP · nog {holes}", after decided "{winner} wint {result}". Skins: "Skin {value} waard · {leader} {n}". Hidden for stroke/stableford.

### Match decided (`MP-States.dc.html` middle)

- Native alert after saving the deciding hole: title "{winner} wint {x}&{y}", message "De match is beslist. Speel je de laatste {n} holes uit? Je slagen tellen dan mee voor je score en handicap." Buttons "Verder spelen" (preferred) and "Ronde afronden" (existing finish flow, including its missing-holes message).

### Scorecard (`MP-Card.dc.html`)

- Standing box above the grid: match "{leader} {n} UP" + "{Netto|Bruto} · nog {n} holes"; skins "{name} {n} · …" sorted desc + "{n} skins op tafel".
- Dot in the top-right of a score cell = that player gets a stroke there.
- Extra last row: "Match" with the standing after each hole (chip "E1" = Eric 1 up, filled `accentFill`; opponent up = filled `text`; "AS" muted text). "Skins": winner initial + skins won (each player a distinct chip shape: filled accent, filled ink, outlined), "→" for carried. Skins adds a totals list per player below.
- VoiceOver: each cell reads "Hole 5, Eric 2 up" / "Hole 6, Jan wint 3 skins".

### Round detail and share (`MP-Detail.dc.html`)

- Result card before the tiles: match "Matchplay tegen {opp}" / "{winner} wint {result}" / "Beslist op hole {n}. Holes … zijn uitgespeeld voor de score." Halved: "Gelijk gespeeld". Skins "Skins" / "{name} wint met {n}" / "{n} skins bleven liggen: …" plus a list "Skins per speler" and "Op tafel".
- Meta line shows "Matchplay netto" / "Skins netto" instead of Stableford/Strokeplay.
- Share card headline: "{winner} wint {result} van {opp}" / "{name} wint de skins met {n}", sub "{format} · {name} {score} · {opp} {score}".

### Web (`MP-Web.dc.html`, English)

- New round → Format: PillToggles Stableford, Stroke play, Match play, Skins (disabled with a dashed outline and the reason below). Scoring: Net | Gross. Skins: "Carry over ties" toggle. Helper texts as above in English.
- Card: standing panel "Eric 1 up · 9 to play" and the Match/Skins row under the players.

## Copy (English)

Match play · Skins · "Hole by hole against one player · 2 players" · "Win a hole outright to take the skin · 2–4 players" · Net / Gross · "Carry over ties" · "{name} 1 up" · "All square" · "Dormie" · "{n} to play" · "{name} wins {x}&{y}" · "Keep playing" · "Finish round" · "Skin on hole {n} is worth {v}" · "{n} carried over".

## Open runtime questions

1. Strokes when the handicap difference exceeds the hole count on 9-hole rounds: use the 9-hole playing handicaps.
2. Live Activity / lock screen: show the standing? Not designed; leave unchanged unless trivial.

## Verify

iOS simulator: a simulated 2-player net match through dormie and an early finish, a 3-player skins round with carry-overs; light, dark, small screen. Web: setup and card. Compare with the artboards.
