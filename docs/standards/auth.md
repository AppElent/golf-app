---
type: standard
kind: capability
description: Read when adding or changing Clerk/Convex authentication, session readiness, or account flows.
version: 3.3.0
applies_to: [web, mobile, backend]
---

# Authentication

Clerk owns sessions and navigation; Convex verifies tokens and gates every protected read and write.

## Rules

- Navigation, provisioning, sign-out cleanup, theming, and credential routing stay app-owned. Never put login credentials in public build variables.

### Session readiness and protected data

- On web and native, navigation follows loaded Clerk session state; protected data follows Convex. Clerk's isSignedIn/userId does not establish backend readiness. Never redirect solely because Convex authentication is pending ([Convex's startup-race guidance](https://docs.convex.dev/auth/debug)).
- Keep ClerkProvider and ConvexProviderWithClerk mounted above the data gate. Mount protected query providers and screens only beneath an Authenticated component or a gate checking useConvexAuth().isAuthenticated. Hooks in the gate itself or ancestors remain unprotected. While the device is offline, the gate's fallback may show an [offline-readable copy](convex-query-caching.md#offline-readable-copy-last-known-only-opt-in), which makes no Convex calls.
- Outside that boundary, pass "skip" to protected useQuery/usePaginatedQuery calls until Convex authenticates. Guard imperative queries, mutations, and actions separately and handle rejections.
- Distinguish pending authentication from failure using isLoading and app-owned recovery behavior. After bounded waiting, reveal recovery controls; never use elapsed time to authorize requests or leave an indefinite blank screen. Normal token refresh need not make isAuthenticated false.
- Authentication loss unmounts gated children. Choose the boundary deliberately; preserve drafts according to app policy and clear or partition account-specific state on logout/account switching.
- Recover from throwing query hooks with an error boundary. Retain server identity and resource-permission checks on every protected operation; gating cannot guarantee later calls succeed.

### Account flows

- Use supported Clerk UI or custom flows covering verification, MFA, password reset, incomplete sessions, and activation/finalization. A successful password request is not a completed session. Preserve failed input, prevent duplicate submissions, and translate provider codes.

### Password managers

iCloud Keychain, Google Password Manager, 1Password and similar managers must offer, fill, save, and update credentials on every account screen.

- Mark every credential field. Web: `autocomplete` `username` on the email or username field, `current-password` on sign-in and on the current field of change password, `new-password` on sign-up, reset, and the new field of change password, `one-time-code` on code fields. Native: the same `autoComplete` values plus iOS `textContentType` `username`, `password`, `newPassword`, or `oneTimeCode`.
- Every form that sets a password names the account. Web: put the copied [`UsernameHint`](auth/examples/web/UsernameHint.tsx) in the form. Native: show the email as a read-only field with `textContentType="username"` above the password fields, on the reset step and on change password.
- Keep each flow in its own form or screen with a real submit. Native change password gets its own pushed screen: iOS AutoFill reads an inline current and new password pair as two new passwords and clears both without `onChangeText` when the strong-password offer is declined.
- AutoFill can set a native field without `onChangeText`. Also sync each credential field from `onEndEditing`, and submit the field's latest text.
- **Default:** native new-password fields pass iOS `passwordRules` matching the Clerk instance's password policy (`minlength: 8;` for Clerk's default), so generated passwords pass Clerk.
- Never block paste into credential fields, and never split a password over several inputs.
- Linking the app to its website, so a manager offers the website's saved logins in the app, is the `webcredentials` part of the app-links standard (associated domains and the `apple-app-site-association` file).

## Implementation

### Web wiring

Follow [Convex's Clerk integration](https://docs.convex.dev/auth/clerk). Validate public configuration through the app's environment schema; keep server keys server-only. For @clerk/react (Clerk Core 3) apps:

```tsx
import { ClerkProvider, useAuth } from '@clerk/react';
import { ConvexReactClient } from 'convex/react';
import { ConvexProviderWithClerk } from 'convex/react-clerk';

const convex = new ConvexReactClient(publicConvexUrl);
// publicClerkKey/publicConvexUrl come from app-validated public configuration.
<ClerkProvider publishableKey={publicClerkKey}>
  <ConvexProviderWithClerk client={convex} useAuth={useAuth}>
    <App />
  </ConvexProviderWithClerk>
</ClerkProvider>;
```

Use the installed SDK's adapter; preserve its generation and app-specific router options.

### Web account UI

For @clerk/react (Clerk Core 3) custom flows, copy the [web examples](auth/examples/web/index.ts) and their siblings into an app-owned directory; the index header lists what they provide and need. Import [tokens.css](auth/examples/web/tokens.css) from the app stylesheet, map its `--auth-*` variables onto the app palette, and add the [env typings](auth/examples/web/vite-env.d.ts) unless the app already declares those keys. Routes, labels, and branding stay app-owned through `AuthConfigProvider` and component props.

### Native and headless behavior

Copy needed [native helper](auth/examples/native.ts) behavior into app-owned code. Use the installed @clerk/expo version's official token cache and session finalization.

## Verify

Verify zero protected requests while Clerk is signed in and Convex is delayed, including provider-level subscriptions. Test authentication gained/lost/regained, account switching, draft handling, stalled-handshake recovery without redirect loops, new/existing accounts, incomplete/MFA flows, expired sessions, and unauthorized calls. Exercise cold launch and background/resume on a native device/build; report runtime verification separately from helper tests.

For password managers, on an iOS build with iCloud Keychain on, and in Safari and Chrome on the web: sign up and accept the save prompt, sign out and sign in from the AutoFill bar, reset the password and confirm the manager updates the existing entry instead of adding one, change the password the same way, and fill an emailed code from the keyboard suggestion. Decline the strong-password offer once on each new-password field and confirm the fields keep their values.
