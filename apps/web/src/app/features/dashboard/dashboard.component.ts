import { Component, ChangeDetectionStrategy, signal } from '@angular/core';

@Component({
  selector: 'app-dashboard',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h1>Claude Code Chat Hub</h1>
    <p>Connected agents: {{ agentCount() }}</p>
  `,
})
export class DashboardComponent {
  protected readonly agentCount = signal(0);
}
