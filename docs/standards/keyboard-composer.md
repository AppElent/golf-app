---
type: standard
kind: pattern
description: Read when adding or changing quick creation in a composer pinned to the keyboard.
version: 1.0.0
applies_to: [mobile]
---

# Keyboard composer

A **keyboard composer** (NL: toetsenbordcomposer, `KeyboardComposer` in code) makes new items fast, several in a row, with a few details set before saving. Builds on [editors](editors.md), which owns draft scope and commit rules, and on [mobile design](mobile-design.md).

## Rules

### When to use it

| Situation | Use |
| --- | --- |
| A new item that starts as one line, often several in a row, with a handful of optional details | Keyboard composer |
| Many required fields, validation across fields, nested navigation, or editing an existing item | Full form or screen; the composer's All details opens it |
| Plain text in a list that is being edited in place, with no details to choose | Inline row |

- A screen never offers a composer and an inline add row for the same kind of item.
- Every entry point on a screen (add button, menu item) opens the one composer, with the same preset and draft. The screen owns `open`. Hide the add control while the composer or another editor is up, and where the person cannot write.
- **Default:** a floating add button opens it. A list that is filled in bursts may use a bar pinned to its bottom instead. Content leaves room under either.

### Anatomy

Top to bottom, on a rounded card just above the keyboard, over a scrim that covers the header and tab bar:

1. **Handle**, in a full-width band that is also a button.
2. **Title**, focused on opening, and the **expand** button when the kind expands.
3. **Body**: always shown when the kind is mostly text, otherwise once chosen from +.
4. **Chip row**: **+** when the kind has details that are not always shown, then the context chips that always show, then each set detail. **Send** stays at the end of the row and is disabled until the item can be saved.
5. **Status** (what was just added, Undo) and **notice** (a failure), when there is one.

A card of completions may sit above the composer; it shrinks and scrolls first.

- The shared shell owns focus, gestures, the + menu's structure and layout, and knows no feature. Each kind supplies its title field, chips, menus, draft and save.
- A chip shows its value when set and its name when not. Tapping opens a native menu, so the keyboard stays up; a set detail's menu ends with Remove. A yes/no detail is a toggle chip without a menu.
- The + menu holds the details that are not always on the row, then All details in its own section. Every item has an SF Symbol; make the type require it.
- When typed text fills a chip, highlight the recognised words. A tapped value takes its words out of the title. Text typed later wins over an earlier tap. Removing a chip that typing filled leaves the words as plain text.

### Save

- Return in the title or Send saves. When the title leads to a body (a note), Return moves to the body instead.
- Save keeps the composer open: clear it before the answer arrives, focus the title, keep the context (list, calendar, preset date) and clear the other details. A landed save gives a haptic. **Default:** the new row is highlighted briefly where it appears.
- A draft carries one save key, sent as the create's idempotency key and deduped by the server. Guard a second Return on the client too.
- From its first send the key belongs to exactly what was sent, and a retry replays that unchanged. A server that already made the item answers the old row and ignores newer content. So when the outcome is unknown and the person edits the restored draft, replay what was sent first, then apply the edits as an update to the row it answers; keep them until that lands. Only a refusal that certainly wrote nothing lets the edited draft be a new create, under a new key.
- A failed save never overwrites what is being typed. If nothing was typed since, put the item back with a notice; otherwise ask Try again or Discard. Ask one alert at a time: iOS shows one and loses the next.
- If the item saved but a detail did not, keep the item and offer only that detail again.
- Offline, do not let the client queue the save silently: say it was not sent and keep the draft.
- All details keeps everything entered. Either hand the draft to the full form and forget it here only once the form has it, or save first and open the new item, with the fields held still while that save is pending.

### Close and drafts

- Scrim tap, swipe down, Android Back, and the app closing its sheets (for example for an incoming share) all close the same way: no confirmation, and the draft is kept. Dismissing only the keyboard does not close it. A composer closed for a share does not reopen by itself.
- A draft is in memory until it saves or the app is killed, under account, workspace (such as a household) and place. Keep it only when something was typed or changed from the preset.
- Forget a sent draft by its save key when it lands or is discarded; a newer draft stays. One restored and edited since it was sent is not forgotten when its create lands or is replayed, only when the update carrying those edits lands or the person discards it. A composer reopened while that save is pending waits for it.

### Expand, drag and panels

- Expanding grows the card to just under the status bar, keyboard up, with a multi-line body and every detail as a chip. Collapsing loses nothing.
- A kind whose items need no room is not expandable: no expand button, and the handle closes the card with the draft kept.
- The small card drags vertically from **anywhere** on it: up expands, down closes. A horizontal move scrolls the chips. An expanded card, or one showing a panel, drags by its top band only: down collapses, further down closes. The card follows the finger. Keep thresholds in a pure, tested module, and ignore a cancelled gesture.
- A wheel or calendar replaces the keyboard, under the chips, and gives focus back to the title when it closes. Picking a day sets it and closes the calendar; paging months does not. A wheel closes on Done.
- The list behind does not move. Give it no keyboard inset for the composer's keyboard.

### Undo and other people

