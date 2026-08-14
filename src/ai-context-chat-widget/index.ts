import { DynamicWidgetDefinition, hookWidget } from '@c8y/ngx-components';

import { AiContextChatWidgetConfigComponent } from './ai-context-chat-widget-config.component';
import { AiContextChatWidgetComponent } from './ai-context-chat-widget.component';

/**
 * Registers the AI context chat widget with Cockpit's dashboard widget
 * catalog via `hookWidget()`. Confirmed against @c8y/sample-plugin@1024.14.1
 * — modern widget registration is a plain exported providers array (no
 * `@NgModule` wrapper), referenced by path + export name from
 * cumulocity.config.ts's `runTime.exports[]`.
 *
 * TODO: replace the `your-org` vendor segment of the widget id below with
 * your actual vendor/app namespace, to avoid catalog collisions with other
 * widgets in the same tenant.
 */
export const aiContextChatWidgetDefinition = {
  id: 'your-org.widget.ai-context-chat',
  label: 'AI Context Chat',
  description: 'Context-aware AI chat for device, group and asset dashboards.',
  component: AiContextChatWidgetComponent,
  configComponent: AiContextChatWidgetConfigComponent,
  data: {
    settings: {
      noNewWidgets: false
    }
  }
} satisfies DynamicWidgetDefinition;

export const aiContextChatWidgetProviders = [hookWidget(aiContextChatWidgetDefinition)];
