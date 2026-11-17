---
type: standard
kind: capability
description: Read when adding or changing an MCP server, its tools, transport, or client authentication.
version: 4.0.1
applies_to: [web, backend]
---

# MCP server

MCP tools are thin, authenticated adapters over the app's own domain services.

## Rules

- Domain services and permission checks stay in the app; the MCP layer is a thin transport adapter.
- Each tool has an input schema, a stable output, and declared permissions. Prefer narrow tasks over arbitrary execution primitives.
- Every call validates input and resolves identity before touching user data; deny when identity or scope cannot be resolved. Repeat resource-level permission checks inside domain operations. A tool name is never authorization.
- Define how non-browser clients obtain and present credentials, including expiry and scope; a browser session cookie is not available to them. Use OAuth for third-party account access, or explicitly configured internal access control.
- Remote endpoints never share request-specific mutable state across users: choose request-scoped stateless handling or explicit durable session state.
- Browser-reachable HTTP endpoints validate `Origin` against an explicit policy and protect tool discovery when metadata is sensitive.
- Tool responses never carry provider errors or secrets.
- stdio servers write protocol data only to stdout and diagnostics to stderr.
- **Required:** a tool that creates data takes a client-supplied idempotency key that the backend enforces: a retry with the same key and input returns the first result, and the same key with other input fails.
- **Default:** remote endpoints run the MCP SDK's stateless Streamable HTTP transport (no session ID, JSON responses, POST only; GET and DELETE answer `405`) in the app's own route. Use the Cloudflare Agents SDK only when the server needs durable sessions. Local servers use the MCP SDK over stdio.
- **Default:** remote user access uses the app's Clerk instance as the OAuth authorization server. See [OAuth with Clerk](#oauth-with-clerk).
- **Default:** two custom scopes, `<app>:read` and `<app>:write`. Register only the tools the token's scopes allow, so `tools/list` matches what the user granted.
- **Default:** annotate every tool. Reads set `readOnlyHint`; writes set `destructiveHint: false` and `idempotentHint` truthfully. Offer no delete tools; users delete in the app.
- **Default:** include `get_current_user` (user ID, name, email, granted scopes, server time) so agents can confirm the account and resolve "today".
- **Default:** return results as `structuredContent` plus the same JSON as text. Errors show validation messages and the backend's user-facing messages only.

## OAuth with Clerk

1. Serve RFC 9728 protected-resource metadata at
   `/.well-known/oauth-protected-resource/mcp` with `resource` = the endpoint URL,
   `authorization_servers` = the Clerk issuer (the Frontend API), and both scopes in
   `scopes_supported`. Relay Clerk's `/.well-known/oauth-authorization-server`
   from the app origin for clients that look there.
2. Answer requests without a valid token with `401` and
   `WWW-Authenticate: Bearer resource_metadata="<metadata URL>", scope="<scopes>"`.
   Answer a token without either scope with `403` and `error="insufficient_scope"`.
3. In Clerk: create the scopes (OAuth applications → Scopes; Dashboard only), and
   turn on JWT access tokens, PKCE, and the audience claim. Register the endpoint
   as an MCP resource. Set `default_scopes` to
   `openid profile email <app>:read <app>:write`; Clerk applies them only when a
   client omits `scope`.
   **Default:** leave dynamic client registration off. Claude.ai, Claude Code, and
   other current clients identify themselves with Client ID Metadata Documents
   (CIMD) when the authorization server metadata has both
   `client_id_metadata_document_supported: true` and `none` in
   `token_endpoint_auth_methods_supported`; turn on DCR only for a client that
   needs it. Turn on **Publish CIMD support** (OAuth applications → Settings →
   Client onboarding), then check both fields in the issuer's
   `/.well-known/oauth-authorization-server`. Clerk turns CIMD on by itself only
   for the first MCP server on an instance, so check it for every later one.
   **Required:** Clerk's production CNAMEs (`clerk`, `accounts`, mail, DKIM) are
   DNS only. A Cloudflare-proxied `accounts` record fails sign-in and consent with
   Cloudflare Error 1000.
