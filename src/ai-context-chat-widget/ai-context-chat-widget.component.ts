import { Component, effect, inject, input, ViewChild } from '@angular/core';
import { DashboardChildComponent, WidgetActionWrapperComponent } from '@c8y/ngx-components';
import { AgentChatComponent } from '@c8y/ngx-components/ai/agent-chat';
import { TranslateService } from '@ngx-translate/core';

import { AiAgentDirectoryEntry, AiAgentDirectoryService } from './ai-agent-directory.service';
import { AiAgentRuntimeVariables, AiContextChatWidgetConfig, DEFAULT_WIDGET_CONFIG } from './ai-context-chat-widget.model';
import { mapManagedObjectToContext } from './managed-object-context.util';

/**
 * Context-aware AI chat widget for device, group and asset dashboards.
 *
 * Thin wrapper around Cumulocity's own `AgentChatComponent`
 * (`@c8y/ngx-components/ai/agent-chat`, confirmed present in
 * @c8y/ngx-components@1024.14.1) — that component owns the chat UI
 * (message list, input, send button, markdown rendering, streaming,
 * loading/error states) and talks to the AI Agent Manager via the
 * platform's own `AIService`, not a hand-rolled fetch call. This widget's
 * own jobs are: resolving `config().device` into the `[variables]` object
 * (the one piece specific to "this widget on a device/group/asset
 * dashboard," which the platform can't know on its own), passing through
 * chat title/welcome text config, and an optional agent-details header
 * (name/type/availability + live token usage) matching the stock "AI
 * Agent Chat" widget's own header, built from `AiAgentDirectoryService`
 * (GET /service/ai/agent, confirmed against a live tenant) and
 * AgentChatComponent's own `cumulativeUsage` signal.
 *
 * Context comes from `config().device` — the context dashboard host
 * auto-populates that field with the managed object the dashboard is
 * currently scoped to (confirmed against @c8y/sample-plugin@1024.14.1's
 * own SamplePluginConfig, and against a live tenant).
 *
 * The "Clear conversation" control is projected into the dashboard's own
 * shared per-widget title bar (alongside the fullscreen/lock icons) via
 * `<c8y-widget-action>` (`WidgetActionWrapperComponent`, exported from
 * `@c8y/ngx-components`) — documented in the platform's Codex under the
 * datapoints export selector's icon-only mode, and confirmed against its
 * real implementation, which registers projected content onto the ambient
 * `DashboardChildComponent`'s `_additionalHeaderTemplates`. That's the same
 * mechanism the stock "AI Agent Chat" widget uses for its own equivalent
 * icon (confirmed live: it calls `AgentChatComponent.cancel()`/
 * `resetMessages()` — same "AI response cancelled." message either way).
 */
@Component({
  selector: 'ai-context-chat-widget',
  templateUrl: './ai-context-chat-widget.component.html',
  styleUrls: ['./ai-context-chat-widget.component.scss'],
  standalone: true,
  imports: [AgentChatComponent, WidgetActionWrapperComponent]
})
export class AiContextChatWidgetComponent {
  // `| null` because the config-form component's live preview feeds this
  // via `config$ | async`, and Angular's AsyncPipe is typed as `T | null`
  // regardless of the source observable's own type.
  readonly config = input<AiContextChatWidgetConfig | null>();

  /**
   * Optional debug logging: resolved context only (AgentChatComponent
   * handles its own request/response logging, if any). Off by default.
   * `[debug]="true"` only works where you control the host template (e.g.
   * a test harness) — for real usage, flip it at runtime instead: open
   * DevTools console and run
   *   localStorage.setItem('ai-context-chat-widget:debug', 'true')
   * then reload. Chrome/Edge hide console.debug() under "Verbose" by
   * default — enable it in the console's log-level filter.
   */
  readonly debug = input(false);

  private static readonly DEBUG_STORAGE_KEY = 'ai-context-chat-widget:debug';

  @ViewChild(AgentChatComponent) private agentChat?: AgentChatComponent;

