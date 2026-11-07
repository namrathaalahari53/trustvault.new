import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ApiService, AuditItem, DocumentItem, FolderItem, NotificationItem, User } from '../core/api.service';

@Component({
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
  <div class="app-shell">
    <aside class="sidebar">
      <div class="brand">
        <span class="brand-icon">T</span>
        <span>TrustVault<small>CORPORATE WORKSPACE</small></span>
      </div>
      <div class="nav-label">WORKSPACE</div>
      <button class="nav" [class.active]="section==='dashboard'" (click)="setSection('dashboard')">⊞ <span>Dashboard</span></button>
      <button class="nav" [class.active]="section==='documents'" (click)="setSection('documents')">▤ <span>My Documents</span></button>
      <button class="nav" [class.active]="section==='shared'" (click)="setSection('shared')">⇄ <span>Shared With Me</span></button>
      <button class="nav" [class.active]="section==='folders'" (click)="setSection('folders')">❐ <span>Folders & Categories</span></button>
      <button class="nav" [class.active]="section==='audit'" (click)="setSection('audit')">◷ <span>Audit Activity</span></button>
      <button class="nav" [class.active]="section==='notifications'" (click)="setSection('notifications')">🔔 <span>Notifications ({{unreadCount}})</span></button>
      <button class="nav" [class.active]="section==='profile'" (click)="setSection('profile')">⚙ <span>Profile & Security</span></button>

      <ng-container *ngIf="isAdmin">
        <div class="nav-label" style="margin-top:18px">ADMINISTRATION</div>
        <button class="nav" [class.active]="section==='admin'" (click)="setSection('admin')">♙ <span>Admin & Monitoring</span></button>
      </ng-container>

      <div class="sidebar-bottom"><span class="status-dot"></span> Zero-Trust Active</div>
    </aside>

    <main class="main">
      <header class="topbar">
        <div><span class="crumb">Corporate Workspace /</span> <strong>{{sectionLabel}}</strong></div>
        <div class="user-area">
          <span class="avatar">{{initials}}</span>
          <span>{{user?.email}}<small>{{user?.role}} · {{user?.department || 'Enterprise'}}</small></span>
          <button class="logout" (click)="logout()">Sign out</button>
        </div>
      </header>

      <section class="content" *ngIf="section==='dashboard'">
        <div class="page-heading">
          <div>
            <p class="eyebrow">EXECUTIVE OVERVIEW</p>
            <h1>Corporate Security Dashboard</h1>
            <p class="muted">Real-time document governance, malware scan health, and access control telemetry.</p>
          </div>
          <button class="primary" *ngIf="canUpload" (click)="openUploadModal = true">＋ Upload Document</button>
        </div>
        <div class="stats4">
          <article><span>Total Accessible</span><strong>{{documents.length}}</strong><small>Authorized in your workspace</small></article>
          <article><span>Shared With Me</span><strong>{{sharedWithMe.length}}</strong><small>Explicit Read/Edit grants</small></article>
          <article><span>Verified Clean</span><strong>{{cleanCount}}</strong><small>Passed ClamAV & signature check</small></article>
          <article><span>Attention / Blocked</span><strong>{{documents.length - cleanCount}}</strong><small>Quarantined or retry required</small></article>
        </div>
        <div class="table-card">
          <div class="table-title"><strong>Recent Corporate Documents</strong><span>Latest activity</span></div>
          <table>
            <thead><tr><th>DOCUMENT</th><th>OWNER</th><th>CATEGORY</th><th>ACCESS</th><th>SCAN STATUS</th><th>ACTION</th></tr></thead>
            <tbody>
              <tr *ngFor="let d of documents.slice(0, 6)">
                <td><strong>{{d.name}}</strong> <small class="ver">v{{d.currentVersion || 1}}</small></td>
                <td>{{d.ownerEmail}}</td>
                <td>{{d.category || 'General'}}</td>
                <td><span class="badge">{{d.accessLevel}}</span></td>
                <td><span class="pill" [class.clean]="d.status==='Clean'" [class.rejected]="d.status==='Rejected'">{{d.status}}</span></td>
                <td>
                  <button class="text-btn" [disabled]="d.status!=='Clean'" (click)="openPreview(d)">Preview</button>
                  <button class="text-btn" [disabled]="d.status!=='Clean'" (click)="download(d)">Download</button>
                  <button class="text-btn warn" *ngIf="d.status==='ScanFailed' || d.status==='Pending'" (click)="retryScan(d)">Retry Scan</button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section class="content" *ngIf="section==='documents' || section==='shared'">
        <div class="page-heading">
          <div>
            <p class="eyebrow">{{section==='shared' ? 'COLLABORATION' : 'DOCUMENT REPOSITORY'}}</p>
            <h1>{{section==='shared' ? 'Shared With Me' : 'Document Library'}}</h1>
            <p class="muted">Server-enforced Read/Edit permissions, malware verification, and version control.</p>
          </div>
          <button class="primary" *ngIf="canUpload" (click)="openUploadModal = true">＋ Upload Document</button>
        </div>
        <div class="toolbar">
          <input class="search" [(ngModel)]="search" placeholder="Search by name, owner, category or tag…">
          <select class="filter-select" [(ngModel)]="categoryFilter">
            <option value="">All Categories</option>
            <option value="General">General</option>
            <option value="Finance">Finance</option>
            <option value="Legal">Legal</option>
            <option value="HR">HR</option>
            <option value="Engineering">Engineering</option>
          </select>
          <select class="filter-select" [(ngModel)]="statusFilter">
            <option value="">All Scan States</option>
            <option value="Clean">Clean</option>
            <option value="ScanFailed">ScanFailed (Retry needed)</option>
            <option value="Rejected">Rejected / Quarantined</option>
          </select>
          <button class="secondary" (click)="loadDocuments()">Refresh</button>
        </div>
        <p class="notice" *ngIf="message">{{message}}</p>
        <div class="table-card">
          <div class="table-title"><strong>{{section==='shared' ? 'Shared Documents' : 'All Accessible Documents'}}</strong><span>{{filtered.length}} results</span></div>
          <div class="table-scroll">
            <table>
              <thead><tr><th>DOCUMENT</th><th>OWNER</th><th>CATEGORY</th><th>ACCESS</th><th>SCAN STATUS</th><th>UPDATED</th><th>ACTIONS</th></tr></thead>
              <tbody>
                <tr *ngFor="let d of filtered">
                  <td>
                    <span class="file-icon">▧</span><strong>{{d.name}}</strong> <small class="ver">v{{d.currentVersion || 1}}</small>
                    <div class="sub-desc" *ngIf="d.scanFailureReason && d.status!=='Clean'">{{d.scanFailureReason}}</div>
                  </td>
                  <td>{{d.ownerEmail}}</td>
                  <td>{{d.category || 'General'}}</td>
                  <td><span class="badge">{{d.accessLevel}}</span></td>
                  <td><span class="pill" [class.clean]="d.status==='Clean'" [class.rejected]="d.status==='Rejected'">{{d.status}}</span></td>
                  <td>{{(d.updatedAt || d.createdAt) | date:'mediumDate'}}</td>
                  <td>
                    <button class="text-btn" [disabled]="d.status!=='Clean'" (click)="openPreview(d)">Preview</button>
                    <button class="text-btn" [disabled]="d.status!=='Clean'" (click)="download(d)">Download</button>
                    <button class="text-btn" *ngIf="d.canEdit && d.status==='Clean'" (click)="openEdit(d)">Edit</button>
                    <button class="text-btn warn" *ngIf="d.status==='ScanFailed' || d.status==='Pending'" (click)="retryScan(d)">⟳ Retry Scan</button>
                    <button class="text-btn" *ngIf="d.isOwner" (click)="openShare(d)">Share</button>
                    <button class="text-btn danger" *ngIf="d.isOwner" (click)="remove(d)">Delete</button>
                  </td>
                </tr>
                <tr *ngIf="filtered.length===0"><td colspan="7" class="empty">No matching documents found.</td></tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section class="content" *ngIf="section==='folders'">
        <div class="page-heading"><div><p class="eyebrow">TAXONOMY</p><h1>Folders & Categories</h1></div></div>
        <div class="table-card create-card">
          <h3>Create Workspace Folder</h3>
          <form (ngSubmit)="createFolder()">
            <input name="folderName" [(ngModel)]="newFolderName" placeholder="Folder name (e.g. Q4 Board Reports)" required>
            <input name="folderDesc" [(ngModel)]="newFolderDesc" placeholder="Description">
            <button class="primary">Create Folder</button>
          </form>
        </div>
        <div class="table-card">
          <table>
            <thead><tr><th>FOLDER NAME</th><th>DESCRIPTION</th><th>DOCUMENTS</th><th>CREATED</th></tr></thead>
            <tbody>
              <tr *ngFor="let f of folders">
                <td><strong>📁 {{f.name}}</strong></td>
                <td>{{f.description || '—'}}</td>
                <td>{{f.documentCount}}</td>
                <td>{{f.createdAt | date:'mediumDate'}}</td>
              </tr>
              <tr *ngIf="folders.length===0"><td colspan="4" class="empty">No folders created yet.</td></tr>
            </tbody>
          </table>
        </div>
      </section>

      <section class="content" *ngIf="section==='audit'">
        <div class="page-heading">
          <div><p class="eyebrow">SECURITY & COMPLIANCE</p><h1>Tamper-Evident Audit Trail</h1><p class="muted">HMAC-SHA256 hash-chained records for successful and denied operations.</p></div>
          <button class="secondary" (click)="loadAudit()">Refresh Logs</button>
        </div>
        <div class="table-card">
          <div class="table-title"><strong>Audit Events</strong><span>{{audits.length}} records</span></div>
          <table>
            <thead><tr><th>TIME (UTC)</th><th>ACTOR</th><th>ACTION</th><th>DOCUMENT</th><th>RESULT</th><th>REASON</th><th>HMAC CHAIN</th></tr></thead>
            <tbody>
              <tr *ngFor="let a of audits">
                <td>{{a.createdAt | date:'short'}}</td>
                <td>{{a.actorEmail || (a.actorId | slice:0:8)}}</td>
                <td><strong>{{a.action}}</strong></td>
                <td>{{a.documentName || (a.documentId | slice:0:8) || '—'}}</td>
                <td><span class="pill" [class.clean]="a.result==='Success'" [class.rejected]="a.result==='Denied'">{{a.result}}</span></td>
                <td>{{a.reason || '—'}}</td>
                <td><code>{{a.entryHash | slice:0:12}}…</code></td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section class="content" *ngIf="section==='notifications'">
        <div class="page-heading"><div><p class="eyebrow">ALERTS</p><h1>Workspace Notifications</h1></div></div>
        <div class="table-card">
          <table>
            <thead><tr><th>TIME</th><th>TITLE</th><th>MESSAGE</th><th>TYPE</th></tr></thead>
            <tbody>
              <tr *ngFor="let n of notifications">
                <td>{{n.createdAt | date:'short'}}</td>
                <td><strong>{{n.title}}</strong></td>
                <td>{{n.message}}</td>
                <td><span class="badge">{{n.type}}</span></td>
              </tr>
              <tr *ngIf="notifications.length===0"><td colspan="4" class="empty">No notifications.</td></tr>
            </tbody>
          </table>
        </div>
      </section>

      <section class="content" *ngIf="section==='profile'">
        <div class="page-heading"><div><p class="eyebrow">ACCOUNT SECURITY</p><h1>Profile & Password Management</h1></div></div>
        <div class="table-card create-card">
          <h3>Change Password</h3>
          <form (ngSubmit)="changePassword()">
            <input type="password" name="curPwd" [(ngModel)]="currentPassword" placeholder="Current password" required>
            <input type="password" name="newPwd" [(ngModel)]="newPassword" placeholder="New password (14+ characters)" required>
            <button class="primary">Update Password</button>
          </form>
          <p class="notice" *ngIf="message">{{message}}</p>
        </div>
      </section>

      <section class="content" *ngIf="section==='admin' && isAdmin">
        <div class="page-heading"><div><p class="eyebrow">ENTERPRISE GOVERNANCE</p><h1>Administration & Security Monitoring</h1></div></div>
        <div class="table-card create-card">
          <h3>Provision Corporate Account</h3>
          <form (ngSubmit)="createUser()">
            <input type="email" name="newEmail" [(ngModel)]="newEmail" placeholder="Member email" required>
            <input type="text" name="newFullName" [(ngModel)]="newFullName" placeholder="Full name">
            <input type="text" name="newDept" [(ngModel)]="newDepartment" placeholder="Department">
            <input type="password" name="tempPassword" [(ngModel)]="tempPassword" placeholder="Temporary password (14+ chars)" required>
            <select name="newRole" [(ngModel)]="newRole"><option>Owner</option><option>Viewer</option></select>
            <button class="primary">Create Account</button>
          </form>
        </div>
        <div class="table-card">
          <div class="table-title"><strong>Corporate Directory</strong></div>
          <table>
            <thead><tr><th>EMAIL</th><th>NAME</th><th>DEPARTMENT</th><th>ROLE</th><th>STATUS</th><th>ACTION</th></tr></thead>
            <tbody>
              <tr *ngFor="let u of users">
                <td><strong>{{u.email}}</strong></td>
                <td>{{u.fullName || '—'}}</td>
                <td>{{u.department || 'General'}}</td>
                <td>{{u.role}}</td>
                <td><span class="pill" [class.clean]="u.isActive!==false" [class.rejected]="u.isActive===false">{{u.isActive===false ? 'Disabled' : 'Active'}}</span></td>
                <td>
                  <button class="text-btn" *ngIf="u.id !== user?.id" (click)="toggleUserStatus(u)">{{u.isActive===false ? 'Activate' : 'Deactivate'}}</button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </main>
  </div>
  `,
  styles: [`
    :host{display:block;min-height:100vh;color:#172b45}
    .app-shell{min-height:100vh;display:flex;background:#f5f7fa}
    .sidebar{width:255px;background:#122b49;color:#d9e4f1;padding:25px 16px;display:flex;flex-direction:column;flex-shrink:0}
    .brand{display:flex;align-items:center;gap:11px;font-size:18px;font-weight:800;padding:0 10px 30px}
    .brand small{display:block;font-size:9px;letter-spacing:1.4px;color:#91a8c2;margin-top:3px}
    .brand-icon{width:38px;height:38px;border-radius:11px;background:#fff;color:#17365d;display:grid;place-items:center;font-size:22px}
    .nav-label{font-size:10px;letter-spacing:1.4px;color:#7891ad;padding:0 12px 8px}
    .nav{border:0;background:transparent;color:#c4d2e2;text-align:left;padding:11px 14px;border-radius:8px;display:flex;gap:12px;cursor:pointer;font:inherit;margin-bottom:2px}
    .nav.active,.nav:hover{background:#244364;color:white}
    .sidebar-bottom{margin-top:auto;font-size:12px;color:#9eb2c8;padding:15px 10px}
    .status-dot{display:inline-block;width:7px;height:7px;background:#45c68a;border-radius:50%;margin-right:8px}
    .main{min-width:0;flex:1}
    .topbar{height:72px;background:white;border-bottom:1px solid #e5eaf0;display:flex;align-items:center;justify-content:space-between;padding:0 36px}
    .crumb,.muted{color:#7c8999}
    .user-area{display:flex;align-items:center;gap:10px;font-size:12px}
    .user-area small{display:block;color:#7c8999;margin-top:3px}
    .avatar{width:34px;height:34px;border-radius:50%;background:#e8eef7;color:#17365d;display:grid;place-items:center;font-weight:800}
    .logout{border:0;background:transparent;color:#52657b;cursor:pointer;margin-left:14px}
    .content{padding:32px 36px;max-width:1500px;margin:auto}
    .page-heading{display:flex;justify-content:space-between;align-items:center;margin-bottom:24px}
    .eyebrow{font-size:10px;font-weight:800;letter-spacing:1.5px;color:#63809f;margin:0 0 6px}
    h1{font-size:28px;letter-spacing:-.7px;margin:0 0 6px}
    .muted{margin:0;font-size:14px}
    .primary,.secondary{border:0;border-radius:8px;padding:10px 16px;font-weight:700;cursor:pointer;font:inherit}
    .primary{background:#122b49;color:white}
    .primary:hover{background:#1d4774}
    .secondary{background:white;border:1px solid #dbe2ea;color:#344b65}
    .stats4{display:grid;grid-template-columns:repeat(4,1fr);gap:16px;margin-bottom:22px}
    .stats4 article{background:white;border:1px solid #e7ebf0;border-radius:12px;padding:20px}
    .stats4 span,.stats4 small{display:block;color:#758397;font-size:12px}
    .stats4 strong{display:block;font-size:28px;margin:8px 0 3px}
    .toolbar{display:flex;gap:10px;margin-bottom:15px;flex-wrap:wrap}
    .search{flex:1;min-width:260px;border:1px solid #dce3eb;border-radius:8px;padding:11px;font:inherit}
    .filter-select{border:1px solid #dce3eb;border-radius:8px;padding:11px;background:white;font:inherit}
    .table-card{background:white;border:1px solid #e5eaf0;border-radius:12px;overflow:hidden;margin-bottom:18px}
    .table-title{display:flex;justify-content:space-between;padding:18px 21px;border-bottom:1px solid #edf0f4}
    .table-title span{color:#8290a1;font-size:12px}
    table{width:100%;border-collapse:collapse;font-size:12px}
    th{text-align:left;background:#fafbfd;color:#748398;font-size:10px;letter-spacing:.8px;padding:13px 16px}
    td{padding:14px 16px;border-top:1px solid #f0f2f5;white-space:nowrap}
    .file-icon{color:#47719b;margin-right:8px}
    .ver{color:#7c8999;font-size:11px;margin-left:4px}
    .sub-desc{font-size:11px;color:#b42318;margin-top:3px}
    .badge{background:#eef3f9;color:#1d4774;padding:4px 8px;border-radius:6px;font-size:10px;font-weight:700}
    .pill{display:inline-block;background:#fff4df;color:#986400;border-radius:20px;padding:4px 9px;font-size:10px;font-weight:700}
    .pill.clean{background:#e5f7ee;color:#18794e}
    .pill.rejected{background:#fef3f2;color:#b42318}
    .text-btn{border:0;background:transparent;color:#245b91;font-weight:700;cursor:pointer;margin-right:8px;font-size:11px}
    .text-btn:disabled{opacity:.4;cursor:not-allowed}
    .text-btn.warn{color:#b54708}
    .text-btn.danger{color:#b42318}
    .empty{text-align:center;color:#8592a2;padding:35px}
    .notice{color:#176b48;font-weight:600}
    .create-card{padding:22px}
    .create-card h3{margin-top:0}
    .create-card form{display:flex;gap:10px;flex-wrap:wrap}
    .create-card input,.create-card select{padding:11px;border:1px solid #dce3eb;border-radius:8px;font:inherit;min-width:170px}
    .table-scroll{overflow-x:auto}
    code{font-size:10px;color:#53677d}
  `]
})
export class WorkspaceComponent implements OnInit {
  private api = inject(ApiService);
  private router = inject(Router);
  user: User | null = null;
  documents: DocumentItem[] = [];
  folders: FolderItem[] = [];
  audits: AuditItem[] = [];
  notifications: NotificationItem[] = [];
  users: User[] = [];
  section = 'dashboard';
  search = '';
  categoryFilter = '';
  statusFilter = '';
  message = '';
  openUploadModal = false;

  newFolderName = '';
  newFolderDesc = '';
  currentPassword = '';
  newPassword = '';
  newEmail = '';
  newFullName = '';
  newDepartment = 'General';
  tempPassword = '';
  newRole = 'Owner';

  get isAdmin() { return this.user?.role === 'Admin'; }
  get canUpload() { return this.user?.role === 'Owner' || this.user?.role === 'Admin'; }
  get initials() { return (this.user?.email || 'U').slice(0, 1).toUpperCase(); }
  get sectionLabel() { return this.section.toUpperCase(); }
  get cleanCount() { return this.documents.filter(d => d.status === 'Clean').length; }
  get sharedWithMe() { return this.documents.filter(d => !d.isOwner); }
  get unreadCount() { return this.notifications.filter(n => !n.isRead).length; }

  get filtered() {
    const base = this.section === 'shared' ? this.sharedWithMe : this.documents;
    const q = this.search.toLowerCase();
    return base.filter(d => {
      if (this.categoryFilter && d.category !== this.categoryFilter) return false;
      if (this.statusFilter && d.status !== this.statusFilter) return false;
      return `${d.name} ${d.ownerEmail} ${d.category} ${d.tags || ''}`.toLowerCase().includes(q);
    });
  }

  ngOnInit() {
    const raw = sessionStorage.getItem('trustvault_user');
    if (!sessionStorage.getItem('trustvault_token') || !raw) { this.router.navigateByUrl('/login'); return; }
    this.user = JSON.parse(raw) as User;
    this.loadDocuments();
    this.loadNotifications();
  }

  setSection(s: string) {
    this.section = s;
    this.message = '';
    if (s === 'documents' || s === 'shared' || s === 'dashboard') this.loadDocuments();
    if (s === 'folders') this.loadFolders();
    if (s === 'audit') this.loadAudit();
    if (s === 'notifications') this.loadNotifications();
    if (s === 'admin') this.loadUsers();
  }

  loadDocuments() { this.api.documents().subscribe({ next: x => this.documents = x }); }
  loadFolders() { this.api.folders().subscribe({ next: x => this.folders = x }); }
  loadAudit() { this.api.audit().subscribe({ next: x => this.audits = x }); }
  loadNotifications() { this.api.notifications().subscribe({ next: x => this.notifications = x }); }
  loadUsers() { this.api.users().subscribe({ next: x => this.users = x }); }

  retryScan(d: DocumentItem) {
    this.api.retryScan(d.id).subscribe({
      next: res => { this.message = `Scan completed for ${d.name}: ${res.status}`; this.loadDocuments(); },
      error: () => this.message = 'Retry scan failed.'
    });
  }

  openPreview(d: DocumentItem) {
    this.api.preview(d.id).subscribe({
      next: info => alert(`Document: ${info.name}\nStatus: ${info.status}\nAccess: ${info.accessLevel}\nSHA-256: ${info.sha256Hash}\n\n${info.textPreview || ''}`)
    });
  }

  openEdit(d: DocumentItem) {
    const name = prompt('Update document name:', d.name);
    if (!name) return;
    const category = prompt('Update category:', d.category) || d.category;
    this.api.update(d.id, { name, category }).subscribe({
      next: () => { this.message = 'Document updated.'; this.loadDocuments(); },
      error: e => this.message = e.error?.message || 'Edit denied.'
    });
  }

  openShare(d: DocumentItem) {
    const email = prompt('Share with member email:');
    if (!email) return;
    const access = prompt('Enter Read or Edit:', 'Read');
    if (!access) return;
    this.api.grant(d.id, email, access).subscribe({
      next: () => this.message = `Granted ${access} permission to ${email}.`,
      error: e => this.message = e.error?.message || 'Could not grant permission.'
    });
  }

  download(d: DocumentItem) {
    this.api.download(d.id).subscribe({
      next: blob => { const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = d.name; a.click(); URL.revokeObjectURL(url); },
      error: () => this.message = 'Download denied or document is not clean.'
    });
  }

  remove(d: DocumentItem) {
    if (!confirm(`Delete ${d.name}?`)) return;
    this.api.remove(d.id).subscribe({ next: () => { this.message = 'Document deleted.'; this.loadDocuments(); } });
  }

  createFolder() {
    this.api.createFolder(this.newFolderName, this.newFolderDesc).subscribe({
      next: () => { this.newFolderName = ''; this.newFolderDesc = ''; this.loadFolders(); }
    });
  }

  changePassword() {
    this.api.changePassword(this.currentPassword, this.newPassword).subscribe({
      next: () => { this.message = 'Password updated successfully.'; this.currentPassword = ''; this.newPassword = ''; },
      error: e => this.message = e.error?.message || 'Password update failed.'
    });
  }

  createUser() {
    this.api.createUser(this.newEmail, this.tempPassword, this.newRole, this.newFullName, this.newDepartment).subscribe({
      next: () => { this.message = 'Member created.'; this.newEmail = ''; this.tempPassword = ''; this.loadUsers(); },
      error: e => this.message = e.error?.message || 'Could not create member.'
    });
  }

  toggleUserStatus(u: User) {
    this.api.setUserStatus(u.id, u.isActive === false).subscribe({ next: () => this.loadUsers() });
  }

  logout() { sessionStorage.clear(); this.router.navigateByUrl('/login'); }
}
