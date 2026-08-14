import { Component, effect, input, ViewChild } from '@angular/core';
import { AgentChatComponent } from '@c8y/ngx-components/ai/agent-chat';

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
 */
@Component({
  selector: 'ai-context-chat-widget',
  templateUrl: './ai-context-chat-widget.component.html',
  styleUrls: ['./ai-context-chat-widget.component.scss'],
  standalone: true,
  imports: [AgentChatComponent]
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