  /**
   * `WidgetActionWrapperComponent` (`<c8y-widget-action>`) projects its
   * content into the dashboard's own shared per-widget title bar — the row
   * with the fullscreen/lock icons — via `DashboardChildComponent`, which it
   * injects non-optionally and throws without. This widget also renders in
   * contexts with no such ancestor (e.g. the config page's live preview via
   * `WidgetConfigService.setPreview()`), so this optional injection gates
   * whether `<c8y-widget-action>` is safe to render at all.
   */
  private readonly dashboardChild = inject(DashboardChildComponent, { optional: true });

  private readonly translateService = inject(TranslateService);

  agentDirectoryEntry: AiAgentDirectoryEntry | null = null;

  constructor(private agentDirectory: AiAgentDirectoryService) {
    effect(() => {
      if (this.isDebugEnabled) {
        console.debug('[ai-context-chat-widget] context', this.context, 'variables', this.variables);
      }
    });

    effect(() => {
      void this.loadAgentDirectoryEntry(this.agentName);
    });
  }

  get context() {
    const device = this.config()?.device;
    return device ? mapManagedObjectToContext(device) : null;
  }

  get agentName(): string {
    return this.config()?.agentName || DEFAULT_WIDGET_CONFIG.agentName;
  }

  get hasContext(): boolean {
    return !!this.context;
  }

  get showHeader(): boolean {
    return !!this.config()?.showHeader;
  }

  get isInsideDashboard(): boolean {
    return !!this.dashboardChild;
  }

  /** Gates the debug-only "Simulate error" control — see simulateAgentRequestError(). */
  get showDebugTools(): boolean {
    return this.isDebugEnabled;
  }

  /** Bound to AgentChatComponent's [variables] input — see class doc comment. */
  get variables(): AiAgentRuntimeVariables | Record<string, never> {
    const context = this.context;
    if (!context) {
      return {};
    }
    return {
      contextObjectId: context.contextObjectId,
      contextObjectName: context.contextObjectName,
      contextObjectType: context.contextObjectType,
      contextObjectKind: context.contextObjectKind,
      ...(context.deviceId ? { deviceId: context.deviceId } : {})
    };
  }

  /** Bound to AgentChatComponent's [chatConfig] input. */
  get chatConfig(): { title?: string; welcomeText?: string } {
    const config = this.config();
    return {
      ...(config?.chatTitle ? { title: config.chatTitle } : {}),
      ...(config?.welcomeText ? { welcomeText: config.welcomeText } : {})
    };
  }

  /** Header line: "Type: TEXT | Availability: PRIVATE", matching the stock widget's header. */
  get agentMetaLine(): string {
    const parts: string[] = [];
    if (this.agentDirectoryEntry?.type) {
      parts.push(`Type: ${this.agentDirectoryEntry.type.toUpperCase()}`);
    }
    if (this.agentDirectoryEntry?.availability) {
      parts.push(`Availability: ${this.agentDirectoryEntry.availability}`);
    }
    return parts.join(' | ');
  }

  /** Live cumulative token usage from the child AgentChatComponent, once rendered. */
  get cumulativeUsage() {
    return this.agentChat?.cumulativeUsage();
  }

  /**
   * Clears the conversation, matching the stock "AI Agent Chat" widget's
   * trash-icon control. `AgentChatComponent.resetMessages()` cancels any
   * in-flight stream and empties its message history — since that history
   * is exactly what gets resent (and accumulates) on every turn, clearing
   * it is a real way to recover from a conversation that's grown large
   * enough to approach the model's context-length limit, not just a
   * cosmetic reset.
   *
   * Also explicitly clears `agentRequestError`: `resetMessages()`'s internal
   * `cancel()` only ever sets that signal (via an aborted in-flight
   * request's rejection reaching the stream's own error handler) — it never
   * clears it. So a *settled* error (the request already failed, nothing
   * in flight) is left untouched by resetMessages() alone, and both
   * AgentChatComponent's own inline banner and our supplementary hint would
   * keep showing a stale error after the conversation was already cleared.
   */
  clearConversation(): void {
    this.agentChat?.resetMessages();
    this.agentChat?.agentRequestError.set('');
  }

