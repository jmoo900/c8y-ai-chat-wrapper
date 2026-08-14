import { ApplicationConfig, importProvidersFrom, provideZoneChangeDetection } from '@angular/core';
import { provideAnimations } from '@angular/platform-browser/animations';
import { CoreModule, RouterModule } from '@c8y/ngx-components';
import { CockpitDashboardModule } from '@c8y/ngx-components/context-dashboard/cockpit-home-dashboard';

/**
 * Local-preview app shell only (used by `ng serve --shell cockpit`) — a
 * real Cockpit host loads the widget through cumulocity.config.ts's
 * exports instead of this file. Structure confirmed against a real
 * `ng add @c8y/websdk --application=@c8y/sample-plugin` scaffold.
 */
export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection(),
    provideAnimations(),
    importProvidersFrom(RouterModule.forRoot()),
    importProvidersFrom(CoreModule.forRoot()),
    importProvidersFrom(CockpitDashboardModule)
  ]
};
