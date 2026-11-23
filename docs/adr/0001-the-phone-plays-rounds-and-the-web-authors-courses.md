---
type: decision
description: Read before deciding which platform a feature ships on, adding or moving a web or phone route, or adding a shareable link.
version: 1.1.0
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

**The web authors courses.** Making a private copy of a catalog course and
editing its tees and holes are web work. Suggesting a catalog correction is
lighter and stays on both platforms (`course-suggestion`): a golfer spots the
mistake on the course.
`course-authoring` is `exclusive` to the web and declared
`layout: "large-screen"`: editing a course, and later its geometry on a map,
needs a large screen and a keyboard. Its routes leave the 430px web shell and
use the window's width; at phone width they show a "best on a larger screen"
notice (`src/components/large-screen.tsx`, APP-117).

**The web's round screens are retired** (Eric, 17 Nov 2026, APP-123; removed
in APP-235). `/`, `/play`, `/card`, `/rounds/new`, `/progress` and the golfer
parts of `/profile` predated the phone app. Now:

- `/` is "Open the Fairway app" (`open-the-app`, public): the TestFlight
  beta (and the App Store once `APP_STORE_LIVE` in
  `src/components/app-links.ts` is flipped at the first store release), and
  links to course authoring and the Account page.
- The Worker (`src/server.ts`) answers `/play`, `/card`, `/rounds/new` and
  `/progress` with a 301 to `/` (`RETIRED_PATHS` in
  `src/components/app-links.ts`); their routes and components are gone.
- `/profile` is the Account page: data export, sign-out and account deletion.
- `home`, `round-setup`, `round-play`, `stats`, `simulator`, `settings`,
  `handicap`, `home-course` and `club-bag` are `exclusive` to the phone in
  `features.ts`.
- The tab bar holds Courses and Account.

The Convex functions the web screens called are unchanged: the phone calls
them too.

**The web floor is reduced** to sign-in (with sign-up and password reset),
sign-out, the privacy page, account deletion and data export. People manage their golf on the phone; the web is a
tool for the few who author courses, so account editing, language and theme
there would be cost without users. Consequences in `features.ts`:

- `language` and `theme` are `exclusive` to the phone, with a reason linking
  this ADR. The web is English-only and follows the OS colour scheme.
- `account-profile` (name, email, password) is `exclusive` to the phone, with a
  reason linking this ADR. The phone edits it from the Profile tab since
  APP-120.

**The reduced floor is met.** `sign-out` is `parity` since APP-116: both sign
out from the Profile tab. `password-reset` is `parity` since APP-120: the web
through Clerk's sign-in card, the phone through "Forgot password?" on its
sign-in screen. `data-export` is `parity` since APP-121 and `account-deletion`
since APP-118: both export and delete from the Profile tab; the web deletes
through the same `deleteMyData` mutation, then the Clerk user.

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
- Data deletion and export (both shipped, `parity`) cover every table regardless of which
  platform shows the data.

## Rejected

- Full floor on the web: account editing, language and theme on a web app
  used only for course authoring cost more than they return.
- Declaring the web round screens `exclusive` to the phone while they still
  shipped (14 Nov 2026): the manifest records what ships, not what is planned.
  They became `exclusive` when APP-235 removed them.
- Declaring `course-authoring` responsive: its role is large-screen editing,
  and the declaration makes the missing large-screen layout visible.
