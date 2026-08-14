import { AsyncPipe } from '@angular/common';
import { Component, DestroyRef, inject, Input, OnInit, TemplateRef, ViewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ControlContainer, FormControl, FormGroup, NgForm, ReactiveFormsModule, Validators } from '@angular/forms';
import { AlertService, DynamicComponent, FormGroupComponent } from '@c8y/ngx-components';
import { WidgetConfigService } from '@c8y/ngx-components/context-dashboard';
import { BehaviorSubject } from 'rxjs';

import { AiAgentDirectoryEntry, AiAgentDirectoryService } from './ai-agent-directory.service';
import { AiContextChatWidgetComponent } from './ai-context-chat-widget.component';
import { AiContextChatWidgetConfig, DEFAULT_WIDGET_CONFIG } from './ai-context-chat-widget.model';

/**
 * Config-form component shown when a user adds/edits this widget on a
 * dashboard: agent picker, chat title/welcome text, agent-details header
 * toggle (matching the stock "AI Agent Chat" widget's own config page),
 * plus the asset/device/group context binding that widget doesn't have.
 *
 * Pattern confirmed against @c8y/sample-plugin@1024.14.1's own widget
 * config component: reads the initial value from `@Input() config`, but
 * persists changes by registering a `FormGroup` onto the ambient `NgForm`
 * via `ControlContainer` — the host's own dashboard-widget save flow
 * collects that form's value, not a service call. `WidgetConfigService`
 * is used only for `.setPreview()` (live preview template) and
 * `.addOnBeforeSave()` (validation gate) — not as an alternate read/write
 * channel for the config value itself.
 */
@Component({
  selector: 'ai-context-chat-widget-config',
  templateUrl: './ai-context-chat-widget-config.component.html',
  styleUrls: ['./ai-context-chat-widget-config.component.scss'],
  viewProviders: [{ provide: ControlContainer, useExisting: NgForm }],
  standalone: true,
  imports: [FormGroupComponent, ReactiveFormsModule, AiContextChatWidgetComponent, AsyncPipe]
})
export class AiContextChatWidgetConfigComponent implements DynamicComponent, OnInit {
  @Input() config: AiContextChatWidgetConfig = {};

  formGroup!: FormGroup<{
    agentName: FormControl<string>;
    chatTitle: FormControl<string>;
    welcomeText: FormControl<string>;
    showHeader: FormControl<boolean>;
    hideToolCalls: FormControl<boolean>;
  }>;
  config$ = new BehaviorSubject<AiContextChatWidgetConfig>({});

  availableAgents: AiAgentDirectoryEntry[] = [];
  /** True only if the agent directory fetch failed — falls back to a free-text agent name field. */
  agentDirectoryUnavailable = false;

  private readonly alert = inject(AlertService);
  private readonly widgetConfigService = inject(WidgetConfigService);
  private readonly agentDirectory = inject(AiAgentDirectoryService);
  private readonly form = inject(NgForm);
  private readonly destroyRef = inject(DestroyRef);

  @ViewChild('agentPreview')
  set preview(template: TemplateRef<unknown>) {
    this.widgetConfigService.setPreview(template ?? null);
  }

  ngOnInit(): void {
    this.formGroup = new FormGroup({
      agentName: new FormControl(this.config?.agentName || DEFAULT_WIDGET_CONFIG.agentName, {
        nonNullable: true,
        validators: Validators.required
      }),
      chatTitle: new FormControl(this.config?.chatTitle || '', { nonNullable: true }),
      welcomeText: new FormControl(this.config?.welcomeText || '', { nonNullable: true }),
      showHeader: new FormControl(this.config?.showHeader ?? false, { nonNullable: true }),
      hideToolCalls: new FormControl(this.config?.hideToolCalls ?? false, { nonNullable: true })
    });

    this.form.form.addControl('widgetConfig', this.formGroup);
    this.config$.next(this.config);

    this.formGroup.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((value) => {
      this.config$.next({ ...this.config, ...value });
    });

    this.widgetConfigService.addOnBeforeSave((config) => {
      if (this.formGroup.invalid) {
        this.alert.warning('Select or enter a valid agent name.');
        return false;
      }
      if (config) {
        Object.assign(config, this.formGroup.value);
      }
      return true;
    });

    void this.loadAgents();
  }

  /** Whether the currently configured agent name is missing from the fetched list (still shown, so saving doesn't silently change it). */
  get currentAgentMissingFromList(): boolean {
    const current = this.formGroup.controls.agentName.value;
    return !!current && !this.availableAgents.some((agent) => agent.name === current);
  }

  /** The full fetched entry for the currently selected agent, for the "Selected" JSON preview. */
  get selectedAgentEntry(): AiAgentDirectoryEntry | undefined {
    const current = this.formGroup?.controls.agentName.value;
    return this.availableAgents.find((agent) => agent.name === current);
  }

  get selectedAgentJson(): string {
    const entry = this.selectedAgentEntry;
    return entry ? JSON.stringify(entry.raw, null, 2) : '';
  }

  private async loadAgents(): Promise<void> {
    try {
      this.availableAgents = await this.agentDirectory.listAgents();
    } catch {
      this.agentDirectoryUnavailable = true;
    }
  }
}
