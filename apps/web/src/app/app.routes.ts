import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./features/dashboard/dashboard.component').then((m) => m.DashboardComponent),
  },
  {
    path: 'auth',
    loadComponent: () =>
      import('./features/auth/login.component').then((m) => m.LoginComponent),
  },
];
