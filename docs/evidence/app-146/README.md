# APP-146 runtime evidence (PR #67, head 21289f1)

Taken 2026-11-17 on the iOS 27 simulator (iPhone 17; iPhone SE 3rd gen for the small screen). The app was the Fairway Dev client, runtime fingerprint `bb8bde4f…`, which matches the branch's development fingerprint. Its JS came from Metro.

## Setup

- **Backend:** an isolated local Convex backend (`CONVEX_AGENT_MODE=anonymous npx convex dev`) running the PR's functions. The issuer was the Clerk dev instance, and the catalog was seeded with `pnpm courses:sync`. The shared DEV deployment was not used.
- **Auth:** the Clerk dev instance, signed in as the pre-filled dev test user.
- **Round:** a real round (not a simulation) on De Oosterhoutse Golf Club, 18 holes, played to hole 3. The simulator location was 51.6168,4.8700.
- **Network block:** the app reached Convex through a local TCP relay (`127.0.0.1:3299` → `3210`). Stopping the relay made Convex unreachable. Clerk was not blocked: Network Link Conditioner is not installed, and blocking it any other way needs sudo. So "offline" here means Convex offline, Clerk online.

## Results

| # | Check | Result |
| --- | --- | --- |
| 1 | Offline cold start shows the round from the saved copy (hole 3, map, distances, hazards) | Pass (01, 02) |
| 2 | Offline banner "Offline — saved copy of your round" | Pass, see the notes on timing and light-mode contrast (03, 04) |
| 3 | "Scoring returns with signal" replaces the Score button; no mark-shot, close or scorecard button | Pass |
| 4 | Previous and next hole chevrons work offline | Pass (2 → 3 → 4 and back) |
| 5 | Appears within ~2 s | Partly. The play screen was drawn ~1.4 s after the JS loaded (~6.9 s after launch, including the dev bundle from Metro). The banner appeared ~2.5–3 s after that (03 → 04). |
| 6 | Network restored: live play opens again with "Score hole 3", Close and scorecard | Pass, ~9 s after the relay restarted (05) |
| 7 | After reconnecting, Close goes to Home in one step (no duplicate /play) | Pass (06) |
| 8 | Small screen (iPhone SE) offline cold start | Pass (07) |
| 9 | Sign out via Profile, then an offline cold start shows the sign-in screen and no round | Pass (08) |

No red boxes or JS errors appeared. Metro logged only the usual Clerk development-key warning and an expo-router `exports` resolution warning.

## Notes

- **Banner timing:** for ~2.5–3 s after an offline cold start, the play screen shows without the banner, and the hole header sits under the status bar (03). The banner then appears and pushes the header down (04).
- **Light-mode contrast:** in light mode the banner is dark-orange text on a dark-green bar, which is hard to read (01, 07). Dark mode is readable (02).
- **Dev-only overlap:** the dev client's floating Tools button covers the Next-hole chevron once the banner pushes the header down. With the Tools button turned off, Next works. Release builds don't have that button.
- **SE copy:** on the SE the copy was written from Home without opening Play first, and the offline cold start still showed hole 3.

## Retake on PR head f83946b (banner fix)

Same setup: the local Convex backend, the relay block (Clerk not blocked) and the same round on hole 3. I terminated the app, stopped the relay and cold-started it, taking a screenshot every ~0.4 s.

| # | Check | Result |
| --- | --- | --- |
| 09 | Light mode: banner shown from the first play-screen frame, header below it (screenshot ~0.9 s after the screen appeared, ~8.2 s after launch with the dev bundle) | Pass |
| 10 | The same in dark mode | Pass |
| 11 | iPhone SE offline cold start: banner shown, header below it | Pass |
| 12 | Network restored (iPhone SE): live play returns with "Score hole 3", Close and mark-shot, and the banner is gone (~10 s). Close then goes to Home in one step. | Pass |

The banner now uses the play HUD's dark colours with white text in both themes and is easy to read. The play screen no longer shows without the banner first: the earlier ~3 s gap (03) is gone. In the first play frame the map is still loading and the distances say "No GPS — distances from the tee" until the simulator's location arrives (~0.4 s). The dev Tools button still covers the Next chevron on the SE (dev builds only).
