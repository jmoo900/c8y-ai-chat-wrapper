import type { ConfigurationOptions } from '@c8y/devkit';

import { author, description, license, name, version } from './package.json';

/**
 * Structure and field names confirmed by actually scaffolding
 * @c8y/sample-plugin@1024.14.1 via `ng add @c8y/websdk` and reading its
 * generated cumulocity.config.ts — this is not a guess. TODO: the
 * contentSecurityPolicy/dynamicOptionsUrl/noAppSwitcher values below are
 * copied verbatim from that sample and may need tenant-specific review.
 */
export default {
  runTime: {
    author,
    description,
    version,
    name,
    contentSecurityPolicy:
      "base-uri 'none'; default-src 'self' 'unsafe-inline' http: https: ws: wss:; connect-src 'self' http: https: ws: wss:;  script-src 'self' 'unsafe-inline' 'unsafe-eval' data:; style-src * 'unsafe-inline' blob:; img-src * data: blob:; font-src * data:; frame-src *; worker-src 'self' blob:;",
    dynamicOptionsUrl: true,
    remotes: {
      [name]: ['aiContextChatWidgetProviders']
    },
    package: 'plugin',
    isPackage: true,
    noAppSwitcher: true,
    license,
    exports: [
      {
        name: 'AI Context Chat Widget',
        module: 'aiContextChatWidgetProviders',
        path: './src/ai-context-chat-widget/index.ts',
        description: 'Context-aware AI chat widget for device, group and asset dashboards.'
      }
    ]
  },
  buildTime: {
    federation: [
      '@angular/animations',
      '@angular/cdk',
      '@angular/common',
      '@angular/compiler',
      '@angular/core',
      '@angular/forms',
      '@angular/platform-browser',
      '@angular/platform-browser-dynamic',
      '@angular/router',
      '@c8y/client',
      '@c8y/ngx-components',
      '@ngx-translate/core',
      'ngx-bootstrap'
    ]
  }
} as const satisfies ConfigurationOptions;
