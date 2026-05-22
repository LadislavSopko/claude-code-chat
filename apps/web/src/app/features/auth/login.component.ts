import { Component, ChangeDetectionStrategy } from '@angular/core';
import { environment } from '../../core/environment';

@Component({
  selector: 'app-login',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="login-container">
      <h1>Sign In</h1>
      <button (click)="signInWithGoogle()">Sign in with Google</button>
    </div>
  `,
  styles: `
    .login-container {
      display: flex;
      flex-direction: column;
      align-items: center;
      padding-top: 4rem;
    }
  `,
})
export class LoginComponent {
  signInWithGoogle(): void {
    window.location.href = `${environment.apiUrl}/api/auth/sign-in/social?provider=google`;
  }
}
