# Add MCP Server Capability Design

## Purpose

Create a reusable Appelent capability for adding Model Context Protocol (MCP)
servers to projects. The capability should preserve the useful idea in this
app's current MCP demo while replacing demo-specific choices with a repeatable,
current, production-oriented workflow.

The primary output should be a skill named `add-mcp-server`. A shared package
should be introduced only when multiple projects need to import the same runtime
code.

## Current Demo

This app currently demonstrates MCP with:

- `src/routes/mcp.ts`: a TanStack Start server route that registers an MCP tool.
- `src/utils/mcp-handler.ts`: a custom request bridge using
  `InMemoryTransport`.
- `src/mcp-todos.ts`: demo state and persistence for a todo tool.
- `@modelcontextprotocol/sdk` and `zod` as runtime dependencies.

The demo proves the project can expose an MCP endpoint from a TanStack Start
route, but it should not be copied directly into future apps as the canonical
pattern. It keeps a global `McpServer` instance and uses an in-memory bridge,
while current remote MCP guidance favors Streamable HTTP, per-request server
creation for stateless servers, and Cloudflare's `createMcpHandler` helper for
Workers-hosted endpoints.

## Decision Rule

Use a skill when the reusable value is process, judgment, wiring, or project
adaptation.

Use a package when the reusable value is code that applications import at
runtime or test time.

For MCP specifically:

- Create `add-mcp-server` as the first reusable asset.
- Create `@appelent/mcp` only after at least two projects need the same imported
  helpers, adapters, test utilities, or auth conventions.
- Let the skill point to `@appelent/mcp` once the package exists.

## Recommended Approaches

### Approach 1: Skill Only

Create an `add-mcp-server` skill that guides agents through dependency
selection, transport selection, endpoint wiring, tool design, auth, tests, and
verification.

Trade-offs:

- Fastest to create.
- Best fit while MCP patterns and project needs are still evolving.
- Does not create reusable runtime APIs.

Recommendation: start here.

### Approach 2: Package Only

Extract helpers into `@appelent/mcp` and have each app wire them manually.

Trade-offs:

- Good for repeated runtime code.
- Weak for architecture decisions, auth setup, Cloudflare configuration, and
  project-specific integration.
- Risks freezing abstractions before enough usage exists.

Recommendation: do not start here.

### Approach 3: Skill Plus Package

Create a skill now and a package once repeated code patterns become clear.

Trade-offs:

- Best long-term structure.
- Slightly more process overhead.
- Keeps implementation reusable without forcing premature package boundaries.

Recommendation: use this as the target shape.

## Capability Requirements

The `add-mcp-server` skill must help an agent:

1. Detect project stack and hosting target.
2. Choose local stdio versus remote Streamable HTTP.
3. Choose stateless server versus stateful server.
4. Choose public, app-authenticated, OAuth, or Cloudflare Access protection.
5. Add the smallest required dependency set.
6. Register focused MCP tools with Zod input schemas and clear descriptions.
7. Keep tool names stable, specific, and agent-friendly.
8. Avoid wrapping a full application API as one-to-one MCP tools.
9. Validate origin/auth for remote endpoints.
10. Add tests for tool behavior and endpoint behavior.
11. Verify with MCP Inspector or an MCP client.
12. Document client connection instructions.

## Architecture

### Skill

The skill should live in the global Appelent/Codex skills area, with a repo-local
mirror only if needed for browser or fallback environments.

Suggested structure:

```text
add-mcp-server/
  SKILL.md
  references/
    tanstack-start-cloudflare.md
    cloudflare-worker.md
    auth.md
    testing.md
```

`SKILL.md` should stay short and contain:

- trigger description
- decision tree
- required discovery steps
- route to the relevant reference file
- verification checklist

Reference files should hold framework-specific examples and commands.

### Optional Package

Create `@appelent/mcp` only when code reuse appears in multiple apps.

Likely package contents:

- `createAppelentMcpServer()` conventions for metadata and tool registration
- response helpers for text and structured JSON
- auth context helpers
- test helpers for calling tools without a network round trip
- framework adapters only when they are genuinely stable

The package README must be the source of truth for humans and all coding agents.
The skill should point to the README instead of duplicating package API details.

## Default Implementation Pattern

For Cloudflare-hosted remote MCP servers, prefer:

- Streamable HTTP transport.
- `createMcpHandler` from `agents/mcp`.
- A fresh `McpServer` instance per request for stateless servers.
- Durable Object backed state only when the MCP tools need per-session state,
  elicitation, resumability, or server-to-client behavior.

For this TanStack Start app, the future production version should likely replace
the demo `InMemoryTransport` bridge with a Cloudflare-compatible handler or a
thin adapter that follows the same per-request server creation rule.

## Dependencies

Baseline:

- `@modelcontextprotocol/sdk`
- `zod`

Cloudflare remote MCP:

- `agents`
- `wrangler` for local development, type generation, and deployment

Authenticated OAuth MCP:

- `@cloudflare/workers-oauth-provider` or the provider required by the selected
  auth design
- storage binding such as KV if the OAuth flow requires it
- secrets for OAuth client IDs, client secrets, and cookie encryption

Project rules:

- Use `pnpm` only.
- Respect `pnpm-workspace.yaml` supply-chain controls.
- Rerun Cloudflare type generation when Worker bindings change.

## Testing And Verification

Minimum verification for any MCP addition:

- Typecheck.
- Unit tests for tool functions.
- Endpoint test for `initialize`, `tools/list`, and at least one `tools/call`.
- MCP Inspector manual verification for local development.
- Authentication denial test when auth is enabled.
- Origin or host validation test for remote/local browser-exposed endpoints.

Where useful, add eval-style fixtures that check whether an agent can discover
and use the intended tools with realistic prompts.

## Migration For This App

This repo should treat the current MCP todo route as a learning artifact. A
future implementation pass can:

1. Move tool construction into a `createMcpServer()` factory.
2. Replace global server reuse with per-request creation.
3. Replace the custom handler with the current Cloudflare-compatible MCP handler
   pattern where feasible.
4. Move todos out of filesystem JSON before production deployment.
5. Add tests around tool registration and calls.
6. Remove or relabel the demo UI once a real golf-domain MCP tool exists.

## Open Decisions

- Whether `add-mcp-server` should live under global Codex skills,
  global Claude skills, or both.
- Whether Appelent wants a generic `@appelent/mcp` package immediately or after
  the second project needs shared runtime helpers.
- Which first real golf-domain tool should replace the todo demo.

## References

- Cloudflare Agents MCP overview:
  `https://developers.cloudflare.com/agents/model-context-protocol/`
- Cloudflare remote MCP guide:
  `https://developers.cloudflare.com/agents/model-context-protocol/guides/remote-mcp-server/`
- Cloudflare MCP transport guidance:
  `https://developers.cloudflare.com/agents/model-context-protocol/protocol/transport/`
- MCP transport specification:
  `https://modelcontextprotocol.io/specification/2025-06-18/basic/transports`
- MCP tools specification:
  `https://modelcontextprotocol.io/specification/2025-06-18/server/tools`
