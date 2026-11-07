import { Routes } from '@angular/router';
import { LoginComponent } from './pages/login.component';
import { WorkspaceComponent } from './pages/workspace.component';

export const routes: Routes = [
  { path: 'login', component: LoginComponent },
  { path: '', component: WorkspaceComponent },
  { path: '**', redirectTo: '' }
];
