# AI Context Chat Widget

A Cumulocity Cockpit dashboard widget that lets you chat with an AI Agent Manager agent about the device, group, or asset the current dashboard is scoped to — without hardcoding any device/asset ID in the agent's prompt. It's a thin wrapper around Cumulocity's own official chat UI (`AgentChatComponent` from `@c8y/ngx-components/ai/agent-chat`): that component owns the chat itself (message list, markdown rendering, streaming, loading state) and talks to the AI Agent Manager via the platform's own `AIService`. This widget's job is narrower — resolve whatever managed object the dashboard is scoped to into the `variables` the agent's prompt can reference, and lay out a config page matching the stock "AI Agent Chat" widget's own.

See [TESTING.md](TESTING.md) for how this was verified (real builds, a live-tenant test pass, and the actual bugs found and fixed along the way) and [meridian-ops-insights-agent-prompt.md](meridian-ops-insights-agent-prompt.md) for an example agent system prompt that works with this widget's context variables.

## Prerequisites

- Node.js and npm (a version compatible with Angular 21 — Node 20+).
- Access to a Cumulocity tenant with the AI Agent Manager microservice installed and at least one agent configured.

## Install

```
npm install
```

## Run against your tenant

```
npm start
```

Runs `ng serve ai-context-chat-widget-plugin --shell cockpit`, which proxies a real Cockpit shell from your tenant (default: `demos.cumulocity.com`) and loads this plugin's widget into it as a Module Federation remote. To point at a different tenant:

```
npm start -- -u https://<your-tenant>.cumulocity.com
```

You'll be prompted to log in with your Cumulocity credentials. Once loaded, add the widget to a device, group, or asset dashboard via the "Add widget" picker — it's listed as "AI Context Chat".

## Build

```
npm run build
```

Produces `dist/ai-context-chat-widget-plugin/ai-context-chat-widget-plugin.zip` — a deployable plugin package.

## Deploy

```
npm run deploy
```

Uploads the built plugin to your tenant (`ng deploy`).

## Test

```
npm test
```

Runs the unit test suite (Vitest, via Angular's `@angular/build:unit-test` builder — the same setup `ng add @c8y/websdk` itself scaffolds). Covers the widget's own logic: managed-object-to-context mapping, the AI Agent Manager agent-directory fetch/parsing, and the two components' getters/form behavior. It does not cover `AgentChatComponent` itself (that's Cumulocity's own tested code) or the live end-to-end flow against a real tenant — see TESTING.md for what's only been verified manually.

## Configuring the widget on a dashboard

After adding the widget, its config page has:

- **Asset selection** — provided automatically by the dashboard host (not this widget's own config UI), since this is a context-dashboard widget. This is what determines which device/group/asset the widget is scoped to.
- **Show header with agent details and controls** — toggles a header row above the chat showing the agent's name, type, and availability, plus live cumulative token usage.
- **Hide tool call details** — hides the "Used tool ..." style indicators `AgentChatComponent` shows while the agent is working. Built dynamically from the selected agent's own MCP tool list, so there's nothing to configure per-tool.
- **Chat title** — optional heading shown above the chat.
- **Welcome text** — optional message shown before the first exchange.
- **Select Agent** (required) — a dropdown populated from your tenant's configured agents (`GET /service/ai/agent`). Falls back to a free-text field if that fetch fails for any reason (e.g. permissions). Whatever you pick here is the `{agentName}` segment of `/service/ai/agent/text/{agentName}`.
- **Selected** — a read-only JSON preview of the selected agent's full configuration record, for reference.

Whatever managed object the dashboard is scoped to is passed to the agent as request variables: `contextObjectId`, `contextObjectName`, `contextObjectType`, `contextObjectKind` (`device`/`group`/`asset`), and `deviceId` (only set when `contextObjectKind` is `device`). Your agent's system prompt should read these rather than assume it's always scoped to a device — see the example prompt linked above for a prompt that handles all three kinds, including resolving a queryable device when scoped to an asset/group that has none of its own.

## Project structure

```
src/
  ai-context-chat-widget/
    index.ts                                  — widget registration (hookWidget)
    ai-context-chat-widget.component.ts/html/scss   — the widget itself
    ai-context-chat-widget-config.component.ts/html/scss — its config page
    ai-agent-directory.service.ts             — GET /service/ai/agent (agent picker + header)
    managed-object-context.util.ts            — pure device/group/asset mapping logic
    *.spec.ts                                 — unit tests
  app/app.config.ts, main.ts, bootstrap.ts, index.html, ...  — plugin app shell (only used for local preview via `npm start`)
cumulocity.config.ts                          — plugin manifest (exports, federation config)
```
