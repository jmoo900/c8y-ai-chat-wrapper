# Testing the AI Context Chat Widget

This repo is a single-project Angular workspace (`angular.json`) rooted where the widget source lives — the actual Cumulocity plugin, `ai-context-chat-widget-plugin`. Widget source is in `src/ai-context-chat-widget/`.

```
npm install
npm start           # runs: ng serve ai-context-chat-widget-plugin --shell cockpit
```

Add `-u https://<your-tenant>.cumulocity.com` if you're not testing against the default `demos.cumulocity.com`. This proxies a real Cockpit shell and loads the plugin's exports into it as a Module Federation remote, so you can add the widget to a real device/group/asset dashboard.

`npm run build` runs a one-shot production build — produces `dist/ai-context-chat-widget-plugin/ai-context-chat-widget-plugin.zip`, a real deployable package. `npm run deploy` uploads it to your tenant (`ng deploy`). `npm test` runs the unit suite (Vitest via `@angular/build:unit-test` — see below).

There is no local/mocked *dashboard* test harness. An earlier version of this repo had one, but it mocked `FetchClient` directly — which stopped matching reality once the widget was rebuilt around Cumulocity's own `AgentChatComponent`, whose underlying `AIService` speaks the Vercel AI SDK's SSE data-stream protocol, not simple JSON. Properly mocking that (plus the agent-directory endpoint) was more work than the convenience was worth once live-tenant testing via `npm start` was working reliably — so it was deleted rather than left to bit-rot. There is, however, a real unit test suite (four `*.spec.ts` files alongside their source in `src/ai-context-chat-widget/`, 40 tests total) covering the widget's own logic — `managed-object-context.util`'s mapping functions, `AiAgentDirectoryService`'s fetch/parsing/caching, and both components' getters/form/validation behavior. It doesn't cover `AgentChatComponent` itself or the live end-to-end flow.

## What the widget actually is

Not a hand-rolled chat UI — a thin wrapper around Cumulocity's own official chat components:

- **`AiContextChatWidgetComponent`** (`ai-context-chat-widget.component.ts`) renders `<c8y-agent-chat>` (`@c8y/ngx-components/ai/agent-chat`), which owns the entire chat UI (message list, markdown rendering, streaming, loading state) and talks to the AI Agent Manager via the platform's own `AIService`. This widget's job is narrower than it originally was: resolve `config().device` (auto-populated by the context-dashboard host with whatever device/group/asset the dashboard is scoped to) into the `[variables]` object the agent's prompt can reference (`contextObjectId`/`Name`/`Type`/`Kind`, `deviceId` only for actual devices), pass through `chatConfig` (title/welcome text), and optionally show an agent-details header (name/type/availability + live token usage) matching the stock "AI Agent Chat" widget's own header.
- **`AiAgentDirectoryService`** (`ai-agent-directory.service.ts`) fetches `GET /service/ai/agent` (confirmed against a live tenant — a plain JSON array, no envelope) to populate the config page's agent picker and the header's type/availability display, and to power the config page's raw-JSON "Selected" preview.
- **`AiContextChatWidgetConfigComponent`** (`ai-context-chat-widget-config.component.ts`) is laid out to match the stock "AI Agent Chat" widget's own config page: show-header checkbox, chat title, welcome text, agent picker (falls back to a free-text field if the agent-directory fetch fails), and the "Selected" JSON preview — plus the asset/device/group context binding that the stock widget doesn't have.
- **`managed-object-context.util.ts`** is the only remaining "custom" logic: pure functions mapping a managed object's fragments (`c8y_IsDevice`/`c8y_IsDeviceGroup`) into a normalized `device`/`group`/`asset` kind.

## How this was actually verified (not guessed)

Every structural decision — standalone/signal-input components, `config.device` as the context source, `hookWidget()` registration, the build/workspace setup, and later the switch to `AgentChatComponent`/`AiAgentDirectoryService` — was confirmed by reading real, installed `@c8y/ngx-components@1024.14.1` source/type declarations and by running `ng add @c8y/websdk --application=@c8y/sample-plugin@1024.14.1` in a scratch workspace, not inferred from documentation. The plugin has been built successfully many times over the course of development, and tested live against a real tenant (`jake.eu-latest.cumulocity.com`) end-to-end: adding the widget to a device/group/asset dashboard, sending messages, receiving real agent responses, editing the config page, and toggling the agent-details header.

Notable real bugs found and fixed along the way (not exhaustive — see git history for the full sequence):
- The AI Agent Manager rejects `prompt` and `messages` in the same request (`AI_InvalidPromptError`) — this surfaced when the widget still had a hand-rolled request body; moot now that `AgentChatComponent`/`AIService` builds the request.
- The endpoint returns plain Markdown text, not JSON — also moot now for the same reason, but is why the switch to `AgentChatComponent` (which already handles this correctly) was worth doing rather than continuing to patch a hand-rolled parser.
- The widget's system-prompt template originally assumed `{{deviceId}}` was always present; fixed in the agent's own prompt (not this repo) to resolve a target device from `{{contextObjectKind}}`/`{{contextObjectId}}` first, since assets/groups don't have telemetry directly.
- `<ai-context-chat-widget>`'s host element had no `display`/`height` set — custom-element hosts aren't block-level by default, so it was shrink-wrapping to content height regardless of the flex CSS inside it, leaving `<c8y-agent-chat>`'s input bar floating instead of pinned to the bottom on tall widgets. Fixed with an explicit `:host { display: block; height: 100% }`.
- The Angular version pinned via `^21.2.0` caret ranges drifted one patch behind what the live tenant's deployed Cockpit shell actually required, producing Module Federation "unsatisfied shared singleton version" warnings. Fixed by pinning exact versions matching the tenant.

## Remaining genuine caveats

- **`cumulocity.config.ts`'s `contentSecurityPolicy`/`dynamicOptionsUrl`/`noAppSwitcher` values** are copied verbatim from the `@c8y/sample-plugin` scaffold and may warrant tenant-specific review.
- **Versions are pinned to what this tenant's Cockpit (`1024.14.1`) and `ng add @c8y/websdk` produced** at the time of writing. If your target platform is on a different release, rerun the same discovery — `npx @angular/cli@21 new probe --defaults && cd probe && npx @angular/cli@21 add @c8y/websdk --application=@c8y/sample-plugin@<your-version> --skip-confirmation --ai-tools=none` — and diff its output against this repo's root files.
- **The dashboard-widget-save round trip** (add widget → edit config → save dashboard → reload → config still applied) has been exercised manually against a live tenant but isn't covered by the unit suite — it would need a real `ContextDashboard` host, which the tests deliberately don't stand up (see `ai-context-chat-widget-config.component.spec.ts`'s comments).
- **`AiAgentDirectoryService`'s response parsing** only extracts `name`/`type`/`availability` plus the raw object; it hasn't been checked against every possible agent shape (e.g. `type: "object"` agents), only the `text`-type agents seen so far.
