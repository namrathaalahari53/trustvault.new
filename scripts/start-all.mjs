import http from 'node:http';

const FRONTEND_PORT = Number(process.env.FRONTEND_PORT || process.env.PORT || 4200);
const API_PORT = Number(process.env.API_PORT || 5106);
process.env.API_PORT = String(API_PORT);

await import('./local-api-server.mjs');

const spaHtml = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>TrustVault — Enterprise Zero-Trust Document Platform</title>
  <base href="/">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap">
  <style>
    *{box-sizing:border-box}
    html,body{margin:0;min-height:100%;font-family:Inter,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;background:#f4f6f9;color:#172b45}
    button,input,select,textarea{font-family:inherit}
    button:focus-visible,input:focus-visible,select:focus-visible,textarea:focus-visible{outline:3px solid #91b8e5;outline-offset:2px}

    /* Login Centered Card with Persona Buttons Under Credentials */
    .login-bg {
      min-height:100vh;
      display:grid;
      place-items:center;
      padding:28px 20px;
      background:linear-gradient(135deg,#09192d 0%,#132f54 100%);
    }
    .login-card {
      width:min(520px, 100%);
      background:white;
      padding:36px 38px;
      border:1px solid #e2e8f0;
      border-radius:18px;
      box-shadow:0 24px 64px rgba(0,0,0,.38);
    }
    .login-brand { display:flex; align-items:center; gap:14px; margin-bottom:10px; }
    .brand-mark { width:46px;height:46px;border-radius:12px;background:#0f2540;color:white;display:grid;place-items:center;font-weight:800;font-size:22px;flex-shrink:0; }
    .login-card .eyebrow { margin:0;color:#4a6b8c;font-size:10px;font-weight:800;letter-spacing:1.5px; }
    .login-card h1 { margin:3px 0 0; font-size:24px; letter-spacing:-.6px; color:#0f2540; }
    .muted,.fine { color:#64748b; font-size:13px; }
    .login-card form { display:grid; gap:10px; margin-top:18px; }
    .login-card label { font-size:12px;font-weight:700; margin-top:4px; color:#1e293b; }
    .login-card input { width:100%; padding:11px 13px;border:1px solid #cbd5e1;border-radius:8px;font:inherit;font-size:13.5px; }
    .pwd-wrap { display:flex; gap:8px; }
    .pwd-toggle { border:1px solid #cbd5e1; background:#f8fafc; border-radius:8px; padding:0 14px; font-size:12px; font-weight:600; color:#334155; cursor:pointer; }
    .full { width:100%; margin-top:8px; }
    .error { color:#b42318; background:#fef3f2; border:1px solid #fecdca; padding:10px 12px; border-radius:8px; font-size:12px; margin:4px 0 0; }
    .fine { text-align:center;font-size:11px;margin-top:18px;line-height:1.5; }

    /* 4 Persona Buttons Under Login Credentials (Half Horizontal Width) */
    .persona-btn-section {
      margin-top:20px;
      padding-top:16px;
      border-top:1px solid #e2e8f0;
    }
    .persona-btn-title {
      font-size:9.5px;
      font-weight:800;
      letter-spacing:1.1px;
      color:#475569;
      margin:0 0 10px;
      text-align:center;
    }
    .persona-btn-grid {
      display:grid;
      grid-template-columns:repeat(2, minmax(0, 1fr));
      gap:8px;
      width:52%;
      max-width:240px;
      margin:0 auto;
    }
    .persona-login-btn {
      display:flex;
      align-items:center;
      gap:7px;
      width:100%;
      min-width:0;
      overflow:hidden;
      text-align:left;
      padding:7px 8px;
      border-radius:8px;
      border:1px solid #cbd5e1;
      background:#f8fafc;
      cursor:pointer;
      transition:all .14s ease;
    }
    .persona-login-btn:hover {
      background:#eef2f7;
      border-color:#94a3b8;
      transform:translateY(-1px);
      box-shadow:0 4px 10px rgba(15,37,64,.08);
    }
    .persona-btn-avatar {
      width:24px;
      height:24px;
      border-radius:6px;
      color:white;
      display:grid;
      place-items:center;
      font-weight:800;
      font-size:9.5px;
      flex-shrink:0;
    }
    .persona-btn-info { min-width:0; flex:1; overflow:hidden; }
    .persona-btn-name {
      display:block;
      font-size:10.5px;
      font-weight:800;
      color:#0f2540;
      white-space:nowrap;
      overflow:hidden;
      text-overflow:ellipsis;
    }
    .persona-btn-role {
      display:block;
      font-size:8.5px;
      font-weight:700;
      color:#334155;
      margin-top:1px;
      white-space:nowrap;
      overflow:hidden;
      text-overflow:ellipsis;
    }
    .persona-btn-meta {
      display:block;
      font-size:8px;
      color:#64748b;
      margin-top:1px;
      white-space:nowrap;
      overflow:hidden;
      text-overflow:ellipsis;
    }

    /* Shell */
    .app-shell{min-height:100vh;display:flex;background:#f4f6f9}
    .sidebar{width:265px;background:#0f2540;color:#d9e4f1;padding:22px 14px;display:flex;flex-direction:column;flex-shrink:0}
    .brand{display:flex;align-items:center;gap:11px;font-size:18px;font-weight:800;padding:0 10px 20px;color:white}
    .brand small{display:block;font-size:9px;letter-spacing:1.4px;color:#8ba3be;margin-top:3px}
    .brand-icon{width:38px;height:38px;border-radius:10px;background:#1e4976;color:#fff;display:grid;place-items:center;font-size:20px;border:1px solid #356699}
    .sidebar-id-card {
      background:rgba(255,255,255,.07);
      border:1px solid rgba(255,255,255,.14);
      border-radius:10px;
      padding:12px;
      margin:0 4px 16px;
      font-size:11.5px;
    }
    .sidebar-id-card strong { display:block; color:white; font-size:13px; }
    .sidebar-id-card .sid-role { display:inline-block; margin-top:4px; padding:2px 7px; border-radius:4px; font-size:9.5px; font-weight:800; background:rgba(255,255,255,.16); color:#fff; }
    .sidebar-id-card .sid-meta { color:#9eb2c8; font-size:10.5px; margin-top:6px; line-height:1.4; }
    .nav-label{font-size:10px;font-weight:800;letter-spacing:1.4px;color:#6f8ba8;padding:10px 12px 6px}
    .nav{border:0;background:transparent;color:#c4d2e2;text-align:left;padding:10px 13px;border-radius:8px;display:flex;align-items:center;justify-content:space-between;cursor:pointer;font:inherit;font-size:13px;font-weight:500;margin-bottom:2px}
    .nav-left{display:flex;align-items:center;gap:11px}
    .nav.active,.nav:hover{background:#1e3e62;color:white}
    .nav-badge{background:#e11d48;color:white;border-radius:10px;padding:1px 7px;font-size:10px;font-weight:700}
    .sidebar-bottom{margin-top:auto;font-size:11px;color:#9eb2c8;padding:14px 12px;background:#153052;border-radius:8px}
    .status-dot{display:inline-block;width:7px;height:7px;background:#10b981;border-radius:50%;margin-right:7px}

    .main{min-width:0;flex:1;display:flex;flex-direction:column}
    .topbar{height:68px;background:white;border-bottom:1px solid #e2e8f0;display:flex;align-items:center;justify-content:space-between;padding:0 32px;gap:16px}
    .crumb{color:#64748b;font-size:13px}
    .topbar-right{display:flex;align-items:center;gap:14px}
    .role-switcher{display:flex;align-items:center;gap:6px;background:#f1f5f9;padding:6px 10px;border-radius:8px;border:1px solid #cbd5e1;font-size:11.5px}
    .role-switcher span{font-weight:800;color:#334155}
    .role-switcher select{border:0;background:transparent;font-weight:700;color:#0f2540;font-size:11.5px;cursor:pointer}
    .user-area{display:flex;align-items:center;gap:10px;font-size:12px}
    .user-area small{display:block;color:#64748b;margin-top:2px;font-size:11px}
    .avatar{width:36px;height:36px;border-radius:9px;color:white;display:grid;place-items:center;font-weight:800;font-size:13px}
    .logout{border:1px solid #cbd5e1;background:white;color:#334155;padding:6px 12px;border-radius:6px;font-size:12px;font-weight:600;cursor:pointer}
    .logout:hover{background:#f8fafc}

    .content{padding:26px 32px;max-width:1480px;width:100%;margin:0 auto}
    .page-heading{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:20px;gap:16px;flex-wrap:wrap}
    .eyebrow{font-size:10px;font-weight:800;letter-spacing:1.5px;color:#4a6b8c;margin:0 0 5px}
    h1{font-size:25px;letter-spacing:-.6px;margin:0 0 5px;color:#0f2540}
    .heading-actions{display:flex;gap:10px;align-items:center;flex-wrap:wrap}

    /* Profile Identity Hero Card on Dashboard & Profile */
    .persona-hero {
      border-radius:14px;
      padding:22px 24px;
      color:white;
      margin-bottom:22px;
      display:grid;
      grid-template-columns: 1.4fr 1fr;
      gap:22px;
      align-items:center;
      box-shadow:0 10px 28px rgba(15,37,64,.16);
    }
    .persona-hero h2 { margin:4px 0 6px; font-size:22px; letter-spacing:-.5px; }
    .persona-hero p { margin:0 0 12px; font-size:13px; opacity:.92; line-height:1.45; }
    .persona-pills { display:flex; flex-wrap:wrap; gap:8px; font-size:11px; font-weight:700; }
    .persona-pills span { background:rgba(255,255,255,.16); border:1px solid rgba(255,255,255,.25); padding:5px 10px; border-radius:6px; }
    .persona-caps-box {
      background:rgba(0,0,0,.22);
      border:1px solid rgba(255,255,255,.2);
      border-radius:11px;
      padding:14px 16px;
      font-size:11.5px;
    }
    .persona-caps-box strong { display:block; font-size:10.5px; letter-spacing:1px; text-transform:uppercase; margin-bottom:8px; opacity:.85; }
    .persona-caps-box ul { list-style:none; margin:0; padding:0; display:grid; gap:5px; }

    .primary,.secondary,.danger-btn,.warn-btn{border:0;border-radius:8px;padding:10px 15px;font-weight:700;cursor:pointer;font-size:13px;display:inline-flex;align-items:center;gap:6px}
    .primary{background:#122b49;color:white}
    .primary:hover{background:#1d4774}
    .primary:disabled{opacity:.55;cursor:not-allowed}
    .secondary{background:white;border:1px solid #cbd5e1;color:#1e293b}
    .secondary:hover{background:#f8fafc}
    .warn-btn{background:#fffbeb;border:1px solid #fde68a;color:#b45309}
    .danger-btn{background:#fef2f2;border:1px solid #fecaca;color:#b91c1c}

    .stats{display:grid;grid-template-columns:repeat(4,1fr);gap:16px;margin-bottom:22px}
    .stats article{background:white;border:1px solid #e2e8f0;border-radius:12px;padding:18px 20px;box-shadow:0 1px 2px rgba(0,0,0,.03)}
    .stats span,.stats small{display:block;color:#64748b;font-size:12px}
    .stats strong{display:block;font-size:28px;margin:6px 0 4px;color:#0f2540}

    .banner{padding:12px 16px;border-radius:10px;margin-bottom:18px;font-size:13px;font-weight:600;display:flex;justify-content:space-between;align-items:center}
    .banner.success{background:#ecfdf5;border:1px solid #a7f3d0;color:#065f46}
    .banner.error{background:#fef2f2;border:1px solid #fecaca;color:#991b1b}
    .banner.info{background:#eff6ff;border:1px solid #bfdbfe;color:#1e40af}

    .toolbar{display:flex;gap:10px;margin-bottom:16px;flex-wrap:wrap}
    .search{flex:1;min-width:240px;border:1px solid #cbd5e1;border-radius:8px;padding:10px 13px;font-size:13px;background:white}
    .select-filter{border:1px solid #cbd5e1;border-radius:8px;padding:10px 12px;font-size:13px;background:white;color:#1e293b}

    .table-card{background:white;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;margin-bottom:20px;box-shadow:0 1px 3px rgba(0,0,0,.02)}
    .table-title{display:flex;justify-content:space-between;align-items:center;padding:16px 20px;border-bottom:1px solid #f1f5f9}
    .table-title strong{font-size:14px;color:#0f2540}
    .table-title span{color:#64748b;font-size:12px}
    .table-scroll{overflow-x:auto}
    table{width:100%;border-collapse:collapse;font-size:12.5px}
    th{text-align:left;background:#f8fafc;color:#64748b;font-size:10.5px;font-weight:800;letter-spacing:.7px;padding:12px 16px;border-bottom:1px solid #e2e8f0}
    td{padding:13px 16px;border-top:1px solid #f1f5f9;vertical-align:middle}
    .doc-name-cell{display:flex;align-items:flex-start;gap:9px}
    .file-icon{width:30px;height:30px;border-radius:7px;background:#eef2f6;color:#122b49;display:grid;place-items:center;font-weight:800;font-size:11px;flex-shrink:0}
    .doc-sub{font-size:11px;color:#64748b;margin-top:2px}
    .doc-reason{font-size:11px;color:#b45309;margin-top:3px;font-weight:500}
    .doc-reason.rejected{color:#b91c1c}

    .pill{display:inline-flex;align-items:center;gap:4px;border-radius:20px;padding:4px 9px;font-size:10.5px;font-weight:700}
    .pill.clean{background:#dcfce7;color:#15803d}
    .pill.pending{background:#fef3c7;color:#b45309}
    .pill.rejected{background:#fee2e2;color:#b91c1c}
    .access-pill{display:inline-block;padding:3px 8px;border-radius:6px;font-size:10.5px;font-weight:700;background:#e0f2fe;color:#0369a1}
    .access-pill.Owner{background:#ede9fe;color:#5b21b6}
    .access-pill.Edit{background:#fef3c7;color:#92400e}

    .action-row{display:flex;gap:6px;flex-wrap:wrap}
    .act-btn{border:1px solid #cbd5e1;background:white;color:#1e293b;font-weight:600;font-size:11px;padding:5px 9px;border-radius:6px;cursor:pointer}
    .act-btn:hover:not(:disabled){background:#f1f5f9}
    .act-btn:disabled{opacity:.38;cursor:not-allowed}
    .act-btn.retry{background:#fffbeb;border-color:#fcd34d;color:#92400e;font-weight:700}
    .act-btn.retry:hover{background:#fef3c7}
    .act-btn.danger{color:#b91c1c;border-color:#fecaca;background:#fef2f2}
    .empty{text-align:center;color:#64748b;padding:36px}
    code{font-size:11px;background:#f1f5f9;padding:2px 6px;border-radius:4px;color:#334155}

    .form-card{padding:20px}
    .form-card h3{margin:0 0 14px;font-size:15px}
    .form-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:10px}
    .form-grid input,.form-grid select,.form-grid textarea{padding:10px 12px;border:1px solid #cbd5e1;border-radius:8px;font-size:13px;width:100%}

    .modal-backdrop{position:fixed;inset:0;background:rgba(15,37,64,.55);display:grid;place-items:center;padding:20px;z-index:100}
    .modal{background:white;width:min(620px,100%);max-height:90vh;overflow-y:auto;border-radius:14px;box-shadow:0 24px 60px rgba(0,0,0,.3);border:1px solid #e2e8f0}
    .modal-header{display:flex;justify-content:space-between;align-items:center;padding:18px 22px;border-bottom:1px solid #e2e8f0}
    .modal-header h3{margin:0;font-size:17px;color:#0f2540}
    .modal-close{border:0;background:transparent;font-size:20px;cursor:pointer;color:#64748b}
    .modal-body{padding:22px}
    .modal-footer{padding:14px 22px;border-top:1px solid #e2e8f0;display:flex;justify-content:flex-end;gap:10px;background:#f8fafc}
    .field-group{margin-bottom:14px}
    .field-group label{display:block;font-size:12px;font-weight:700;color:#334155;margin-bottom:5px}
    .field-group input,.field-group select,.field-group textarea{width:100%;padding:10px 12px;border:1px solid #cbd5e1;border-radius:8px;font-size:13px}
    .preview-box{background:#0f172a;color:#e2e8f0;padding:16px;border-radius:8px;font-family:monospace;font-size:12px;white-space:pre-wrap;max-height:220px;overflow-y:auto;margin:12px 0}
    .meta-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px;background:#f8fafc;padding:12px;border-radius:8px;border:1px solid #e2e8f0;font-size:12px}

    @media(max-width:1100px){
      .login-shell{grid-template-columns:1fr}
      .login-card{position:static}
      .profile-cards-grid{grid-template-columns:1fr}
      .persona-hero{grid-template-columns:1fr}
      .stats{grid-template-columns:1fr 1fr}
    }
  </style>
</head>
<body>
  <app-root id="app"></app-root>
  <script>
    const DEMO_PROFILES = [
      {
        employeeId: 'TV-EMP-0001',
        fullName: 'Dr. Ananya Deshmukh',
        initials: 'AD',
        jobTitle: 'Chief Information Security Officer (CISO)',
        department: 'Enterprise Security & Governance',
        clearanceLevel: 'Level 5 — Unrestricted System & Cryptographic Audit Authority',
        location: 'Mumbai HQ · Tower A, Floor 18',
        phone: '+91 22 6800 1001 (Ext. 101)',
        role: 'Admin',
        badge: 'GLOBAL ADMIN · CISO',
        color: '#0f2540',
        email: 'admin@example.local',
        password: 'ChangeThis-Admin-Password-2026!',
        bio: 'Oversees enterprise-wide zero-trust access policies, user lifecycle provisioning, ClamAV threat quarantine telemetry, and HMAC-SHA256 audit log verification.',
        workspaceFocus: 'Admin Security Command Center, User Provisioning, Cryptographic Audit Chain Verification & ISO-27001 Policy Custody.',
        capabilities: [
          { text: 'Provision, Activate & Deactivate Corporate Accounts', ok: true },
          { text: 'Verify Cryptographic HMAC-SHA256 Audit Chain from GENESIS', ok: true },
          { text: 'Inspect All Security Denials & Quarantine Telemetry', ok: true },
          { text: 'Upload & Share Enterprise Governance Policies', ok: true },
          { text: 'Cannot Bypass Private Unshared Owner Documents (Zero-Trust)', ok: false }
        ]
      },
      {
        employeeId: 'TV-EMP-0104',
        fullName: 'Vivek Sharma',
        initials: 'VS',
        jobTitle: 'VP of Legal & Corporate Operations',
        department: 'Legal, M&A & Corporate Secretariat',
        clearanceLevel: 'Level 4 — Document Custodian & Granular Sharing Authority',
        location: 'Bengaluru Campus · Legal Wing 4B',
        phone: '+91 80 4920 2204 (Ext. 204)',
        role: 'Owner',
        badge: 'DOCUMENT OWNER · CUSTODIAN',
        color: '#4f46e5',
        email: 'owner@trustvault.local',
        password: 'Corporate-Owner-2026!',
        bio: 'Primary custodian of executive contracts, M&A term sheets, and board forecasts. Manages folder taxonomies and grants/revokes per-document Read and Edit access.',
        workspaceFocus: 'Full Document Custody, Folder Taxonomy Management, Granular Read/Edit Sharing & Immediate Permission Revocation.',
        capabilities: [
          { text: 'Upload, Classify & Version Corporate Documents', ok: true },
          { text: 'Owns Strictly Private M&A Term Sheet (Hidden from Others)', ok: true },
          { text: 'Grant & Immediately Revoke Per-Document Read/Edit Access', ok: true },
          { text: 'Trigger Retry Scan on Pending / ScanFailed Uploads', ok: true },
          { text: 'No Access to Global User Administration or Role Changes', ok: false }
        ]
      },
      {
        employeeId: 'TV-EMP-0219',
        fullName: 'Priya Nair',
        initials: 'PN',
        jobTitle: 'Senior Financial Controller & Contract Reviewer',
        department: 'Corporate Finance & FP&A',
        clearanceLevel: 'Level 3 — Collaborative Co-Author & Version Editor',
        location: 'Hyderabad Financial Center · Suite 900',
        phone: '+91 40 7100 3319 (Ext. 319)',
        role: 'Editor (Shared Edit)',
        badge: 'COLLABORATIVE EDITOR · FP&A',
        color: '#b45309',
        email: 'editor@trustvault.local',
        password: 'Corporate-Editor-2026!',
        bio: 'Collaborates on cross-departmental contracts and quarterly financial models with explicit Edit permissions. Authorized to update metadata, upload new file versions (v2+), and trigger Retry Scan.',
        workspaceFocus: 'Co-Authoring Shared Contracts, Uploading Replacement Versions (v2+) & Resolving Retry Scan on Shared Forecasts.',
        capabilities: [
          { text: 'Edit Metadata on Explicitly Shared Edit Documents', ok: true },
          { text: 'Upload New File Versions (v2+) to Shared Documents', ok: true },
          { text: 'Trigger Retry Scan on Shared Q4 Financial Forecast', ok: true },
          { text: 'Cannot Upload Brand-New Unshared Documents (403)', ok: false },
          { text: 'Cannot Delete or Re-Share Vivek’s Owned Documents (404)', ok: false }
        ]
      },
      {
        employeeId: 'TV-EXT-0408',
        fullName: 'Arjun Mehta',
        initials: 'AM',
        jobTitle: 'Lead Statutory & ISO Compliance Auditor',
        department: 'External Audit & Assurance Liaison',
        clearanceLevel: 'Level 2 — Strict Read-Only Evidence Inspection',
        location: 'New Delhi · Cyber City Assurance Desk',
        phone: '+91 11 4500 8808 (Ext. 408)',
        role: 'Viewer (Read-Only)',
        badge: 'READ-ONLY AUDITOR · EXTERNAL',
        color: '#0d9488',
        email: 'viewer@trustvault.local',
        password: 'Corporate-Viewer-2026!',
        bio: 'External compliance reviewer with strictly scoped Read-Only access to shared audit evidence. Prohibited from uploading, editing, deleting, or re-sharing any workspace files.',
        workspaceFocus: 'Strict Read-Only Evidence Inspection, SHA-256 Checksum Verification & Authorized Compliance Downloads.',
        capabilities: [
          { text: 'Preview & Verify SHA-256 Checksums on Shared Clean Docs', ok: true },
          { text: 'Download Explicitly Authorized Clean Audit Evidence', ok: true },
          { text: 'Cannot Edit Metadata or Upload Versions on Shared Docs (404)', ok: false },
          { text: 'Cannot Upload Any Files to Workspace (403 Forbidden)', ok: false },
          { text: 'Cannot View Unshared Private M&A or Quarantined Files (404)', ok: false }
        ]
      }
    ];

    const state = {
      user: null,
      documents: [],
      trash: [],
      folders: [],
      audits: [],
      notifications: [],
      users: [],
      adminStats: null,
      auditVerification: null,
      section: 'dashboard',
      search: '',
      categoryFilter: '',
      statusFilter: '',
      folderFilter: '',
      auditFilter: '',
      banner: null,
      loginEmail: 'admin@example.local',
      loginPassword: 'ChangeThis-Admin-Password-2026!',
      showPassword: false,
      loginError: '',
      busy: false,
      modal: null,
      activeDoc: null,
      previewData: null,
      docPermissions: []
    };

    function escapeHtml(s) {
      return String(s ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
    }

    function formatBytes(bytes) {
      const b = Number(bytes || 0);
      if (b < 1024) return b + ' B';
      if (b < 1024 * 1024) return (b / 1024).toFixed(1) + ' KB';
      return (b / (1024 * 1024)).toFixed(2) + ' MB';
    }

    function formatDate(iso, withTime = false) {
      if (!iso) return '—';
      const d = new Date(iso);
      return withTime
        ? d.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
        : d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
    }

    function getPersonaMeta(email) {
      return DEMO_PROFILES.find(p => p.email === email) || {
        employeeId: state.user?.employeeId || 'TV-EMP-0500',
        fullName: state.user?.fullName || email,
        initials: (state.user?.fullName || email || 'U').slice(0, 2).toUpperCase(),
        jobTitle: state.user?.jobTitle || 'Corporate Member',
        department: state.user?.department || 'Enterprise',
        clearanceLevel: state.user?.clearanceLevel || 'Level 2 — Standard',
        location: state.user?.location || 'Corporate HQ',
        phone: state.user?.phone || '—',
        role: state.user?.role || 'Viewer',
        badge: (state.user?.profileBadge || state.user?.role || 'MEMBER').toUpperCase(),
        color: state.user?.avatarColor || '#122b49',
        bio: state.user?.bio || 'Authenticated corporate workspace account.',
        workspaceFocus: 'Role-scoped document access and audited workspace operations.',
        capabilities: (state.user?.capabilities || []).map(c => ({ text: c.name, ok: c.allowed }))
      };
    }

    function setBanner(type, text) {
      state.banner = { type, text };
      render();
    }

    async function apiFetch(url, options = {}) {
      const token = sessionStorage.getItem('trustvault_token');
      const headers = new Headers(options.headers || {});
      if (token) headers.set('Authorization', 'Bearer ' + token);
      if (options.body && !(options.body instanceof FormData) && !headers.has('Content-Type')) {
        headers.set('Content-Type', 'application/json');
      }
      const res = await fetch('/api' + url, { ...options, headers });
      if (!res.ok) {
        let err = {};
        try { err = await res.json(); } catch {}
        const e = new Error(err.message || 'Operation denied (HTTP ' + res.status + ')');
        e.status = res.status;
        e.error = err;
        throw e;
      }
      if (res.status === 204) return null;
      const ct = res.headers.get('content-type') || '';
      if (ct.includes('application/json')) return res.json();
      return res.blob();
    }

    async function quickSwitchAccount(email, password) {
      try {
        const result = await apiFetch('/auth/login', {
          method: 'POST',
          body: JSON.stringify({ email, password })
        });
        sessionStorage.setItem('trustvault_token', result.accessToken);
        sessionStorage.setItem('trustvault_user', JSON.stringify(result.user));
        state.user = result.user;
        state.modal = null;
        if (state.section === 'admin' && state.user.role !== 'Admin') {
          state.section = 'dashboard';
        }
        setBanner('info', \`Switched active corporate profile to \${result.user.fullName} (\${result.user.employeeId} · \${result.user.jobTitle}).\`);
        await refreshWorkspaceData();
      } catch (e) {
        setBanner('error', e.message || 'Could not switch profile.');
      }
    }

    async function refreshWorkspaceData() {
      try {
        const [me, docs, folders, notifs] = await Promise.all([
          apiFetch('/users/me'),
          apiFetch('/documents'),
          apiFetch('/folders'),
          apiFetch('/notifications')
        ]);
        state.user = me;
        sessionStorage.setItem('trustvault_user', JSON.stringify(me));
        state.documents = docs;
        state.folders = folders;
        state.notifications = notifs;
        if (state.section === 'audit') {
          state.audits = await apiFetch('/audit');
        }
        if (state.section === 'trash') {
          state.trash = await apiFetch('/documents/trash');
        }
        if (state.section === 'admin' && state.user?.role === 'Admin') {
          const [users, stats] = await Promise.all([
            apiFetch('/admin/users'),
            apiFetch('/admin/stats')
          ]);
          state.users = users;
          state.adminStats = stats;
        }
        render();
      } catch (e) {
        if (e.status === 401) {
          sessionStorage.clear();
          initRoute();
        }
      }
    }

    function navigate(path) {
      history.pushState({}, '', path);
      initRoute();
    }

    function initRoute() {
      const token = sessionStorage.getItem('trustvault_token');
      const rawUser = sessionStorage.getItem('trustvault_user');
      if (!token || !rawUser) {
        if (location.pathname !== '/login') history.replaceState({}, '', '/login');
        renderLogin();
        return;
      }
      state.user = JSON.parse(rawUser);
      if (location.pathname === '/login') history.replaceState({}, '', '/');
      render();
      refreshWorkspaceData();
    }

    function render() {
      if (!sessionStorage.getItem('trustvault_token')) {
        renderLogin();
      } else {
        renderWorkspace();
      }
    }

    function renderLogin() {
      const app = document.getElementById('app');
      app.innerHTML = \`
        <div class="login-bg">
          <section class="login-card">
            <div class="login-brand">
              <div class="brand-mark">T</div>
              <div>
                <p class="eyebrow">ZERO-TRUST DOCUMENT PLATFORM</p>
                <h1>TrustVault Corporate</h1>
              </div>
            </div>
            <p class="muted">Sign in with your corporate credentials or select one of the 4 unique corporate personas below.</p>
            <form id="loginForm">
              <label>Corporate Email Address</label>
              <input id="loginEmail" type="email" value="\${escapeHtml(state.loginEmail)}" required autocomplete="username">
              <label>Security Password</label>
              <div class="pwd-wrap">
                <input id="loginPassword" type="\${state.showPassword ? 'text' : 'password'}" value="\${escapeHtml(state.loginPassword)}" required autocomplete="current-password">
                <button type="button" class="pwd-toggle" id="togglePwdBtn">\${state.showPassword ? 'Hide' : 'Show'}</button>
              </div>
              \${state.loginError ? \`<p class="error">\${escapeHtml(state.loginError)}</p>\` : ''}
              <button class="primary full" type="submit" \${state.busy ? 'disabled' : ''}>\${state.busy ? 'Authenticating session…' : 'Sign in securely'}</button>
            </form>

            <div class="persona-btn-section">
              <p class="persona-btn-title">
                <span>INSTANT DEMO ROLE LOGIN — 4 UNIQUE CORPORATE PERSONAS</span>
              </p>
              <div class="persona-btn-grid">
                \${DEMO_PROFILES.map(p => \`
                  <button type="button" class="persona-login-btn" data-launch-email="\${escapeHtml(p.email)}" data-launch-pwd="\${escapeHtml(p.password)}" title="\${escapeHtml(p.fullName)} (\${escapeHtml(p.employeeId)}) — \${escapeHtml(p.jobTitle)} · \${escapeHtml(p.clearanceLevel)}">
                    <span class="persona-btn-avatar" style="background:\${escapeHtml(p.color)}">\${escapeHtml(p.initials)}</span>
                    <span class="persona-btn-info">
                      <span class="persona-btn-name">\${escapeHtml(p.fullName)}</span>
                      <span class="persona-btn-role">\${escapeHtml(p.badge)}</span>
                      <span class="persona-btn-meta">\${escapeHtml(p.employeeId)} · \${escapeHtml(p.department)}</span>
                    </span>
                  </button>
                \`).join('')}
              </div>
            </div>

            <p class="fine">
              Every profile enforces independent server-side JWT claims, per-document Read/Edit grants, ClamAV inspection &amp; HMAC-SHA256 audit logging.
            </p>
          </section>
        </div>
      \`;

      document.getElementById('togglePwdBtn')?.addEventListener('click', () => {
        state.loginEmail = document.getElementById('loginEmail').value;
        state.loginPassword = document.getElementById('loginPassword').value;
        state.showPassword = !state.showPassword;
        renderLogin();
      });

      document.querySelectorAll('[data-launch-email]').forEach(btn => {
        btn.addEventListener('click', () => {
          state.loginEmail = btn.getAttribute('data-launch-email');
          state.loginPassword = btn.getAttribute('data-launch-pwd');
          state.loginError = '';
          renderLogin();
          document.getElementById('loginForm').requestSubmit();
        });
      });

      document.getElementById('loginForm')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        state.loginEmail = document.getElementById('loginEmail').value;
        state.loginPassword = document.getElementById('loginPassword').value;
        state.loginError = '';
        state.busy = true;
        renderLogin();
        try {
          const result = await apiFetch('/auth/login', {
            method: 'POST',
            body: JSON.stringify({ email: state.loginEmail, password: state.loginPassword })
          });
          sessionStorage.setItem('trustvault_token', result.accessToken);
          sessionStorage.setItem('trustvault_user', JSON.stringify(result.user));
          state.busy = false;
          navigate('/');
        } catch (err) {
          state.loginError = err.message || 'Sign-in failed. Check your credentials or account status.';
          state.busy = false;
          renderLogin();
        }
      });
    }

    function renderDocRow(d) {
      const ext = (d.name.split('.').pop() || 'DOC').toUpperCase().slice(0, 4);
      const pillClass = d.status === 'Clean' ? 'clean' : d.status === 'Rejected' ? 'rejected' : 'pending';
      return \`
        <tr>
          <td>
            <div class="doc-name-cell">
              <div class="file-icon">\${escapeHtml(ext)}</div>
              <div>
                <strong>\${escapeHtml(d.name)}</strong> <code>v\${d.currentVersion || 1}</code>
                <div class="doc-sub">\${escapeHtml(formatBytes(d.size))} \${d.folderName ? '· 📁 ' + escapeHtml(d.folderName) : ''} \${d.description ? '· ' + escapeHtml(d.description) : ''}</div>
                \${d.status !== 'Clean' && d.scanFailureReason ? \`<div class="doc-reason \${d.status === 'Rejected' ? 'rejected' : ''}">⚠ \${escapeHtml(d.scanFailureReason)}</div>\` : ''}
              </div>
            </div>
          </td>
          <td>
            <strong>\${escapeHtml(d.ownerName || d.ownerEmail)}</strong>
            <div class="doc-sub">\${escapeHtml(d.ownerEmail)}</div>
          </td>
          <td>\${escapeHtml(d.category || 'General')}</td>
          <td><span class="access-pill \${escapeHtml(d.accessLevel)}">\${escapeHtml(d.accessLevel)}</span></td>
          <td><span class="pill \${pillClass}">\${escapeHtml(d.status)}</span></td>
          <td>\${escapeHtml(formatDate(d.updatedAt || d.createdAt))}</td>
          <td>
            <div class="action-row">
              <button class="act-btn" data-preview="\${escapeHtml(d.id)}" \${d.status !== 'Clean' ? 'disabled title="Document must be Clean to preview"' : ''}>Preview</button>
              <button class="act-btn" data-download="\${escapeHtml(d.id)}" data-name="\${escapeHtml(d.name)}" \${d.status !== 'Clean' ? 'disabled title="Document must be Clean to download"' : ''}>Download</button>
              \${(d.accessLevel === 'Owner' || d.accessLevel === 'Edit') ? \`<button class="act-btn" data-edit="\${escapeHtml(d.id)}" \${d.status !== 'Clean' ? 'disabled title="Resolve scan status before editing"' : ''}>Edit / Version</button>\` : ''}
              \${(d.status === 'ScanFailed' || d.status === 'Pending') ? \`<button class="act-btn retry" data-retry="\${escapeHtml(d.id)}">⟳ Retry Scan</button>\` : ''}
              \${d.isOwner ? \`<button class="act-btn" data-share="\${escapeHtml(d.id)}">Share</button>\` : ''}
              \${d.isOwner ? \`<button class="act-btn danger" data-delete="\${escapeHtml(d.id)}" data-name="\${escapeHtml(d.name)}">Delete</button>\` : ''}
            </div>
          </td>
        </tr>
      \`;
    }

    function renderModal() {
      if (!state.modal) return '';
      if (state.modal === 'upload') {
        return \`
          <div class="modal-backdrop" id="modalBackdrop">
            <div class="modal">
              <div class="modal-header">
                <h3>Upload & Scan Corporate Document</h3>
                <button class="modal-close" id="closeModalBtn">×</button>
              </div>
              <form id="uploadModalForm">
                <div class="modal-body">
                  <div class="field-group">
                    <label>Select File (.pdf, .docx, .xlsx, .png, .jpg, .txt — max 20 MB)</label>
                    <input type="file" id="upFile" required>
                  </div>
                  <div class="form-grid">
                    <div class="field-group">
                      <label>Category</label>
                      <select id="upCategory">
                        <option value="General">General</option>
                        <option value="Legal">Legal</option>
                        <option value="Finance">Finance</option>
                        <option value="Security">Security</option>
                        <option value="HR">HR</option>
                        <option value="Engineering">Engineering</option>
                      </select>
                    </div>
                    <div class="field-group">
                      <label>Folder (Optional)</label>
                      <select id="upFolder">
                        <option value="">— No folder —</option>
                        \${state.folders.map(f => \`<option value="\${escapeHtml(f.id)}">\${escapeHtml(f.name)}</option>\`).join('')}
                      </select>
                    </div>
                  </div>
                  <div class="field-group">
                    <label>Description</label>
                    <input type="text" id="upDesc" placeholder="Executive summary or classification note">
                  </div>
                  <div class="field-group">
                    <label>Tags (comma-separated)</label>
                    <input type="text" id="upTags" placeholder="confidential, q4, board">
                  </div>
                  <div style="padding-top:8px;border-top:1px solid #e2e8f0;display:flex;gap:8px;flex-wrap:wrap">
                    <button type="button" class="secondary" id="quickCleanDemoBtn">⚡ Instant Upload: Sample Clean PDF</button>
                    <button type="button" class="danger-btn" id="quickEicarDemoBtn">🛡 Test Quarantine: Upload EICAR Signature</button>
                  </div>
                </div>
                <div class="modal-footer">
                  <button type="button" class="secondary" id="cancelModalBtn">Cancel</button>
                  <button type="submit" class="primary">Upload & Run Malware Scan</button>
                </div>
              </form>
            </div>
          </div>
        \`;
      }

      if (state.modal === 'preview' && state.previewData) {
        const p = state.previewData;
        return \`
          <div class="modal-backdrop" id="modalBackdrop">
            <div class="modal">
              <div class="modal-header">
                <h3>Document Preview & Security Telemetry</h3>
                <button class="modal-close" id="closeModalBtn">×</button>
              </div>
              <div class="modal-body">
                <div class="meta-grid">
                  <div><strong>Name:</strong> \${escapeHtml(p.name)} (v\${p.currentVersion})</div>
                  <div><strong>Custodian:</strong> \${escapeHtml(p.ownerName || p.ownerEmail)}</div>
                  <div><strong>Your Access:</strong> <span class="access-pill \${escapeHtml(p.accessLevel)}">\${escapeHtml(p.accessLevel)}</span></div>
                  <div><strong>Scan Status:</strong> <span class="pill clean">\${escapeHtml(p.status)}</span></div>
                  <div style="grid-column:1/-1"><strong>SHA-256 Checksum:</strong> <code>\${escapeHtml(p.sha256Hash)}</code></div>
                </div>
                <h4 style="margin:16px 0 6px;font-size:13px">Content Preview</h4>
                <div class="preview-box">\${escapeHtml(p.textPreview || 'Binary document stream verified clean.')}</div>
                <h4 style="margin:14px 0 6px;font-size:13px">Version History (\${(p.versions || []).length})</h4>
                <table>
                  <thead><tr><th>VER</th><th>SIZE</th><th>AUTHOR</th><th>NOTE</th><th>DATE</th></tr></thead>
                  <tbody>
                    \${(p.versions || []).map(v => \`
                      <tr>
                        <td><strong>v\${v.versionNumber}</strong></td>
                        <td>\${escapeHtml(formatBytes(v.size))}</td>
                        <td>\${escapeHtml(v.uploadedByName || v.uploadedByEmail || 'Custodian')}</td>
                        <td>\${escapeHtml(v.changeNote)}</td>
                        <td>\${escapeHtml(formatDate(v.createdAt, true))}</td>
                      </tr>
                    \`).join('')}
                  </tbody>
                </table>
              </div>
              <div class="modal-footer">
                <button type="button" class="secondary" id="cancelModalBtn">Close</button>
              </div>
            </div>
          </div>
        \`;
      }

      if (state.modal === 'edit' && state.activeDoc) {
        const d = state.activeDoc;
        return \`
          <div class="modal-backdrop" id="modalBackdrop">
            <div class="modal">
              <div class="modal-header">
                <h3>Edit Document (\${escapeHtml(d.accessLevel)} Permission)</h3>
                <button class="modal-close" id="closeModalBtn">×</button>
              </div>
              <form id="editDocForm">
                <div class="modal-body">
                  <div class="field-group">
                    <label>Document Name</label>
                    <input type="text" id="editName" value="\${escapeHtml(d.name)}" required>
                  </div>
                  <div class="form-grid">
                    <div class="field-group">
                      <label>Category</label>
                      <input type="text" id="editCategory" value="\${escapeHtml(d.category || 'General')}">
                    </div>
                    <div class="field-group">
                      <label>Folder</label>
                      <select id="editFolder">
                        <option value="">— No folder —</option>
                        \${state.folders.map(f => \`<option value="\${escapeHtml(f.id)}" \${d.folderId === f.id ? 'selected' : ''}>\${escapeHtml(f.name)}</option>\`).join('')}
                      </select>
                    </div>
                  </div>
                  <div class="field-group">
                    <label>Description</label>
                    <input type="text" id="editDesc" value="\${escapeHtml(d.description || '')}">
                  </div>
                  <div class="field-group">
                    <label>Tags</label>
                    <input type="text" id="editTags" value="\${escapeHtml(d.tags || '')}">
                  </div>
                  <hr style="border:0;border-top:1px solid #e2e8f0;margin:16px 0">
                  <div class="field-group">
                    <label>Upload New File Version (Optional — increments to v\${(d.currentVersion || 1) + 1})</label>
                    <input type="file" id="editVersionFile">
                  </div>
                  <div class="field-group">
                    <label>Version Change Note</label>
                    <input type="text" id="editChangeNote" placeholder="e.g. Updated Q4 financial schedules after review">
                  </div>
                </div>
                <div class="modal-footer">
                  <button type="button" class="secondary" id="cancelModalBtn">Cancel</button>
                  <button type="submit" class="primary">Save Changes</button>
                </div>
              </form>
            </div>
          </div>
        \`;
      }

      if (state.modal === 'share' && state.activeDoc) {
        const d = state.activeDoc;
        return \`
          <div class="modal-backdrop" id="modalBackdrop">
            <div class="modal">
              <div class="modal-header">
                <h3>Share & Access Control — \${escapeHtml(d.name)}</h3>
                <button class="modal-close" id="closeModalBtn">×</button>
              </div>
              <div class="modal-body">
                <form id="grantPermForm" style="margin-bottom:20px">
                  <div class="form-grid">
                    <div class="field-group">
                      <label>Recipient Corporate Email</label>
                      <input type="email" id="shareEmail" list="knownUsersList" placeholder="editor@trustvault.local" required>
                      <datalist id="knownUsersList">
                        <option value="editor@trustvault.local">Priya Nair — Senior Financial Controller (FP&A)</option>
                        <option value="viewer@trustvault.local">Arjun Mehta — Lead Statutory Auditor (External)</option>
                        <option value="owner@trustvault.local">Vivek Sharma — VP Legal & Operations</option>
                      </datalist>
                    </div>
                    <div class="field-group">
                      <label>Permission Level</label>
                      <select id="shareAccess">
                        <option value="Read">Read-Only (Preview & Download)</option>
                        <option value="Edit">Edit (Read + Modify Metadata & Versions)</option>
                      </select>
                    </div>
                  </div>
                  <button type="submit" class="primary">Grant Access</button>
                </form>

                <h4 style="margin:0 0 8px;font-size:13px">Active Document Grants (\${state.docPermissions.length})</h4>
                <table>
                  <thead><tr><th>RECIPIENT</th><th>ROLE / DEPT</th><th>ACCESS LEVEL</th><th>ACTION</th></tr></thead>
                  <tbody>
                    \${state.docPermissions.length === 0 ? \`<tr><td colspan="4" class="empty">No external permissions granted. Only Custodian has access.</td></tr>\` :
                      state.docPermissions.map(p => \`
                        <tr>
                          <td><strong>\${escapeHtml(p.fullName || p.email)}</strong><div class="doc-sub">\${escapeHtml(p.email)}</div></td>
                          <td>\${escapeHtml(p.jobTitle || '')} · \${escapeHtml(p.department || '')}</td>
                          <td><span class="access-pill \${escapeHtml(p.access)}">\${escapeHtml(p.access)}</span></td>
                          <td><button type="button" class="act-btn danger" data-revoke-user="\${escapeHtml(p.id)}">Revoke Immediately</button></td>
                        </tr>
                      \`).join('')}
                  </tbody>
                </table>
              </div>
              <div class="modal-footer">
                <button type="button" class="secondary" id="cancelModalBtn">Done</button>
              </div>
            </div>
          </div>
        \`;
      }
      return '';
    }

    function renderWorkspace() {
      const app = document.getElementById('app');
      const persona = getPersonaMeta(state.user?.email);
      const isAdmin = state.user?.role === 'Admin';
      const canUpload = state.user?.role === 'Owner' || state.user?.role === 'Admin';
      const cleanCount = state.documents.filter(d => d.status === 'Clean').length;
      const ownedDocs = state.documents.filter(d => d.isOwner);
      const sharedDocs = state.documents.filter(d => !d.isOwner);
      const editGrantedDocs = sharedDocs.filter(d => d.accessLevel === 'Edit');
      const unreadCount = state.notifications.filter(n => !n.isRead).length;

      const baseDocs = state.section === 'shared' ? sharedDocs : state.documents;
      const q = state.search.toLowerCase();
      const filteredDocs = baseDocs.filter(d => {
        if (state.categoryFilter && d.category !== state.categoryFilter) return false;
        if (state.statusFilter && d.status !== state.statusFilter) return false;
        if (state.folderFilter && d.folderId !== state.folderFilter) return false;
        return \`\${d.name} \${d.ownerEmail} \${d.ownerName || ''} \${d.category} \${d.tags || ''} \${d.description || ''}\`.toLowerCase().includes(q);
      });

      const sectionTitles = {
        dashboard: \`\${persona.fullName} — Personalized Role Workspace\`,
        documents: 'Corporate Document Repository',
        shared: 'Documents Shared With Me',
        folders: 'Folders & Taxonomy',
        trash: 'Trash & Recovery',
        audit: 'Hash-Chained Audit Log',
        notifications: 'Security & Sharing Alerts',
        profile: \`Employee Security Dossier (\${persona.employeeId})\`,
        admin: 'Enterprise Administration & Governance'
      };

      app.innerHTML = \`
        <div class="app-shell">
          <aside class="sidebar">
            <div class="brand">
              <span class="brand-icon" style="background:\${escapeHtml(persona.color)}">T</span>
              <span>TrustVault<small>ENTERPRISE SECURITY</small></span>
            </div>

            <div class="sidebar-id-card" style="border-left:4px solid \${escapeHtml(persona.color)}">
              <strong>\${escapeHtml(persona.fullName)}</strong>
              <span class="sid-role">\${escapeHtml(persona.badge)}</span>
              <div class="sid-meta">
                ID: \${escapeHtml(persona.employeeId)}<br>
                \${escapeHtml(persona.jobTitle)}<br>
                \${escapeHtml(persona.department)}
              </div>
            </div>

            <div class="nav-label">WORKSPACE</div>
            <button class="nav \${state.section === 'dashboard' ? 'active' : ''}" data-nav="dashboard"><span class="nav-left">⊞ <span>Role Dashboard</span></span></button>
            <button class="nav \${state.section === 'documents' ? 'active' : ''}" data-nav="documents"><span class="nav-left">▤ <span>All Accessible</span></span><span>\${state.documents.length}</span></button>
            <button class="nav \${state.section === 'shared' ? 'active' : ''}" data-nav="shared"><span class="nav-left">⇄ <span>Shared With Me</span></span><span>\${sharedDocs.length}</span></button>
            <button class="nav \${state.section === 'folders' ? 'active' : ''}" data-nav="folders"><span class="nav-left">❐ <span>Folders & Categories</span></span></button>
            <button class="nav \${state.section === 'trash' ? 'active' : ''}" data-nav="trash"><span class="nav-left">🗑 <span>Trash & Restore</span></span></button>
            <button class="nav \${state.section === 'audit' ? 'active' : ''}" data-nav="audit"><span class="nav-left">◷ <span>Audit Activity</span></span></button>
            <button class="nav \${state.section === 'notifications' ? 'active' : ''}" data-nav="notifications">
              <span class="nav-left">🔔 <span>Notifications</span></span>
              \${unreadCount > 0 ? \`<span class="nav-badge">\${unreadCount}</span>\` : ''}
            </button>
            <button class="nav \${state.section === 'profile' ? 'active' : ''}" data-nav="profile"><span class="nav-left">🪪 <span>Profile Dossier</span></span></button>

            \${isAdmin ? \`
              <div class="nav-label">GOVERNANCE</div>
              <button class="nav \${state.section === 'admin' ? 'active' : ''}" data-nav="admin"><span class="nav-left">🛡 <span>Admin & Monitoring</span></span></button>
            \` : ''}

            <div class="sidebar-bottom"><span class="status-dot"></span> \${escapeHtml(persona.clearanceLevel.split('—')[0])}</div>
          </aside>

          <main class="main">
            <header class="topbar">
              <div><span class="crumb">TrustVault /</span> <strong>\${escapeHtml(sectionTitles[state.section] || 'Workspace')}</strong></div>
              <div class="topbar-right">
                <div class="role-switcher" title="Switch between the 4 separate corporate personas">
                  <span>Switch Persona:</span>
                  <select id="quickRoleSelect">
                    <option value="admin@example.local|ChangeThis-Admin-Password-2026!" \${state.user?.email === 'admin@example.local' ? 'selected' : ''}>1. Dr. Ananya Deshmukh — CISO (Admin)</option>
                    <option value="owner@trustvault.local|Corporate-Owner-2026!" \${state.user?.email === 'owner@trustvault.local' ? 'selected' : ''}>2. Vivek Sharma — VP Legal (Owner)</option>
                    <option value="editor@trustvault.local|Corporate-Editor-2026!" \${state.user?.email === 'editor@trustvault.local' ? 'selected' : ''}>3. Priya Nair — Controller (Editor)</option>
                    <option value="viewer@trustvault.local|Corporate-Viewer-2026!" \${state.user?.email === 'viewer@trustvault.local' ? 'selected' : ''}>4. Arjun Mehta — Auditor (Viewer)</option>
                  </select>
                </div>
                <div class="user-area">
                  <span class="avatar" style="background:\${escapeHtml(persona.color)}">\${escapeHtml(persona.initials)}</span>
                  <span>
                    <strong>\${escapeHtml(persona.fullName)} (\${escapeHtml(persona.employeeId)})</strong>
                    <small>\${escapeHtml(persona.jobTitle)} · \${escapeHtml(persona.location)}</small>
                  </span>
                  <button class="logout" id="logoutBtn">Sign out</button>
                </div>
              </div>
            </header>

            <section class="content">
              \${state.banner ? \`
                <div class="banner \${escapeHtml(state.banner.type)}">
                  <span>\${escapeHtml(state.banner.text)}</span>
                  <button style="border:0;background:transparent;cursor:pointer;font-weight:800" id="dismissBannerBtn">✕</button>
                </div>
              \` : ''}

              \${state.section === 'dashboard' ? \`
                <div class="persona-hero" style="background:linear-gradient(135deg, \${escapeHtml(persona.color)} 0%, #0f2540 100%)">
                  <div>
                    <div style="font-size:10.5px;font-weight:800;letter-spacing:1.4px;opacity:.85">\${escapeHtml(persona.badge)} · \${escapeHtml(persona.employeeId)}</div>
                    <h2>\${escapeHtml(persona.fullName)} — \${escapeHtml(persona.jobTitle)}</h2>
                    <p>\${escapeHtml(persona.bio)}</p>
                    <div class="persona-pills">
                      <span>🏢 \${escapeHtml(persona.department)}</span>
                      <span>📍 \${escapeHtml(persona.location)}</span>
                      <span>🔐 \${escapeHtml(persona.clearanceLevel)}</span>
                      <span>📞 \${escapeHtml(persona.phone)}</span>
                    </div>
                  </div>
                  <div class="persona-caps-box">
                    <strong>Active Server-Enforced Policy Matrix</strong>
                    <ul>
                      \${persona.capabilities.map(c => \`
                        <li>\${c.ok ? '✅' : '🚫'} \${escapeHtml(c.text)}</li>
                      \`).join('')}
                    </ul>
                  </div>
                </div>

                <div class="page-heading">
                  <div>
                    <p class="eyebrow">ROLE-SCOPED WORKSPACE FOCUS</p>
                    <h1>\${escapeHtml(persona.workspaceFocus.split(',')[0])}</h1>
                    <p class="muted">\${escapeHtml(persona.workspaceFocus)}</p>
                  </div>
                  <div class="heading-actions">
                    \${canUpload ? \`<button class="primary" id="openUploadBtn">＋ Upload Document</button>\` : ''}
                    \${!canUpload ? \`<button class="danger-btn" id="testForbiddenUploadBtn">🛡 Test Unauthorized Upload (Verify 403 Block)</button>\` : ''}
                    <button class="secondary" data-nav="profile">🪪 View Full Employee Dossier</button>
                  </div>
                </div>

                <div class="stats">
                  <article><span>Owned by \${escapeHtml(persona.fullName.split(' ')[0])}</span><strong>\${ownedDocs.length}</strong><small>Custodian documents</small></article>
                  <article><span>Shared Edit Grants</span><strong>\${editGrantedDocs.length}</strong><small>Co-author & version permissions</small></article>
                  <article><span>Shared Read-Only</span><strong>\${sharedDocs.length - editGrantedDocs.length}</strong><small>Inspection-only permissions</small></article>
                  <article><span>Verified Clean / Ready</span><strong>\${cleanCount} / \${state.documents.length}</strong><small>Passed ClamAV & signature check</small></article>
                </div>

                <div class="table-card">
                  <div class="table-title">
                    <strong>Documents Visible to \${escapeHtml(persona.fullName)} (\${escapeHtml(persona.employeeId)})</strong>
                    <span>Unshared private documents owned by other users are strictly hidden by server RBAC</span>
                  </div>
                  <div class="table-scroll">
                    <table>
                      <thead><tr><th>DOCUMENT</th><th>CUSTODIAN</th><th>CATEGORY</th><th>YOUR ACCESS</th><th>SCAN STATUS</th><th>UPDATED</th><th>ACTIONS</th></tr></thead>
                      <tbody>
                        \${state.documents.length === 0 ? \`<tr><td colspan="7" class="empty">No documents accessible to this profile.</td></tr>\` :
                          state.documents.map(renderDocRow).join('')}
                      </tbody>
                    </table>
                  </div>
                </div>
              \` : ''}

              \${(state.section === 'documents' || state.section === 'shared') ? \`
                <div class="page-heading">
                  <div>
                    <p class="eyebrow">\${state.section === 'shared' ? 'COLLABORATIVE ACCESS' : 'DOCUMENT REPOSITORY'}</p>
                    <h1>\${state.section === 'shared' ? 'Shared With ' + escapeHtml(persona.fullName) : 'Accessible Documents'}</h1>
                    <p class="muted">Scoped strictly to \${escapeHtml(persona.fullName)} (\${escapeHtml(persona.employeeId)} · \${escapeHtml(persona.jobTitle)}).</p>
                  </div>
                  <div class="heading-actions">
                    \${canUpload ? \`<button class="primary" id="openUploadBtn">＋ Upload Document</button>\` : ''}
                    <button class="secondary" id="refreshBtn">↻ Refresh</button>
                  </div>
                </div>

                <div class="toolbar">
                  <input class="search" id="searchInput" value="\${escapeHtml(state.search)}" placeholder="Search by filename, custodian, category, description or tag…">
                  <select class="select-filter" id="catFilter">
                    <option value="">All Categories</option>
                    <option value="General" \${state.categoryFilter === 'General' ? 'selected' : ''}>General</option>
                    <option value="Legal" \${state.categoryFilter === 'Legal' ? 'selected' : ''}>Legal</option>
                    <option value="Finance" \${state.categoryFilter === 'Finance' ? 'selected' : ''}>Finance</option>
                    <option value="Security" \${state.categoryFilter === 'Security' ? 'selected' : ''}>Security</option>
                  </select>
                  <select class="select-filter" id="statusFilter">
                    <option value="">All Scan States</option>
                    <option value="Clean" \${state.statusFilter === 'Clean' ? 'selected' : ''}>Clean (Verified)</option>
                    <option value="ScanFailed" \${state.statusFilter === 'ScanFailed' ? 'selected' : ''}>ScanFailed (Retry Needed)</option>
                    <option value="Rejected" \${state.statusFilter === 'Rejected' ? 'selected' : ''}>Rejected (Quarantined)</option>
                  </select>
                </div>

                <div class="table-card">
                  <div class="table-title">
                    <strong>\${state.section === 'shared' ? 'Shared Documents' : 'All Accessible Documents'}</strong>
                    <span>\${filteredDocs.length} matching records</span>
                  </div>
                  <div class="table-scroll">
                    <table>
                      <thead><tr><th>DOCUMENT</th><th>CUSTODIAN</th><th>CATEGORY</th><th>YOUR ACCESS</th><th>SCAN STATUS</th><th>UPDATED</th><th>ACTIONS</th></tr></thead>
                      <tbody>
                        \${filteredDocs.length === 0 ? \`<tr><td colspan="7" class="empty">No documents match your current filters.</td></tr>\` :
                          filteredDocs.map(renderDocRow).join('')}
                      </tbody>
                    </table>
                  </div>
                </div>
              \` : ''}

              \${state.section === 'folders' ? \`
                <div class="page-heading">
                  <div>
                    <p class="eyebrow">DOCUMENT ORGANIZATION</p>
                    <h1>Folders & Categories</h1>
                    <p class="muted">Corporate folder structure and document classification.</p>
                  </div>
                </div>
                <div class="table-card form-card">
                  <h3>Create New Folder</h3>
                  <form id="createFolderForm" class="form-grid">
                    <input type="text" id="newFolderName" placeholder="Folder name (e.g. Board Resolutions)" required>
                    <input type="text" id="newFolderDesc" placeholder="Description or department scope">
                    <button type="submit" class="primary">＋ Create Folder</button>
                  </form>
                </div>
                <div class="table-card">
                  <div class="table-title"><strong>Workspace Folders</strong><span>\${state.folders.length} folders</span></div>
                  <table>
                    <thead><tr><th>FOLDER NAME</th><th>DESCRIPTION</th><th>DOCUMENTS</th><th>CREATED</th><th>ACTION</th></tr></thead>
                    <tbody>
                      \${state.folders.length === 0 ? \`<tr><td colspan="5" class="empty">No folders visible to this profile.</td></tr>\` :
                        state.folders.map(f => \`
                          <tr>
                            <td><strong>📁 \${escapeHtml(f.name)}</strong></td>
                            <td>\${escapeHtml(f.description || '—')}</td>
                            <td><span class="pill clean">\${f.documentCount} files</span></td>
                            <td>\${escapeHtml(formatDate(f.createdAt))}</td>
                            <td>
                              <button class="act-btn" data-open-folder="\${escapeHtml(f.id)}">View Files</button>
                            </td>
                          </tr>
                        \`).join('')}
                    </tbody>
                  </table>
                </div>
              \` : ''}

              \${state.section === 'trash' ? \`
                <div class="page-heading">
                  <div>
                    <p class="eyebrow">RETENTION & RECOVERY</p>
                    <h1>Trash & Deleted Documents</h1>
                    <p class="muted">Restore soft-deleted documents owned by \${escapeHtml(persona.fullName)}.</p>
                  </div>
                </div>
                <div class="table-card">
                  <div class="table-title"><strong>Deleted Documents</strong><span>\${state.trash.length} items</span></div>
                  <table>
                    <thead><tr><th>DOCUMENT</th><th>CATEGORY</th><th>STATUS</th><th>DELETED AT</th><th>ACTION</th></tr></thead>
                    <tbody>
                      \${state.trash.length === 0 ? \`<tr><td colspan="5" class="empty">Trash is empty.</td></tr>\` :
                        state.trash.map(t => \`
                          <tr>
                            <td><strong>\${escapeHtml(t.name)}</strong></td>
                            <td>\${escapeHtml(t.category)}</td>
                            <td>\${escapeHtml(t.status)}</td>
                            <td>\${escapeHtml(formatDate(t.updatedAt, true))}</td>
                            <td><button class="act-btn retry" data-restore="\${escapeHtml(t.id)}">↺ Restore Document</button></td>
                          </tr>
                        \`).join('')}
                    </tbody>
                  </table>
                </div>
              \` : ''}

              \${state.section === 'audit' ? \`
                <div class="page-heading">
                  <div>
                    <p class="eyebrow">COMPLIANCE & FORENSICS</p>
                    <h1>Cryptographic Audit Trail</h1>
                    <p class="muted">Every upload, read, preview, download, edit, permission change, and access denial is HMAC-SHA256 hash-linked.</p>
                  </div>
                  <div class="heading-actions">
                    \${isAdmin ? \`<button class="primary" id="verifyChainBtn">✓ Verify HMAC Chain Integrity</button>\` : ''}
                    <button class="secondary" id="exportAuditCsvBtn">⬇ Export CSV</button>
                  </div>
                </div>

                \${state.auditVerification ? \`
                  <div class="banner \${state.auditVerification.isValid ? 'success' : 'error'}">
                    <span>
                      <strong>HMAC-SHA256 Chain Verification:</strong>
                      \${state.auditVerification.isValid
                        ? \`VALID — All \${state.auditVerification.totalRecords} audit records verified intact from GENESIS to checkpoint \${state.auditVerification.latestCheckpointHash.slice(0, 16)}…\`
                        : \`TAMPER DETECTED at record #\${state.auditVerification.firstInvalidId}\`}
                    </span>
                  </div>
                \` : ''}

                <div class="toolbar">
                  <input class="search" id="auditSearchInput" value="\${escapeHtml(state.auditFilter)}" placeholder="Filter audit trail by actor, action, document, result or reason…">
                </div>

                <div class="table-card">
                  <div class="table-title"><strong>Immutable Audit Events Visible to \${escapeHtml(persona.fullName)}</strong><span>\${state.audits.length} events loaded</span></div>
                  <div class="table-scroll">
                    <table>
                      <thead><tr><th>ID</th><th>TIME (UTC)</th><th>CORRELATION</th><th>ACTOR</th><th>ACTION</th><th>DOCUMENT</th><th>RESULT</th><th>REASON / DETAIL</th><th>HMAC ENTRY HASH</th></tr></thead>
                      <tbody>
                        \${state.audits
                          .filter(a => \`\${a.actorEmail} \${a.action} \${a.documentName} \${a.result} \${a.reason}\`.toLowerCase().includes(state.auditFilter.toLowerCase()))
                          .map(a => \`
                            <tr>
                              <td>#\${a.id}</td>
                              <td>\${escapeHtml(formatDate(a.createdAt, true))}</td>
                              <td><code>\${escapeHtml(a.correlationId || '—')}</code></td>
                              <td>\${escapeHtml(a.actorEmail || (a.actorId || '').slice(0, 8))}</td>
                              <td><strong>\${escapeHtml(a.action)}</strong></td>
                              <td>\${escapeHtml(a.documentName || (a.documentId ? a.documentId.slice(0, 8) : '—'))}</td>
                              <td><span class="pill \${a.result === 'Success' ? 'clean' : 'rejected'}">\${escapeHtml(a.result)}</span></td>
                              <td>\${escapeHtml(a.reason || '—')}</td>
                              <td><code title="Prev: \${escapeHtml(a.previousHash)}">\${escapeHtml((a.entryHash || '').slice(0, 14))}…</code></td>
                            </tr>
                          \`).join('')}
                      </tbody>
                    </table>
                  </div>
                </div>
              \` : ''}

              \${state.section === 'notifications' ? \`
                <div class="page-heading">
                  <div>
                    <p class="eyebrow">REAL-TIME ALERTS</p>
                    <h1>Notifications for \${escapeHtml(persona.fullName)}</h1>
                    <p class="muted">Sharing grants, permission revocations, and security alerts.</p>
                  </div>
                  <button class="secondary" id="markAllReadBtn">✓ Mark All Read</button>
                </div>
                <div class="table-card">
                  <table>
                    <thead><tr><th>TIME</th><th>ALERT</th><th>DETAILS</th><th>STATUS</th></tr></thead>
                    <tbody>
                      \${state.notifications.length === 0 ? \`<tr><td colspan="4" class="empty">No notifications for this profile.</td></tr>\` :
                        state.notifications.map(n => \`
                          <tr>
                            <td>\${escapeHtml(formatDate(n.createdAt, true))}</td>
                            <td><strong>\${escapeHtml(n.title)}</strong></td>
                            <td>\${escapeHtml(n.message)}</td>
                            <td><span class="pill \${n.isRead ? 'clean' : 'pending'}">\${n.isRead ? 'Read' : 'New'}</span></td>
                          </tr>
                        \`).join('')}
                    </tbody>
                  </table>
                </div>
              \` : ''}

              \${state.section === 'profile' ? \`
                <div class="persona-hero" style="background:linear-gradient(135deg, \${escapeHtml(persona.color)} 0%, #0f2540 100%)">
                  <div>
                    <div style="font-size:10.5px;font-weight:800;letter-spacing:1.4px;opacity:.85">OFFICIAL CORPORATE SECURITY DOSSIER</div>
                    <h2>\${escapeHtml(persona.fullName)} (\${escapeHtml(persona.employeeId)})</h2>
                    <p>\${escapeHtml(persona.bio)}</p>
                    <div class="persona-pills">
                      <span>🪪 \${escapeHtml(persona.badge)}</span>
                      <span>🏢 \${escapeHtml(persona.department)}</span>
                      <span>📍 \${escapeHtml(persona.location)}</span>
                      <span>📞 \${escapeHtml(persona.phone)}</span>
                    </div>
                  </div>
                  <div class="persona-caps-box">
                    <strong>Verified Role Capabilities</strong>
                    <ul>
                      \${persona.capabilities.map(c => \`
                        <li>\${c.ok ? '✅' : '🚫'} \${escapeHtml(c.text)}</li>
                      \`).join('')}
                    </ul>
                  </div>
                </div>

                <div class="table-card form-card">
                  <h3>Edit Corporate Dossier Details</h3>
                  <form id="profileForm" class="form-grid">
                    <div>
                      <label style="font-size:11px;font-weight:700;display:block;margin-bottom:4px">Full Name</label>
                      <input type="text" id="profName" value="\${escapeHtml(state.user?.fullName || persona.fullName)}" required>
                    </div>
                    <div>
                      <label style="font-size:11px;font-weight:700;display:block;margin-bottom:4px">Job Title</label>
                      <input type="text" id="profTitle" value="\${escapeHtml(state.user?.jobTitle || persona.jobTitle)}" required>
                    </div>
                    <div>
                      <label style="font-size:11px;font-weight:700;display:block;margin-bottom:4px">Department</label>
                      <input type="text" id="profDept" value="\${escapeHtml(state.user?.department || persona.department)}" required>
                    </div>
                    <div>
                      <label style="font-size:11px;font-weight:700;display:block;margin-bottom:4px">Office Location</label>
                      <input type="text" id="profLoc" value="\${escapeHtml(state.user?.location || persona.location)}" required>
                    </div>
                    <div>
                      <label style="font-size:11px;font-weight:700;display:block;margin-bottom:4px">Phone / Extension</label>
                      <input type="text" id="profPhone" value="\${escapeHtml(state.user?.phone || persona.phone)}">
                    </div>
                    <div style="display:flex;align-items:flex-end">
                      <button type="submit" class="primary" style="width:100%">Save Profile Dossier</button>
                    </div>
                  </form>
                </div>

                <div class="table-card form-card">
                  <h3>Rotate Security Password (14+ Characters Required)</h3>
                  <form id="changePwdForm" class="form-grid">
                    <input type="password" id="curPwd" placeholder="Current password" required>
                    <input type="password" id="newPwd" placeholder="New password (min 14 chars)" required>
                    <button type="submit" class="primary">Update Password</button>
                  </form>
                </div>
              \` : ''}

              \${state.section === 'admin' && isAdmin ? \`
                <div class="page-heading">
                  <div>
                    <p class="eyebrow">ENTERPRISE ADMINISTRATION</p>
                    <h1>User Governance & Security Monitoring</h1>
                    <p class="muted">Manage corporate personas, monitor denied access attempts, and verify audit log integrity.</p>
                  </div>
                  <button class="primary" id="verifyChainBtn">✓ Verify Audit HMAC Chain</button>
                </div>

                \${state.adminStats ? \`
                  <div class="stats">
                    <article><span>Corporate Accounts</span><strong>\${state.adminStats.activeUsers} / \${state.adminStats.totalUsers}</strong><small>Active workspace members</small></article>
                    <article><span>Verified Clean Docs</span><strong>\${state.adminStats.cleanDocuments}</strong><small>Out of \${state.adminStats.totalDocuments} total docs</small></article>
                    <article><span>Quarantined / Failed</span><strong>\${state.adminStats.quarantinedDocuments + state.adminStats.scanFailedDocuments}</strong><small>\${state.adminStats.quarantinedDocuments} rejected · \${state.adminStats.scanFailedDocuments} scan failed</small></article>
                    <article><span>Denied Security Events</span><strong>\${state.adminStats.deniedEventsCount}</strong><small>Chain: \${state.adminStats.auditChain?.isValid ? 'INTACT ✓' : 'ALERT'}</small></article>
                  </div>
                \` : ''}

                <div class="table-card form-card">
                  <h3>Provision New Corporate Member</h3>
                  <form id="createUserForm" class="form-grid">
                    <input type="email" id="newEmail" placeholder="Email (e.g. counsel@trustvault.local)" required>
                    <input type="text" id="newFullName" placeholder="Full Name" required>
                    <input type="text" id="newJobTitle" placeholder="Job Title (e.g. Legal Counsel)" required>
                    <input type="text" id="newDept" placeholder="Department (e.g. Legal)" required>
                    <input type="password" id="tempPassword" placeholder="Temp password (14+ chars)" required>
                    <select id="newRole">
                      <option value="Owner">Owner (Can Upload & Share)</option>
                      <option value="Viewer">Viewer (Read/Edit Shared Only)</option>
                    </select>
                    <button type="submit" class="primary">＋ Create Account</button>
                  </form>
                </div>

                <div class="table-card">
                  <div class="table-title"><strong>Corporate Directory</strong><span>\${state.users.length} detailed accounts</span></div>
                  <div class="table-scroll">
                    <table>
                      <thead><tr><th>EMP ID</th><th>PERSONA</th><th>JOB TITLE & DEPT</th><th>CLEARANCE</th><th>GLOBAL ROLE</th><th>STATUS</th><th>GOVERNANCE</th></tr></thead>
                      <tbody>
                        \${state.users.map(u => \`
                          <tr>
                            <td><code>\${escapeHtml(u.employeeId || 'TV-EMP')}</code></td>
                            <td><strong>\${escapeHtml(u.fullName || '—')}</strong><div class="doc-sub">\${escapeHtml(u.email)}</div></td>
                            <td><strong>\${escapeHtml(u.jobTitle || 'Member')}</strong><div class="doc-sub">\${escapeHtml(u.department || 'General')} · \${escapeHtml(u.location || '')}</div></td>
                            <td><span class="doc-sub">\${escapeHtml(u.clearanceLevel || '')}</span></td>
                            <td>
                              <select class="select-filter" style="padding:4px 8px;font-size:11px" data-role-user="\${escapeHtml(u.id)}" \${u.id === state.user?.id ? 'disabled' : ''}>
                                <option value="Admin" \${u.role === 'Admin' ? 'selected' : ''}>Admin</option>
                                <option value="Owner" \${u.role === 'Owner' ? 'selected' : ''}>Owner</option>
                                <option value="Viewer" \${u.role === 'Viewer' ? 'selected' : ''}>Viewer</option>
                              </select>
                            </td>
                            <td><span class="pill \${u.isActive ? 'clean' : 'rejected'}">\${u.isActive ? 'Active' : 'Deactivated'}</span></td>
                            <td>
                              \${u.id !== state.user?.id ? \`
                                <button class="act-btn \${u.isActive ? 'danger' : 'retry'}" data-toggle-user="\${escapeHtml(u.id)}" data-active="\${u.isActive}">
                                  \${u.isActive ? 'Deactivate' : 'Activate'}
                                </button>
                              \` : '<code>Current CISO</code>'}
                            </td>
                          </tr>
                        \`).join('')}
                      </tbody>
                    </table>
                  </div>
                </div>
              \` : ''}
            </section>
          </main>
        </div>
        \${renderModal()}
      \`;

      document.querySelectorAll('[data-nav]').forEach(btn => {
        btn.addEventListener('click', () => {
          state.section = btn.getAttribute('data-nav');
          state.banner = null;
          refreshWorkspaceData();
        });
      });

      document.getElementById('dismissBannerBtn')?.addEventListener('click', () => {
        state.banner = null;
        render();
      });

      document.getElementById('quickRoleSelect')?.addEventListener('change', (e) => {
        const [email, pwd] = e.target.value.split('|');
        quickSwitchAccount(email, pwd);
      });

      document.getElementById('logoutBtn')?.addEventListener('click', () => {
        sessionStorage.clear();
        navigate('/login');
      });

      document.getElementById('openUploadBtn')?.addEventListener('click', () => {
        state.modal = 'upload';
        render();
      });

      document.getElementById('testForbiddenUploadBtn')?.addEventListener('click', async () => {
        const fd = new FormData();
        fd.append('file', new Blob(['%PDF-1.4 test'], { type: 'application/pdf' }), 'Unauthorized_Attempt.pdf');
        try {
          await apiFetch('/documents', { method: 'POST', body: fd });
        } catch (err) {
          setBanner('error', \`Server Enforced RBAC Block (HTTP \${err.status}): \${err.message} — Denial recorded in HMAC Audit Trail.\`);
        }
      });

      document.getElementById('refreshBtn')?.addEventListener('click', () => refreshWorkspaceData());

      const searchEl = document.getElementById('searchInput');
      if (searchEl) {
        searchEl.addEventListener('input', (e) => {
          state.search = e.target.value;
          const pos = e.target.selectionStart;
          render();
          const next = document.getElementById('searchInput');
          if (next) { next.focus(); next.setSelectionRange(pos, pos); }
        });
      }
      document.getElementById('catFilter')?.addEventListener('change', e => { state.categoryFilter = e.target.value; render(); });
      document.getElementById('statusFilter')?.addEventListener('change', e => { state.statusFilter = e.target.value; render(); });

      const auditSearchEl = document.getElementById('auditSearchInput');
      if (auditSearchEl) {
        auditSearchEl.addEventListener('input', e => {
          state.auditFilter = e.target.value;
          const pos = e.target.selectionStart;
          render();
          const next = document.getElementById('auditSearchInput');
          if (next) { next.focus(); next.setSelectionRange(pos, pos); }
        });
      }

      document.querySelectorAll('[data-preview]').forEach(btn => {
        btn.addEventListener('click', async () => {
          const id = btn.getAttribute('data-preview');
          try {
            state.previewData = await apiFetch('/documents/' + id + '/preview');
            state.modal = 'preview';
            render();
          } catch (e) {
            setBanner('error', e.message || 'Preview denied.');
          }
        });
      });

      document.querySelectorAll('[data-download]').forEach(btn => {
        btn.addEventListener('click', async () => {
          const id = btn.getAttribute('data-download');
          const name = btn.getAttribute('data-name');
          try {
            const blob = await apiFetch('/documents/' + id + '/download');
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = name;
            a.click();
            URL.revokeObjectURL(url);
            setBanner('success', 'Downloaded ' + name + ' (logged in audit trail).');
          } catch (e) {
            setBanner('error', e.message || 'Download denied or document is not Clean.');
          }
        });
      });

      document.querySelectorAll('[data-retry]').forEach(btn => {
        btn.addEventListener('click', async () => {
          const id = btn.getAttribute('data-retry');
          try {
            const res = await apiFetch('/documents/' + id + '/retry-scan', { method: 'POST' });
            setBanner(
              res.status === 'Clean' ? 'success' : 'error',
              \`Retry Scan completed for '\${res.name}': status is now \${res.status} (\${res.scanFailureReason || 'OK'}).\`
            );
            await refreshWorkspaceData();
          } catch (e) {
            setBanner('error', e.message || 'Retry Scan failed.');
          }
        });
      });

      document.querySelectorAll('[data-edit]').forEach(btn => {
        btn.addEventListener('click', () => {
          const id = btn.getAttribute('data-edit');
          state.activeDoc = state.documents.find(x => x.id === id);
          if (state.activeDoc) {
            state.modal = 'edit';
            render();
          }
        });
      });

      document.querySelectorAll('[data-share]').forEach(btn => {
        btn.addEventListener('click', async () => {
          const id = btn.getAttribute('data-share');
          state.activeDoc = state.documents.find(x => x.id === id);
          if (state.activeDoc) {
            state.docPermissions = await apiFetch('/documents/' + id + '/permissions');
            state.modal = 'share';
            render();
          }
        });
      });

      document.querySelectorAll('[data-delete]').forEach(btn => {
        btn.addEventListener('click', async () => {
          const id = btn.getAttribute('data-delete');
          const name = btn.getAttribute('data-name');
          if (!confirm(\`Move '\${name}' to Trash?\`)) return;
          try {
            await apiFetch('/documents/' + id, { method: 'DELETE' });
            setBanner('info', \`Moved '\${name}' to Trash.\`);
            await refreshWorkspaceData();
          } catch (e) {
            setBanner('error', e.message || 'Delete failed.');
          }
        });
      });

      document.querySelectorAll('[data-restore]').forEach(btn => {
        btn.addEventListener('click', async () => {
          const id = btn.getAttribute('data-restore');
          try {
            await apiFetch('/documents/' + id + '/restore', { method: 'POST' });
            setBanner('success', 'Document restored to your library.');
            await refreshWorkspaceData();
          } catch (e) {
            setBanner('error', e.message);
          }
        });
      });

      document.getElementById('createFolderForm')?.addEventListener('submit', async e => {
        e.preventDefault();
        const name = document.getElementById('newFolderName').value;
        const description = document.getElementById('newFolderDesc').value;
        try {
          await apiFetch('/folders', { method: 'POST', body: JSON.stringify({ name, description }) });
          setBanner('success', \`Created folder '\${name}'.\`);
          await refreshWorkspaceData();
        } catch (err) {
          setBanner('error', err.message);
        }
      });

      document.querySelectorAll('[data-open-folder]').forEach(btn => {
        btn.addEventListener('click', () => {
          state.folderFilter = btn.getAttribute('data-open-folder');
          state.section = 'documents';
          render();
        });
      });

      document.getElementById('verifyChainBtn')?.addEventListener('click', async () => {
        try {
          state.auditVerification = await apiFetch('/admin/verify-audit-chain');
          setBanner('success', \`Cryptographic HMAC-SHA256 verification passed across all \${state.auditVerification.totalRecords} audit records.\`);
        } catch (e) {
          setBanner('error', e.message);
        }
      });

      document.getElementById('exportAuditCsvBtn')?.addEventListener('click', () => {
        const rows = [
          ['Id', 'CreatedAt', 'CorrelationId', 'ActorEmail', 'Action', 'DocumentName', 'Result', 'Reason', 'PreviousHash', 'EntryHash'],
          ...state.audits.map(a => [a.id, a.createdAt, a.correlationId, a.actorEmail, a.action, a.documentName || '', a.result, a.reason || '', a.previousHash, a.entryHash])
        ];
        const csv = rows.map(r => r.map(v => \`"\${String(v ?? '').replace(/"/g, '""')}"\`).join(',')).join('\\n');
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'trustvault-audit-log.csv';
        a.click();
        URL.revokeObjectURL(url);
      });

      document.getElementById('markAllReadBtn')?.addEventListener('click', async () => {
        await apiFetch('/notifications/read-all', { method: 'POST' });
        await refreshWorkspaceData();
      });

      document.getElementById('profileForm')?.addEventListener('submit', async e => {
        e.preventDefault();
        const fullName = document.getElementById('profName').value;
        const jobTitle = document.getElementById('profTitle').value;
        const department = document.getElementById('profDept').value;
        const location = document.getElementById('profLoc').value;
        const phone = document.getElementById('profPhone').value;
        const updated = await apiFetch('/users/me', {
          method: 'PUT',
          body: JSON.stringify({ fullName, jobTitle, department, location, phone })
        });
        state.user = updated;
        sessionStorage.setItem('trustvault_user', JSON.stringify(updated));
        setBanner('success', 'Corporate dossier updated.');
      });

      document.getElementById('changePwdForm')?.addEventListener('submit', async e => {
        e.preventDefault();
        const currentPassword = document.getElementById('curPwd').value;
        const newPassword = document.getElementById('newPwd').value;
        try {
          await apiFetch('/auth/change-password', { method: 'POST', body: JSON.stringify({ currentPassword, newPassword }) });
          setBanner('success', 'Password updated successfully.');
        } catch (err) {
          setBanner('error', err.message);
        }
      });

      document.getElementById('createUserForm')?.addEventListener('submit', async e => {
        e.preventDefault();
        const email = document.getElementById('newEmail').value;
        const fullName = document.getElementById('newFullName').value;
        const jobTitle = document.getElementById('newJobTitle').value;
        const department = document.getElementById('newDept').value;
        const temporaryPassword = document.getElementById('tempPassword').value;
        const role = document.getElementById('newRole').value;
        try {
          await apiFetch('/admin/users', {
            method: 'POST',
            body: JSON.stringify({ email, fullName, jobTitle, department, temporaryPassword, role })
          });
          setBanner('success', \`Provisioned corporate account for \${fullName} (\${email} · \${role}).\`);
          await refreshWorkspaceData();
        } catch (err) {
          setBanner('error', err.message);
        }
      });

      document.querySelectorAll('[data-toggle-user]').forEach(btn => {
        btn.addEventListener('click', async () => {
          const id = btn.getAttribute('data-toggle-user');
          const cur = btn.getAttribute('data-active') === 'true';
          await apiFetch('/admin/users/' + id + '/status', { method: 'PUT', body: JSON.stringify({ isActive: !cur }) });
          setBanner('info', 'Updated account status.');
          await refreshWorkspaceData();
        });
      });

      document.querySelectorAll('[data-role-user]').forEach(sel => {
        sel.addEventListener('change', async e => {
          const id = sel.getAttribute('data-role-user');
          await apiFetch('/admin/users/' + id + '/role', { method: 'PUT', body: JSON.stringify({ role: e.target.value }) });
          setBanner('info', 'Updated global role.');
          await refreshWorkspaceData();
        });
      });

      document.getElementById('closeModalBtn')?.addEventListener('click', () => { state.modal = null; render(); });
      document.getElementById('cancelModalBtn')?.addEventListener('click', () => { state.modal = null; render(); });

      document.getElementById('uploadModalForm')?.addEventListener('submit', async e => {
        e.preventDefault();
        const fileInput = document.getElementById('upFile');
        const file = fileInput.files?.[0];
        if (!file) return;
        const fd = new FormData();
        fd.append('file', file);
        fd.append('category', document.getElementById('upCategory').value);
        fd.append('folderId', document.getElementById('upFolder').value);
        fd.append('description', document.getElementById('upDesc').value);
        fd.append('tags', document.getElementById('upTags').value);
        try {
          const res = await apiFetch('/documents', { method: 'POST', body: fd });
          state.modal = null;
          setBanner(res.status === 'Clean' ? 'success' : 'error', \`Uploaded '\${res.name}' — Scan status: \${res.status} (\${res.scanFailureReason || 'Verified'}).\`);
          await refreshWorkspaceData();
        } catch (err) {
          setBanner('error', err.message);
        }
      });

      document.getElementById('quickCleanDemoBtn')?.addEventListener('click', async () => {
        const pdfBlob = new Blob(['%PDF-1.4\\n%Corporate Demo Document\\n1 0 obj << /Type /Catalog >> endobj\\n%%EOF'], { type: 'application/pdf' });
        const file = new File([pdfBlob], 'Board_Architecture_Review_' + Math.floor(Math.random() * 900 + 100) + '.pdf', { type: 'application/pdf' });
        const fd = new FormData();
        fd.append('file', file);
        fd.append('category', 'Engineering');
        fd.append('description', 'Auto-generated clean PDF sample');
        fd.append('tags', 'architecture,clean');
        const res = await apiFetch('/documents', { method: 'POST', body: fd });
        state.modal = null;
        setBanner('success', \`Uploaded clean PDF '\${res.name}' — Status: \${res.status}.\`);
        await refreshWorkspaceData();
      });

      document.getElementById('quickEicarDemoBtn')?.addEventListener('click', async () => {
        const eicar = 'X5O!P%@AP[4\\\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*';
        const file = new File([new Blob([eicar], { type: 'text/plain' })], 'Malicious_Test_EICAR.txt', { type: 'text/plain' });
        const fd = new FormData();
        fd.append('file', file);
        fd.append('category', 'Security');
        fd.append('description', 'EICAR antivirus signature test');
        const res = await apiFetch('/documents', { method: 'POST', body: fd });
        state.modal = null;
        setBanner('error', \`Quarantined '\${res.name}' — Status: \${res.status} (\${res.scanFailureReason}).\`);
        await refreshWorkspaceData();
      });

      document.getElementById('editDocForm')?.addEventListener('submit', async e => {
        e.preventDefault();
        const id = state.activeDoc.id;
        const name = document.getElementById('editName').value;
        const category = document.getElementById('editCategory').value;
        const folderId = document.getElementById('editFolder').value || null;
        const description = document.getElementById('editDesc').value;
        const tags = document.getElementById('editTags').value;
        const versionFile = document.getElementById('editVersionFile').files?.[0];
        const changeNote = document.getElementById('editChangeNote').value;
        try {
          await apiFetch('/documents/' + id, {
            method: 'PUT',
            body: JSON.stringify({ name, category, folderId, description, tags })
          });
          if (versionFile) {
            const fd = new FormData();
            fd.append('file', versionFile);
            fd.append('changeNote', changeNote || 'Updated version');
            await apiFetch('/documents/' + id + '/versions', { method: 'POST', body: fd });
          }
          state.modal = null;
          setBanner('success', \`Updated '\${name}' successfully.\`);
          await refreshWorkspaceData();
        } catch (err) {
          setBanner('error', err.message);
        }
      });

      document.getElementById('grantPermForm')?.addEventListener('submit', async e => {
        e.preventDefault();
        const id = state.activeDoc.id;
        const email = document.getElementById('shareEmail').value;
        const access = document.getElementById('shareAccess').value;
        try {
          await apiFetch('/documents/' + id + '/permissions', {
            method: 'POST',
            body: JSON.stringify({ email, access })
          });
          state.docPermissions = await apiFetch('/documents/' + id + '/permissions');
          setBanner('success', \`Granted \${access} permission on '\${state.activeDoc.name}' to \${email}.\`);
        } catch (err) {
          setBanner('error', err.message);
        }
      });

      document.querySelectorAll('[data-revoke-user]').forEach(btn => {
        btn.addEventListener('click', async () => {
          const userId = btn.getAttribute('data-revoke-user');
          const id = state.activeDoc.id;
          try {
            await apiFetch('/documents/' + id + '/permissions/' + userId, { method: 'DELETE' });
            state.docPermissions = await apiFetch('/documents/' + id + '/permissions');
            setBanner('info', 'Revoked permission immediately.');
          } catch (err) {
            setBanner('error', err.message);
          }
        });
      });
    }

    window.addEventListener('popstate', initRoute);
    initRoute();
  </script>
</body>
</html>`;

const frontendServer = http.createServer((req, res) => {
  if (req.url && (req.url.startsWith('/api/') || req.url.startsWith('/swagger'))) {
    const proxyReq = http.request(
      {
        hostname: '127.0.0.1',
        port: API_PORT,
        path: req.url,
        method: req.method,
        headers: req.headers
      },
      proxyRes => {
        res.writeHead(proxyRes.statusCode || 500, proxyRes.headers);
        proxyRes.pipe(res);
      }
    );
    proxyReq.on('error', () => {
      res.writeHead(502, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ message: 'Bad Gateway' }));
    });
    req.pipe(proxyReq);
    return;
  }

  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(spaHtml);
});

frontendServer.listen(FRONTEND_PORT, '0.0.0.0', () => {
  console.log(`TrustVault Corporate Frontend v3 listening on http://localhost:${FRONTEND_PORT}`);
});
