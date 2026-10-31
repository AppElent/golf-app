---
type: standard
kind: pattern
description: Read when iterating on interactive screen studies or promoting their decisions.
version: 1.1.0
applies_to: [web, mobile]
---

# Design studies

Studies iterate in self-contained rounds, cover every state before approval, and hand decisions to their owners.

## Rules

- Read the affected design system, tokens, existing studies, and component APIs. Inventory the current screen's actions, menus, gestures, and states; a redesign retains them unless their removal is agreed. Use realistic data and the product's chosen language.
- Keep each round as a self-contained HTML file with inline assets/code and a link to the preceding round. Start with a numbered critique ranked by impact. Offer 1–5 alternatives where choices remain open; identify the recommendation and why. Label states and alternatives distinctly. Make important interactions operable: menus, scrolling, selection, theme, and keyboard-related compositions where feasible.
- Before finalizing, show applicable navigation/header states, the complete action inventory, gestures and visible alternatives, bulk actions, follow-up forms, empty/loading/error/offline/draft states, long text, larger text, and themes. Summaries need routes to detail and the data that explains them.
- HTML studies establish design intent, not native acceptance.

## Implementation

1. Show one screen at a time in the host's shared browser/preview. Serve local studies when needed; use a reachable address when the user is on another machine. Inspect the rendered result before presenting it.
2. After approval, write a final artifact containing the selected states and links to the deciding rounds. Include actual component/API bindings, installed-version constraints, and remaining runtime questions. Beside it, write a Markdown companion with the implementation notes, every state, and the exact copy; implementers read the companion and use the HTML as the visual reference. Keep earlier rounds as history.
3. Classify each accepted decision with the [documentation standard](documentation.md). Extract reusable patterns into a developer-tools standard; product contracts retain identity, bindings, domain behavior, and explicit exceptions. If shared adoption is unresolved, label it proposed with applicability and evidence.

## Verify

- Compare the implementation per state with the [verification standard](verification.md).

## Exceptions

Record in `DESIGN_SYSTEM.md`: rule, scope, replacement, reason.
