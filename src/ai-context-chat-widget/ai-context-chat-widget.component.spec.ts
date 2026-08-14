import { TestBed } from '@angular/core/testing';
import { DashboardChildComponent } from '@c8y/ngx-components';
import { TranslateService } from '@ngx-translate/core';

import { AiAgentDirectoryService } from './ai-agent-directory.service';
import { AiContextChatWidgetComponent } from './ai-context-chat-widget.component';
import { DEFAULT_WIDGET_CONFIG } from './ai-context-chat-widget.model';

// Passthrough stub: returns the key unchanged, so tests can assert against
// the same literal English string AgentChatComponent uses as its
// translation key for the cancellation message.
const translateServiceStub = { instant: (key: string) => key };

/**
 * Deliberately never calls `fixture.detectChanges()`: this component's
 * template only ever instantiates the real, heavyweight `<c8y-agent-chat>`
 * (with its own large DI tree) once change detection runs and `hasContext`
 * is true. Signal inputs set via `setInput()` are synchronously readable
 * immediately, without a CD cycle, so every getter under test here can be
 * exercised without ever triggering that render — keeping this a unit test
 * of our own glue code, not of the vendored AgentChatComponent.
 */
describe('AiContextChatWidgetComponent', () => {
  let findAgentMock: ReturnType<typeof vi.fn>;

  function createComponent() {
    TestBed.configureTestingModule({
      imports: [AiContextChatWidgetComponent],
      providers: [
        { provide: AiAgentDirectoryService, useValue: { findAgent: findAgentMock } },
        { provide: TranslateService, useValue: translateServiceStub }
      ]
    });
    return TestBed.createComponent(AiContextChatWidgetComponent);
  }

  beforeEach(() => {
    findAgentMock = vi.fn().mockResolvedValue(undefined);
  });

  it('has no context and empty variables when no config is set', () => {
    const fixture = createComponent();

    expect(fixture.componentInstance.hasContext).toBe(false);
    expect(fixture.componentInstance.context).toBeNull();
    expect(fixture.componentInstance.variables).toEqual({});
  });

  it('falls back to the default agent name when none is configured', () => {
    const fixture = createComponent();

    expect(fixture.componentInstance.agentName).toBe(DEFAULT_WIDGET_CONFIG.agentName);
  });

  it('uses the configured agent name when set', () => {
    const fixture = createComponent();
    fixture.componentRef.setInput('config', { agentName: 'mi-ops-insights' });

    expect(fixture.componentInstance.agentName).toBe('mi-ops-insights');
  });

  it('resolves device context and includes deviceId in variables', () => {
    const fixture = createComponent();
    fixture.componentRef.setInput('config', {
      device: { id: '43205215', name: 'Compressor-02', type: 'c8y_RotaryScrewCompressor', c8y_IsDevice: {} }
    });

    expect(fixture.componentInstance.hasContext).toBe(true);
    expect(fixture.componentInstance.variables).toEqual({
      contextObjectId: '43205215',
      contextObjectName: 'Compressor-02',
      contextObjectType: 'c8y_RotaryScrewCompressor',
      contextObjectKind: 'device',
      deviceId: '43205215'
    });
  });

  it('resolves group/asset context without deviceId in variables', () => {
    const fixture = createComponent();
    fixture.componentRef.setInput('config', {
      device: { id: '999', name: 'Building A', c8y_IsDeviceGroup: {} }
    });

    const variables = fixture.componentInstance.variables as Record<string, unknown>;
    expect(variables['contextObjectKind']).toBe('group');
    expect(variables['deviceId']).toBeUndefined();
  });

  it('builds chatConfig only from fields that are actually set', () => {
    const fixture = createComponent();

    expect(fixture.componentInstance.chatConfig).toEqual({});

    fixture.componentRef.setInput('config', { chatTitle: 'Device Query', welcomeText: 'Welcome!' });
    expect(fixture.componentInstance.chatConfig).toEqual({ title: 'Device Query', welcomeText: 'Welcome!' });

    fixture.componentRef.setInput('config', { chatTitle: 'Only Title' });
    expect(fixture.componentInstance.chatConfig).toEqual({ title: 'Only Title' });
  });

  it('reflects the showHeader config flag', () => {
    const fixture = createComponent();

    expect(fixture.componentInstance.showHeader).toBe(false);

    fixture.componentRef.setInput('config', { showHeader: true });
    expect(fixture.componentInstance.showHeader).toBe(true);
  });

  describe('agentMetaLine', () => {
    it('is empty when no agent directory entry is set', () => {
      const fixture = createComponent();
      expect(fixture.componentInstance.agentMetaLine).toBe('');
    });

    it('combines type and availability, upper-casing the type', () => {
      const fixture = createComponent();
      fixture.componentInstance.agentDirectoryEntry = { name: 'a', type: 'text', availability: 'PRIVATE', raw: {} };

      expect(fixture.componentInstance.agentMetaLine).toBe('Type: TEXT | Availability: PRIVATE');
    });

    it('renders only the field that is present', () => {
      const fixture = createComponent();
      fixture.componentInstance.agentDirectoryEntry = { name: 'a', type: 'text', raw: {} };

      expect(fixture.componentInstance.agentMetaLine).toBe('Type: TEXT');
    });
  });

  describe('agentRequestError', () => {
    it('is empty when the underlying AgentChatComponent has not rendered yet', () => {
      const fixture = createComponent();
      expect(fixture.componentInstance.agentRequestError).toBe('');
    });
  });

  describe('showAgentRequestErrorHint', () => {
    it('is false when there is no error', () => {
      const fixture = createComponent();
      expect(fixture.componentInstance.showAgentRequestErrorHint).toBe(false);
    });

    it('is false for the "AI response cancelled." message (Clear conversation / cancel)', () => {
      const fixture = createComponent();
      // @ts-expect-error -- private field, stubbed directly since this test never calls detectChanges()
      fixture.componentInstance.agentChat = { agentRequestError: () => 'AI response cancelled.' };

      expect(fixture.componentInstance.showAgentRequestErrorHint).toBe(false);
    });

    it('is true for any other error message', () => {
      const fixture = createComponent();
      // @ts-expect-error -- private field, stubbed directly since this test never calls detectChanges()
      fixture.componentInstance.agentChat = { agentRequestError: () => 'Something else went wrong.' };

      expect(fixture.componentInstance.showAgentRequestErrorHint).toBe(true);
    });
  });

  describe('clearConversation', () => {
    it('does not throw when the underlying AgentChatComponent has not rendered yet', () => {
      const fixture = createComponent();
      expect(() => fixture.componentInstance.clearConversation()).not.toThrow();
    });

    it('resets messages and explicitly clears a settled agentRequestError', () => {
      const fixture = createComponent();
      const resetMessages = vi.fn();
      const agentRequestErrorSet = vi.fn();
      const agentRequestError = Object.assign(
        () => 'An error occurred while communicating with the AI agent.',
        { set: agentRequestErrorSet }
      );
      const mockAgentChat = { resetMessages, agentRequestError };
      // @ts-expect-error -- private field, stubbed directly since this test never calls detectChanges()
      fixture.componentInstance.agentChat = mockAgentChat;

      fixture.componentInstance.clearConversation();

      // resetMessages() alone only ever sets agentRequestError (via an
      // aborted in-flight request's rejection) — it never clears one that's
      // already settled, so this must be an explicit, separate call.
      expect(resetMessages).toHaveBeenCalledTimes(1);
      expect(agentRequestErrorSet).toHaveBeenCalledWith('');
    });
  });

  describe('showDebugTools', () => {
    it('is false by default', () => {
      const fixture = createComponent();
      expect(fixture.componentInstance.showDebugTools).toBe(false);
    });

    it('is true when the debug input is set', () => {
      const fixture = createComponent();
      fixture.componentRef.setInput('debug', true);

      expect(fixture.componentInstance.showDebugTools).toBe(true);
    });
  });

  describe('simulateAgentRequestError', () => {
    it('does not throw when the underlying AgentChatComponent has not rendered yet', () => {
      const fixture = createComponent();
      expect(() => fixture.componentInstance.simulateAgentRequestError()).not.toThrow();
    });

    it('sets a canned generic error message on the underlying agentRequestError signal', () => {
      const fixture = createComponent();
      const agentRequestErrorSet = vi.fn();
      // @ts-expect-error -- private field, stubbed directly since this test never calls detectChanges()
      fixture.componentInstance.agentChat = { agentRequestError: Object.assign(() => '', { set: agentRequestErrorSet }) };

      fixture.componentInstance.simulateAgentRequestError();

      expect(agentRequestErrorSet).toHaveBeenCalledWith('An error occurred while communicating with the AI agent.');
    });
  });

  describe('isInsideDashboard', () => {
    // Gates whether <c8y-widget-action> is safe to render: it injects
    // DashboardChildComponent non-optionally and throws without one — this
    // widget also renders in the config page's live preview, which has no
    // such ancestor.
    it('is false when no DashboardChildComponent ancestor is provided', () => {
      const fixture = createComponent();
      expect(fixture.componentInstance.isInsideDashboard).toBe(false);
    });

    it('is true when a DashboardChildComponent ancestor is provided', () => {
      TestBed.configureTestingModule({
        imports: [AiContextChatWidgetComponent],
        providers: [
          { provide: AiAgentDirectoryService, useValue: { findAgent: findAgentMock } },
          { provide: TranslateService, useValue: translateServiceStub },
          { provide: DashboardChildComponent, useValue: {} }
        ]
      });
      const fixture = TestBed.createComponent(AiContextChatWidgetComponent);

      expect(fixture.componentInstance.isInsideDashboard).toBe(true);
    });
  });

  describe('assistantMessageDisplayConfig', () => {
    // Must never be undefined: AgentChatComponent's own template reads
    // `config.toolCallConfig` unguarded, assuming its `input({})` default
    // is always in effect. Binding a literal `undefined` here overrides
    // that default and throws mid-render, aborting the chat stream.
    it('has an empty toolCallConfig when hideToolCalls is not set', () => {
      const fixture = createComponent();
      fixture.componentInstance.agentDirectoryEntry = {
        name: 'a',
        raw: { mcp: [{ serverName: 's', tools: ['tool-a'] }] }
      };

      expect(fixture.componentInstance.assistantMessageDisplayConfig).toEqual({ toolCallConfig: {} });
    });

    it('has an empty toolCallConfig when hideToolCalls is false', () => {
      const fixture = createComponent();
      fixture.componentRef.setInput('config', { hideToolCalls: false });
      fixture.componentInstance.agentDirectoryEntry = {
        name: 'a',
        raw: { mcp: [{ serverName: 's', tools: ['tool-a'] }] }
      };

      expect(fixture.componentInstance.assistantMessageDisplayConfig).toEqual({ toolCallConfig: {} });
    });

    it('has an empty toolCallConfig when hideToolCalls is true but the agent has no known tools', () => {
      const fixture = createComponent();
      fixture.componentRef.setInput('config', { hideToolCalls: true });

      expect(fixture.componentInstance.assistantMessageDisplayConfig).toEqual({ toolCallConfig: {} });
    });

    it('builds an isHidden entry for every tool across all mcp servers when hideToolCalls is true', () => {
      const fixture = createComponent();
      fixture.componentRef.setInput('config', { hideToolCalls: true });
      fixture.componentInstance.agentDirectoryEntry = {
        name: 'a',
        raw: {
          mcp: [
            { serverName: 's1', tools: ['tool-a', 'tool-b'] },
            { serverName: 's2', tools: ['tool-b', 'tool-c'] }
          ]
        }
      };

      expect(fixture.componentInstance.assistantMessageDisplayConfig).toEqual({
        toolCallConfig: {
          'tool-a': { isHidden: true },
          'tool-b': { isHidden: true },
          'tool-c': { isHidden: true }
        }
      });
    });
  });
});
