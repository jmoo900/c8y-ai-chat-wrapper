import { IIdentified, IManagedObject } from '@c8y/client';

export type ContextObjectKind = 'device' | 'group' | 'asset';

/** Context resolved from the currently selected managed object. */
export interface ManagedObjectContext {
  contextObjectId: string;
  contextObjectName: string;
  contextObjectType: string;
  contextObjectKind: ContextObjectKind;
  /** Only set when contextObjectKind === 'device'. */
  deviceId?: string;
}

/**
 * Passed as `AgentChatComponent`'s `[variables]` input — placeholders the
 * agent's system prompt can reference. Conversation history, request
 * building, and response parsing are all handled internally by
 * `@c8y/ngx-components/ai/agent-chat`'s `AgentChatComponent`/`AIService`,
 * not by this widget.
 */
export interface AiAgentRuntimeVariables {
  contextObjectId: string;
  contextObjectName: string;
  contextObjectType: string;
  contextObjectKind: ContextObjectKind;
  deviceId?: string;
}

export interface AiContextChatWidgetConfig {
  agentName?: string;
  /** Passed through as AgentChatComponent's chatConfig.title. */
  chatTitle?: string;
  /** Passed through as AgentChatComponent's chatConfig.welcomeText. */
  welcomeText?: string;
  /** Shows the agent name/type/availability + live token-usage row above the chat. Default false. */
  showHeader?: boolean;
  /** Hides the "Used tool ..." style indicators shown while the agent is working. Default false. */
  hideToolCalls?: boolean;
  /**
   * Auto-populated by the context dashboard host with the managed object
   * the dashboard is currently scoped to (device/group/asset) — this is
   * the documented mechanism (confirmed against @c8y/sample-plugin
   * 1024.14.1's SamplePluginConfig), not something this widget resolves
   * itself. Absent when the widget isn't on a context dashboard.
   */
  device?: IIdentified & Partial<IManagedObject>;
}

// `satisfies` (not a type annotation) keeps `agentName` inferred as a
// guaranteed `string`, not widened to the interface's `string | undefined` —
// callers rely on DEFAULT_WIDGET_CONFIG.agentName always being defined.
export const DEFAULT_WIDGET_CONFIG = {
  agentName: 'default'
} satisfies AiContextChatWidgetConfig;
