---
type: decision
description: Read before deciding which platform a feature ships on, adding or moving a web or phone route, or adding a shareable link.
version: 1.0.0
status: accepted
date: 2026-11-14
---

# The phone plays rounds, and the web authors courses

Fairway has two clients of one Convex backend: the TanStack Start web app
(`src/`) and the Expo phone app (`apps/mobile/`). The web app started as a
phone-shaped PWA, so it still plays rounds too, and nothing said which
features belong where. This ADR applies the platform-parity standard
([AppElent/developer-home#2](https://github.com/AppElent/developer-home/pull/2))
to Fairway. `packages/core/src/features.ts` (`@fairway/core/features`) lists
every feature with its status, platforms and reason, and
`scripts/feature-manifest.test.ts` fails `pnpm test` (and so `pnpm verify` and
CI) when a route file on either platform belongs to no feature or a pattern
matches no route.

## Decision

**The phone is the leading platform. It plays and reviews rounds**: round
setup, play with GPS distances, scoring, the lock-screen hole view, round
history and sharing, stats, the club bag and the simulator. A new feature
ships on the phone only, unless it is floor or a share target.

**The web authors courses.** Making a private copy of a catalog course,
editing its tees and holes, and suggesting catalog corrections are web work.
`course-authoring` is `exclusive` to the web and declared
`layout: "large-screen"`: editing a course, and later its geometry on a map,
needs a large screen and a keyboard. The page today is still the phone-width
form inside the 430px web shell, with no "best on a larger screen" notice; that
gap is a follow-up, not a reason to declare it responsive.

**The web's round screens are legacy.** `/`, `/play`, `/card`, `/rounds/new`,
`/progress` and `/profile` predate the phone app. They are `parity` in
`features.ts` because they exist on both platforms today. Do not grow them:
new play and review features go to the phone. Whether to retire them is
Eric's call and a separate change; this ADR changes no runtime behaviour.

**The web floor is reduced** to sign-in, sign-out, the privacy page, account
deletion and data export. People manage their golf on the phone; the web is a
tool for the few who author courses, so account editing, language and theme
there would be cost without users. Consequences in `features.ts`:

- `language` and `theme` are `exclusive` to the phone, with a reason linking
  this ADR. The web is English-only and follows the OS colour scheme.
- `account-profile` (name, email, password) is owed by the phone only. Neither
  platform edits it yet, so it is `pending-port` with no platforms.

**The reduced floor is not met yet.** These are `pending-port` with follow-ups:

- `sign-out`: the phone has it; the web shell has no sign-out control.
- `account-deletion`: the phone deletes the account (`convex/account.ts`
  `deleteMyData`, then the Clerk user); the web does not. A web port reuses
  the same mutation.
- `data-export`: neither platform exports a user's data. When it lands, it
  covers every table on both platforms, including data whose screens are
  phone-only.

`privacy` is `parity`: the web serves `/privacy` publicly, and the phone opens
that page from the Profile tab. `support` is a web page the App Store listing
links to; the phone reports problems in-app through Sentry user feedback.

**Share targets: none.** Sharing a round sends an image and text from the
phone, not a link, and no web page is meant to be sent to someone. So Fairway
claims no `https` path with iOS universal links or Android app links today. The
first share link adds the `.well-known` files, `associatedDomains` and
intent filters in one native build.

**One web client.** Expo web is not a deploy target. `apps/mobile` sets no
`platforms`, so `expo config` still lists `web` by default. Removing it changes
the native runtime fingerprint, so it waits for a change that ships with a new
native build.

## Consequences

- Adding a web or phone route without a `features.ts` entry fails CI. The PR
  that adds a feature states its platforms and adds or updates its entry.
- A floor feature can never be `exclusive` without a reason linking this ADR;
  only `language` and `theme` use that.
- Data deletion and, once built, export cover every table regardless of which
  platform shows the data.

## Rejected

- Full floor on the web: account editing, language and theme on a web app
  used only for course authoring cost more than they return.
- Declaring the web round screens `exclusive` to the phone now: they still
  ship, and the manifest records what ships, not what is planned.
- Declaring `course-authoring` responsive: its role is large-screen editing,
  and the declaration makes the missing large-screen layout visible.