  /**
   * Debug-only: sets AgentChatComponent's own `agentRequestError` signal
   * directly (it's a public WritableSignal), to preview the error hint and
   * its styling/placement on demand — without spending real tokens on a
   * conversation long enough to genuinely hit the context limit. Only
   * reachable when `showDebugTools` is on (see the `debug` input / the
   * `ai-context-chat-widget:debug` localStorage flag).
   */
  simulateAgentRequestError(): void {
    this.agentChat?.agentRequestError.set('An error occurred while communicating with the AI agent.');
  }

  /**
   * Mirrors AgentChatComponent's own `agentRequestError` signal, so we can
   * show a more actionable supplementary hint alongside its built-in
   * (often generic) error banner.
   *
   * AgentChatComponent reduces every stream failure down to `error?.message`,
   * falling back to a generic "An error occurred while communicating with
   * the AI agent." whenever the underlying error object has no top-level
   * `message` — which is common for AI_APICallError-shaped failures (e.g.
   * a context-length error nested three levels deep in
   * `error.error.responseBody`). That raw error is only ever
   * `console.error`'d, never exposed on any public property, so there is no
   * way to recover or display the specific underlying reason from outside
   * this component — confirmed against AgentChatComponent's public API
   * surface (no error-detail output, `agentRequestError` only ever holds
   * the already-reduced generic string).
   */
  get agentRequestError(): string {
    return this.agentChat?.agentRequestError() ?? '';
  }

  /**
   * Whether to show the supplementary hint above. `resetMessages()` (our own
   * "Clear conversation" control, or the stock widget's equivalent) cancels
   * any in-flight stream via `cancel()`, which sets this same
   * `agentRequestError` signal to "AI response cancelled." — an expected,
   * user-initiated outcome, not a failure needing the context-limit
   * explanation. `TranslateService` (rather than a hardcoded English string)
   * keeps this correct under other locales, since AgentChatComponent
   * constructs that message via the same translation key.
   */
  get showAgentRequestErrorHint(): boolean {
    const error = this.agentRequestError;
    if (!error) {
      return false;
    }
    return error !== this.translateService.instant('AI response cancelled.');
  }

  /**
   * Bound to AgentChatComponent's [assistantMessageDisplayConfig] input.
   * There's no single "hide all tool calls" flag on that config — only a
   * per-tool-name `toolCallConfig[name].isHidden` map — so this builds one
   * from every tool name in the selected agent's own `mcp` server list
   * (fetched alongside agentDirectoryEntry).
   *
   * Must always return an object, never `undefined`: AgentChatComponent
   * declares this input as `input({})`, and its own template reads
   * `config.toolCallConfig` unguarded, assuming that default is always in
   * effect. Explicitly binding `undefined` from the parent overrides that
   * default with a real `undefined`, which throws mid-render ("Cannot read
   * properties of undefined (reading 'toolCallConfig')") and aborts the
   * chat stream — confirmed via a live-tenant repro.
   */
  get assistantMessageDisplayConfig(): { toolCallConfig: Record<string, { isHidden: true }> } {
    const toolCallConfig: Record<string, { isHidden: true }> = {};
    if (this.config()?.hideToolCalls) {
      for (const name of this.extractToolNames(this.agentDirectoryEntry)) {
        toolCallConfig[name] = { isHidden: true };
      }
    }
    return { toolCallConfig };
  }

  private extractToolNames(entry: AiAgentDirectoryEntry | null): string[] {
    const mcp = entry?.raw?.['mcp'];
    if (!Array.isArray(mcp)) {
      return [];
    }

    const names = new Set<string>();
    for (const server of mcp) {
      const tools = (server as Record<string, unknown> | null)?.['tools'];
      if (Array.isArray(tools)) {
        for (const tool of tools) {
          if (typeof tool === 'string') {
            names.add(tool);
          }
        }
      }
    }
    return [...names];
  }

  private async loadAgentDirectoryEntry(agentName: string): Promise<void> {
    try {
      this.agentDirectoryEntry = (await this.agentDirectory.findAgent(agentName)) ?? null;
    } catch {
      this.agentDirectoryEntry = null;
    }
  }

  private get isDebugEnabled(): boolean {
    if (this.debug()) {
      return true;
    }
    try {
      return localStorage.getItem(AiContextChatWidgetComponent.DEBUG_STORAGE_KEY) === 'true';
    } catch {
      return false;
    }
  }
}
