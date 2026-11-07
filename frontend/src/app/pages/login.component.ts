import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ApiService } from '../core/api.service';

@Component({
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
  <main class="login-shell">
    <section class="login-card">
      <div class="brand-header">
        <div class="brand-mark">T</div>
        <div>
          <p class="eyebrow">ZERO-TRUST DOCUMENT PLATFORM</p>
          <h1>TrustVault Corporate</h1>
        </div>
      </div>
      <p class="muted">Sign in with your corporate credentials or select one of the 4 unique corporate personas below.</p>
      <form (ngSubmit)="submit()">
        <label>Corporate Email Address</label>
        <input name="email" type="email" [(ngModel)]="email" required autocomplete="username">
        <label>Security Password</label>
        <div class="pwd-row">
          <input name="password" [type]="showPassword ? 'text' : 'password'" [(ngModel)]="password" required autocomplete="current-password">
          <button type="button" class="toggle-pwd" (click)="showPassword = !showPassword">{{showPassword ? 'Hide' : 'Show'}}</button>
        </div>
        <p class="error" *ngIf="error">{{error}}</p>
        <button class="primary full" [disabled]="busy">{{busy ? 'Authenticating session…' : 'Sign in securely'}}</button>
      </form>

      <div class="persona-btn-section">
        <p class="persona-btn-title">
          <span>INSTANT DEMO ROLE LOGIN — 4 UNIQUE CORPORATE PERSONAS</span>
        </p>
        <div class="persona-btn-grid">
          <button
            type="button"
            class="persona-login-btn"
            *ngFor="let p of personas"
            (click)="launch(p.email, p.password)"
            [title]="p.fullName + ' (' + p.employeeId + ') — ' + p.jobTitle + ' · ' + p.clearanceLevel">
            <span class="persona-btn-avatar" [style.background]="p.color">{{p.initials}}</span>
            <span class="persona-btn-info">
              <span class="persona-btn-name">{{p.fullName}}</span>
              <span class="persona-btn-role">{{p.badge}}</span>
              <span class="persona-btn-meta">{{p.employeeId}} · {{p.department}}</span>
            </span>
          </button>
        </div>
      </div>

      <p class="fine">
        Every profile enforces independent server-side JWT claims, per-document Read/Edit grants, ClamAV inspection &amp; HMAC-SHA256 audit logging.
      </p>
    </section>
  </main>`,
  styles: [`
    :host { display:block; min-height:100vh; background:linear-gradient(135deg,#09192d 0%,#132f54 100%); }
    .login-shell { min-height:100vh; display:grid; place-items:center; padding:28px 20px; }
    .login-card { width:min(520px, 100%); background:white; padding:36px 38px; border-radius:18px; border:1px solid #e2e8f0; box-shadow:0 24px 64px rgba(0,0,0,.38); }
    .brand-header { display:flex; align-items:center; gap:14px; margin-bottom:10px; }
    .brand-mark { width:46px;height:46px;border-radius:12px;background:#0f2540;color:white;display:grid;place-items:center;font-weight:800;font-size:22px;flex-shrink:0; }
    .eyebrow { margin:0;color:#4a6b8c;font-size:10px;font-weight:800;letter-spacing:1.5px; }
    h1 { margin:3px 0 0; font-size:24px; color:#0f2540; letter-spacing:-.6px; }
    .muted { color:#64748b; font-size:13px; }
    form { display:grid; gap:10px; margin-top:18px; }
    label { font-size:12px;font-weight:700; color:#1e293b; margin-top:4px; }
    input { width:100%; padding:11px 13px;border:1px solid #cbd5e1;border-radius:8px;font:inherit;font-size:13.5px; }
    .pwd-row { display:flex; gap:8px; }
    .toggle-pwd { border:1px solid #cbd5e1; background:#f8fafc; border-radius:8px; padding:0 14px; cursor:pointer; font-size:12px; font-weight:600; color:#334155; }
    .primary { background:#122b49; color:white; border:0; border-radius:8px; padding:11px 14px; font-weight:700; cursor:pointer; }
    .full { width:100%; margin-top:8px; }
    .error { color:#b42318; background:#fef3f2; border:1px solid #fecdca; padding:10px 12px; border-radius:8px; font-size:12px; margin:4px 0 0; }
    .persona-btn-section { margin-top:20px; padding-top:16px; border-top:1px solid #e2e8f0; }
    .persona-btn-title { font-size:9.5px; font-weight:800; letter-spacing:1.1px; color:#475569; margin:0 0 10px; text-align:center; }
    .persona-btn-grid { display:grid; grid-template-columns:repeat(2, minmax(0, 1fr)); gap:8px; width:52%; max-width:240px; margin:0 auto; }
    .persona-login-btn { display:flex; align-items:center; gap:7px; width:100%; min-width:0; overflow:hidden; text-align:left; padding:7px 8px; border-radius:8px; border:1px solid #cbd5e1; background:#f8fafc; cursor:pointer; transition:all .14s ease; }
    .persona-login-btn:hover { background:#eef2f7; border-color:#94a3b8; transform:translateY(-1px); box-shadow:0 4px 10px rgba(15,37,64,.08); }
    .persona-btn-avatar { width:24px; height:24px; border-radius:6px; color:white; display:grid; place-items:center; font-weight:800; font-size:9.5px; flex-shrink:0; }
    .persona-btn-info { min-width:0; flex:1; overflow:hidden; }
    .persona-btn-name { display:block; font-size:10.5px; font-weight:800; color:#0f2540; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
    .persona-btn-role { display:block; font-size:8.5px; font-weight:700; color:#334155; margin-top:1px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
    .persona-btn-meta { display:block; font-size:8px; color:#64748b; margin-top:1px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
    .fine { text-align:center; font-size:11px; color:#64748b; margin-top:18px; line-height:1.5; }
  `]
})
export class LoginComponent {
  private api = inject(ApiService);
  private router = inject(Router);
  email = 'admin@example.local';
  password = 'ChangeThis-Admin-Password-2026!';
  showPassword = false;
  error = '';
  busy = false;

  personas = [
    {
      employeeId: 'TV-EMP-0001',
      initials: 'AD',
      fullName: 'Dr. Ananya Deshmukh',
      jobTitle: 'Chief Information Security Officer (CISO)',
      department: 'Enterprise Security & Governance',
      clearanceLevel: 'Level 5 — Unrestricted Governance & Audit',
      location: 'Mumbai HQ · Tower A, Floor 18',
      badge: 'GLOBAL ADMIN · CISO',
      color: '#0f2540',
      email: 'admin@example.local',
      password: 'ChangeThis-Admin-Password-2026!',
      bio: 'Oversees enterprise zero-trust policies, user lifecycle provisioning, and cryptographic HMAC-SHA256 audit verification.'
    },
    {
      employeeId: 'TV-EMP-0104',
      initials: 'VS',
      fullName: 'Vivek Sharma',
      jobTitle: 'VP of Legal & Corporate Operations',
      department: 'Legal, M&A & Corporate Secretariat',
      clearanceLevel: 'Level 4 — Document Custodian & Sharing Authority',
      location: 'Bengaluru Campus · Legal Wing 4B',
      badge: 'DOCUMENT OWNER · CUSTODIAN',
      color: '#4f46e5',
      email: 'owner@trustvault.local',
      password: 'Corporate-Owner-2026!',
      bio: 'Primary custodian of executive contracts, M&A term sheets, and board forecasts. Grants and revokes Read/Edit access.'
    },
    {
      employeeId: 'TV-EMP-0219',
      initials: 'PN',
      fullName: 'Priya Nair',
      jobTitle: 'Senior Financial Controller & Contract Reviewer',
      department: 'Corporate Finance & FP&A',
      clearanceLevel: 'Level 3 — Collaborative Co-Author & Version Editor',
      location: 'Hyderabad Financial Center · Suite 900',
      badge: 'COLLABORATIVE EDITOR · FP&A',
      color: '#b45309',
      email: 'editor@trustvault.local',
      password: 'Corporate-Editor-2026!',
      bio: 'Co-authors shared contracts and financial forecasts with explicit Edit permissions, version uploads (v2+), and Retry Scan.'
    },
    {
      employeeId: 'TV-EXT-0408',
      initials: 'AM',
      fullName: 'Arjun Mehta',
      jobTitle: 'Lead Statutory & ISO Compliance Auditor',
      department: 'External Audit & Assurance Liaison',
      clearanceLevel: 'Level 2 — Strict Read-Only Inspection',
      location: 'New Delhi · Cyber City Assurance Desk',
      badge: 'READ-ONLY AUDITOR · EXTERNAL',
      color: '#0d9488',
      email: 'viewer@trustvault.local',
      password: 'Corporate-Viewer-2026!',
      bio: 'External auditor with strictly scoped Read-Only access to shared evidence. Blocked from uploading, editing, or sharing.'
    }
  ];

  launch(e: string, p: string) {
    this.email = e;
    this.password = p;
    this.submit();
  }

  submit() {
    this.error = '';
    this.busy = true;
    this.api.login(this.email, this.password).subscribe({
      next: result => {
        sessionStorage.setItem('trustvault_token', result.accessToken);
        sessionStorage.setItem('trustvault_user', JSON.stringify(result.user));
        this.router.navigateByUrl('/');
      },
      error: err => {
        this.error = err?.error?.message || 'Sign-in failed. Check your credentials or account status.';
        this.busy = false;
      }
    });
  }
}
