---
type: standard
kind: platform
description: Read before designing or changing any user interface.
version: 1.6.0
applies_to: [web, mobile]
---

# General design

Every screen designs all its states, preserves input, and makes destructive actions deliberate.

## Rules

- Before changing a screen, identify the user's immediate job, primary action, entry/exit navigation, presentation, and Back/Cancel behavior. Design populated, initial-loading, empty, error, pending, refresh, long-text, and keyboard states together.
- Use a layout-matched skeleton when content shape is predictable; otherwise use appropriate progress feedback. Keep existing content during refresh.
- Show pending state on the action that initiated work and prevent duplicate submissions. Keep input after failure and surface an actionable error through the app's canonical feedback. Use success notifications only when the result is not already visible. Empty states explain what is absent and offer a useful next action.
- Confirm destructive actions that would lose meaningful data through the app's accessible confirmation mechanism. Name the action in the confirmation button; cancel leaves data unchanged.
- For editable drafts, apply the [editors pattern](editors.md) for ownership, commit, and dismissal.
- Use the project's canonical components and semantic tokens. Respect text scaling, reduced motion, accessible names, and supported locales/themes.
- Build with the app's design system tokens and components; do not invent one-off styling. Before designing a new screen, look up references (for example Mobbin) for the same job. On iOS, follow the Apple HIG and use native controls ([iOS design](ios-design.md)).
- **Default:** visual identity comes from the design system; without one, commit to a small named one (1–3 typefaces, one ground, 0–2 accents) and one icon family, with type sizes and spacing consistent across screens. Treat generic AI-generated tells as unfinished work: a cream ground or display serif chosen by habit rather than brief, emoji in place of icons, decorative gradient washes, and cards with a colored left border.

## Verify

- Delayed, empty, and failed responses as well as success. A screenshot does not establish interaction behavior.
- Every pull request that changes UI carries screenshots: iOS simulator and web, light and dark, and a small screen. The reviewer judges the screenshots as well as the code. New screens or flows are designed and approved before they are built ([design studies](design-studies.md)); their screenshots are compared with the approved design, and a visible deviation waits for the owner's approval before merge. Small UI fixes proceed with the screenshots in the PR.