4. Verify the JWT locally against the issuer's JWKS: issuer, `RS256`, and `aud`
   exactly equal to the endpoint URL. The audience check rejects tokens for other
   apps on a shared Clerk instance.
5. Convex: pass the same token to Convex and trust it with a `customJwt` provider
   per endpoint URL (`issuer`, `jwks`, `algorithm: "RS256"`, `applicationID` = the
   endpoint URL). `identity.subject` is the Clerk user ID, so existing ownership
   checks apply. Read the URLs from one env var. Convex fails a push when a
   variable `auth.config.ts` reads is unset, so every deployment defines it and
   deployments without MCP use a non-URL placeholder such as `none`.
6. A client holding the token can call Convex directly, so Convex enforces the
   scopes too. Route every `ctx.auth.getUserIdentity()` through one helper. For an
   OAuth identity (it carries `client_id`), it requires a read or write scope,
   rejects mutations and actions without the write scope, and lets account-wide
   resets and deletions reject OAuth identities entirely.

Clerk saves a CIMD client with the scopes it may request the first time that
client connects. A client first seen before the scopes or `default_scopes`
existed keeps failing with `invalid_scope` until its scopes are edited, or it is
deleted under OAuth applications so Clerk creates it again. The same snapshot
explains a `403 insufficient_scope` on a client that connected: `default_scopes`
do not apply, because the `401` challenge always sends `scope`.

Store MCP idempotency keys with an `mcp:` prefix so they cannot collide with the
app's own operation IDs.

## Implementation

1. Write the domain functions first and test them without MCP.
2. Remote: mount a dedicated `/mcp` route in the app. Build a new server and
   transport per request after authorization. Keep normal routing, bindings, and
   error handling.
3. Exclude `/mcp` and `/.well-known/` from service-worker navigation fallbacks.
4. Local: document the exact launch command and required environment variable names.
5. Document the endpoint, how each client connects, the Clerk and backend setup per
   environment, the tool list with required scopes, and limitations.

## Verify

- Domain: success, invalid input, unauthorized resource, stable result, and failure response.
- Protocol: initialize, tools/list per scope, tools/call, unknown tool, invalid arguments, missing or expired credentials, wrong audience, and insufficient scope.
- Idempotency: the same key twice returns one record; the same key with other input fails.
- End to end: complete a CIMD sign-in with PKCE and consent against the deployed endpoint, then connect a real client (Claude Code: `claude mcp add --transport http <name> <url>`, then `/mcp`) and call a read and a write tool. Connect Claude.ai separately: it uses its own client, callback, and Anthropic's servers, so a working Claude Code connection does not prove it.

## Troubleshooting

Claude.ai reports "Authorization with <name> failed" for any OAuth failure. Find
where the flow stops:

1. Tail the server's logs while connecting. Claude.ai calls the endpoint from
   `160.79.104.0/21` (user agent `python-httpx`): a `401` and a metadata fetch
   with no later request carrying a token means the failure is at the
   authorization server.
2. Read the `error` and `error_description` on Claude.ai's callback
   (`https://claude.ai/api/mcp/auth_callback?...`), for example from browser
   history. Clerk names the cause there, such as `invalid_scope`.
3. Run the authorize URL with Claude's client ID
   (`https://claude.ai/oauth/mcp-oauth-client-metadata`) and look for a hosted
   page that fails before the callback, such as a Cloudflare error.

## Migration

From 3.x: turn off DCR in Clerk unless a client needs it; CIMD covers Claude
clients. Set Clerk's CNAMEs to DNS only. Edit or delete CIMD clients created
before the scopes existed.

From 2.x: the remote default moves from the Cloudflare Agents SDK to the MCP SDK's
stateless transport. Existing Agents SDK servers may stay. New create tools need
idempotency keys. Replace custom token hand-off flows with Clerk OAuth when a server
must work with hosted clients such as Claude.ai or ChatGPT.
