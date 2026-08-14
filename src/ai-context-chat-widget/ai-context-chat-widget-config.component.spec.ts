import { Component, importProvidersFrom } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { AlertService } from '@c8y/ngx-components';
import { WidgetConfigService } from '@c8y/ngx-components/context-dashboard';
import { TranslateModule } from '@ngx-translate/core';

import { AiAgentDirectoryService } from './ai-agent-directory.service';
import { AiContextChatWidgetConfigComponent } from './ai-context-chat-widget-config.component';
import { AiContextChatWidgetConfig, DEFAULT_WIDGET_CONFIG } from './ai-context-chat-widget.model';

/**
 * A real `<form>` host, since AiContextChatWidgetConfigComponent's
 * `viewProviders: [{ provide: ControlContainer, useExisting: NgForm }]`
 * needs an ambient NgForm to attach its FormGroup to — the same setup the
 * real dashboard-widget config host provides.
 */
@Component({
  standalone: true,
  imports: [FormsModule, AiContextChatWidgetConfigComponent],
  template: `<form><ai-context-chat-widget-config [config]="config" /></form>`
})
class TestHostComponent {
  config: AiContextChatWidgetConfig = {};
}

describe('AiContextChatWidgetConfigComponent', () => {
  let listAgentsMock: ReturnType<typeof vi.fn>;
  let alertWarningMock: ReturnType<typeof vi.fn>;
  let addOnBeforeSaveMock: ReturnType<typeof vi.fn>;

  async function createComponent(initialConfig: AiContextChatWidgetConfig = {}) {
    TestBed.configureTestingModule({
      imports: [TestHostComponent],
      providers: [
        // FormGroupComponent (from @c8y/ngx-components) transitively needs
        // TranslateService via an internal MessagesComponent.
        importProvidersFrom(TranslateModule.forRoot()),
        { provide: AiAgentDirectoryService, useValue: { listAgents: listAgentsMock } },
        { provide: AlertService, useValue: { warning: alertWarningMock } },
        { provide: WidgetConfigService, useValue: { setPreview: vi.fn(), addOnBeforeSave: addOnBeforeSaveMock } }
      ]
    });

    const hostFixture = TestBed.createComponent(TestHostComponent);
    hostFixture.componentInstance.config = initialConfig;
    hostFixture.detectChanges();
    await hostFixture.whenStable();

    const configComponent = hostFixture.debugElement.query(
      By.directive(AiContextChatWidgetConfigComponent)
    ).componentInstance as AiContextChatWidgetConfigComponent;

    return { hostFixture, configComponent };
  }

  beforeEach(() => {
    listAgentsMock = vi.fn().mockResolvedValue([]);
    alertWarningMock = vi.fn();
    addOnBeforeSaveMock = vi.fn();
  });

  it('builds the form with the default agent name when none is configured', async () => {
    const { configComponent } = await createComponent();

    expect(configComponent.formGroup.controls.agentName.value).toBe(DEFAULT_WIDGET_CONFIG.agentName);
    expect(configComponent.formGroup.controls.agentName.valid).toBe(true);
  });

  it('seeds the form from the provided config', async () => {
    const { configComponent } = await createComponent({
      agentName: 'mi-ops-insights',
      chatTitle: 'Device Query',
      welcomeText: 'Welcome!',
      showHeader: true,
      hideToolCalls: true
    });

    expect(configComponent.formGroup.value).toEqual({
      agentName: 'mi-ops-insights',
      chatTitle: 'Device Query',
      welcomeText: 'Welcome!',
      showHeader: true,
      hideToolCalls: true
    });
  });

  it('rejects an empty agent name', async () => {
    const { configComponent } = await createComponent();

    configComponent.formGroup.controls.agentName.setValue('');

    expect(configComponent.formGroup.controls.agentName.invalid).toBe(true);
  });

  it('populates availableAgents from the directory service, and flags a fetch failure', async () => {
    const agents = [
      { name: 'agent-1', type: 'text', availability: 'PRIVATE', raw: {} },
      { name: 'agent-2', type: 'text', availability: 'SHARED', raw: {} }
    ];
    listAgentsMock.mockResolvedValue(agents);

    const { configComponent } = await createComponent();

    expect(configComponent.availableAgents).toEqual(agents);
    expect(configComponent.agentDirectoryUnavailable).toBe(false);
  });

  it('marks the directory unavailable when the fetch fails, without throwing', async () => {
    listAgentsMock.mockRejectedValue(new Error('network error'));

    const { configComponent } = await createComponent();

    expect(configComponent.agentDirectoryUnavailable).toBe(true);
    expect(configComponent.availableAgents).toEqual([]);
  });

  describe('currentAgentMissingFromList / selectedAgentEntry', () => {
    it('is true, and selectedAgentEntry is undefined, when the configured agent is not in the fetched list', async () => {
      listAgentsMock.mockResolvedValue([{ name: 'some-other-agent', raw: {} }]);

      const { configComponent } = await createComponent({ agentName: 'mi-ops-insights' });

      expect(configComponent.currentAgentMissingFromList).toBe(true);
      expect(configComponent.selectedAgentEntry).toBeUndefined();
      expect(configComponent.selectedAgentJson).toBe('');
    });

    it('is false, and selectedAgentEntry/selectedAgentJson reflect the match, when the agent is in the list', async () => {
      const raw = { name: 'mi-ops-insights', type: 'text', availability: 'PRIVATE' };
      listAgentsMock.mockResolvedValue([{ name: 'mi-ops-insights', type: 'text', availability: 'PRIVATE', raw }]);

      const { configComponent } = await createComponent({ agentName: 'mi-ops-insights' });

      expect(configComponent.currentAgentMissingFromList).toBe(false);
      expect(configComponent.selectedAgentEntry?.name).toBe('mi-ops-insights');
      expect(configComponent.selectedAgentJson).toBe(JSON.stringify(raw, null, 2));
    });
  });

  describe('addOnBeforeSave callback (registered with WidgetConfigService)', () => {
    it('warns and returns false when the form is invalid, without touching the passed config', async () => {
      const { configComponent } = await createComponent();
      configComponent.formGroup.controls.agentName.setValue('');

      const beforeSave = addOnBeforeSaveMock.mock.calls[0][0] as (config: unknown) => boolean;
      const targetConfig = { agentName: 'old-value' };

      const result = beforeSave(targetConfig);

      expect(result).toBe(false);
      expect(alertWarningMock).toHaveBeenCalled();
      expect(targetConfig).toEqual({ agentName: 'old-value' });
    });

    it('assigns the form value onto the passed config and returns true when valid', async () => {
      const { configComponent } = await createComponent();
      configComponent.formGroup.controls.agentName.setValue('mi-ops-insights');

      const beforeSave = addOnBeforeSaveMock.mock.calls[0][0] as (config: unknown) => boolean;
      const targetConfig: Record<string, unknown> = {};

      const result = beforeSave(targetConfig);

      expect(result).toBe(true);
      expect(targetConfig['agentName']).toBe('mi-ops-insights');
    });

    it('does not throw when the passed config is undefined', async () => {
      const { configComponent } = await createComponent();
      configComponent.formGroup.controls.agentName.setValue('mi-ops-insights');

      const beforeSave = addOnBeforeSaveMock.mock.calls[0][0] as (config: unknown) => boolean;

      expect(() => beforeSave(undefined)).not.toThrow();
      expect(beforeSave(undefined)).toBe(true);
    });
  });
});