- The server decides. Never compute a shared value or an undo from what this screen last showed. Where a create or change shares a row with others, the mutation answers what it did: whether it created the row, and the amount before and after.
- Add to an amount with a server-side increment. Set one conditionally on the value the person saw. Undo one conditionally on a revision or operation id the server keeps for it as well as the value: the value alone cannot tell that somebody changed it and changed it back. On a refusal, leave the other person's change and treat the undo as done for that part.
- Undo takes back one item at a time, newest first, and only what that save did. It removes a row other people can change, the new item included, only when that save created it and nobody else has added to, kept, flagged or edited it since, even when the row looks the same again. The server checks that and deletes in one mutation, from what it records on the row, such as a revision and who else added it; never send a plain delete. A person who leaves or deletes their account is taken out of that record.
- Send writes to one item in turn. Undo waits for writes of ours to the same item, and one undo per item runs at a time. If its data has not loaded, or it fails, say so and keep the Undo.
- New arguments and fields are optional, and a call without them gets the answer it always got; a richer answer is opted into. So installed apps keep working. The backend deploys first, and a schema rollback keeps the new optional field.

### Accessibility

- Handle and expand are buttons named Expand or Collapse; on a one-size card the handle is "Close, the draft is kept". The scrim is Close, + is More details. Every gesture has one of these buttons.
- A chip reads as "Name: value" when set and its name when not; a toggle chip is a switch with its state. Send exposes disabled and busy. A notice is an alert.
- Announce the status line when it changes; focus stays in the title.
- With large text, chips grow and the row scrolls, the title wraps, and completions scroll. Highlights and expansion follow Reduce Motion.

### Platforms

- iOS is the reference. Use a transparent modal rather than a sheet: the card tracks the keyboard and is not a detent. It needs its own safe-area provider, because a tab screen's bottom inset includes the tab bar.
- A native menu keeps the keyboard up; a wheel cannot sit over it, so it lowers it. An iOS text prompt cannot be closed from code: a flow that closes the composer waits for the answer. Menus that open upward draw their first item nearest the button.
- Android is paused. Keep the existing platform branches (the window resizes, pickers are dialogs, a text prompt becomes a panel) and report Android as untested.
- Web is out of scope; it uses its own accessible controls under [editors](editors.md).

## Implementation

Reference: Gather's phone app. It is not distributed; adopt it by copying the shell into the app and binding it to the app's tokens, strings and icons.

| Part | Source in [`apps/mobile/src`](https://github.com/AppElent/gather/tree/main/apps/mobile/src) |
| --- | --- |
| Shell, add button | `ui/keyboard-composer.tsx` |
| Drafts, save keys, pending saves | `ui/composer-drafts.ts` |
| Drag thresholds and outcomes | `ui/composer-gestures.ts` |
| + menu, date and time panels | `ui/composer-menu.ts`, `ui/composer-panel.tsx` |
| Task: typed recognition, saves before All details | `modules/tasks/AddTaskComposer.tsx` |
| Note: title then body, one toggle chip, no + | `modules/notes/AddNoteComposer.tsx` |
| Event: several entry points, hands its draft to the form | `modules/calendar/AddEventComposer.tsx` |
| Grocery item: bar, one size, completions, status, Undo | `modules/tasks/GroceryComposer.tsx` |

Designs: [task, note and event](https://github.com/AppElent/gather/blob/main/designs/tasks/quick-add_final.md), [grocery item](https://github.com/AppElent/gather/blob/main/designs/groceries/composer_final.md). Where a design and this standard differ, this standard holds.

Do not copy these from the reference, which falls short of the rules above:

- The task and grocery kinds show failed-save alerts without queueing them, and only the event kind checks for offline.
- The task, note and event kinds restore a failed draft editable under the key it was sent with.
- Grocery Undo of an amount checks its value only, not a revision.
- Grocery Undo of a new item is a plain delete, whatever others did to it. Undo of a staple checks whether it is flagged now and who else added it, so a flag that was set and cleared again does not stop it.
- A note added to an open grocery item is computed on the phone.

1. Copy the shell and its tests; add one `<Kind>Composer` with a pure draft module (empty, dirty, next, composed).
2. Make the create mutation dedupe on the save key before wiring Save.
3. Add Undo only with the server support above; without it, leave Undo out.

### Candidate adoptions

Not built and not scheduled. Each needs its own issue and an approved design.

| App | Item | Title and likely chips |
| --- | --- | --- |
| Gather | Shared cost | Description; amount, payer, pot, date |
| Gather | Planned meal | Meal; day, slot |
| Foundry | One-off diary entry | Food; details as the diary defines them |
| Foundry | Workout note | Note text; details to be designed |

## Verify

- Unit tests: drag outcomes, draft rules (empty, dirty, next, forget by key), menu symbols.
- Component tests: second Return makes one item, retry reuses the key and content, a create that landed with its answer lost and is then edited keeps the edits, failure while typing the next item, close mid-save and reopen.
- Server tests: two people add, change and undo the same item in both orders; A adds, B changes the amount and changes it back, and A's Undo leaves it; B edits or flags A's new row, also when reversed, and A's Undo leaves it; a call without the new arguments answers as before. Tests that run mutations one after another do not prove interleaving; that rests on the database's transactions.
- iOS, keyboard up: drag from the handle, beside it and from the title; chips scroll; list behind stays put on open, typing and close; date pick closes; close by scrim, swipe and share, then reopen with the draft. Check drags with a finger on an iPhone: a simulator pointer hits a target that a fingertip misses.
- Light and dark, the smallest phone, largest text, each app language, VoiceOver, Reduce Motion, offline.
