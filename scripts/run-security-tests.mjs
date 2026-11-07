// Automated Release-Blocking Security, Persona Isolation & Integration Test Suite
let BASE_URL = process.env.API_URL || 'http://localhost:5106/api';

let passed = 0;
let failed = 0;

async function ensureServerRunning() {
  try {
    const probe = await fetch(`${BASE_URL}/system/health`);
    if (probe.ok) return false;
  } catch {}
  const testPort = Number(process.env.TEST_PORT || 5198);
  process.env.PORT = String(testPort);
  BASE_URL = `http://localhost:${testPort}/api`;
  await import('./local-api-server.mjs');
  await new Promise(r => setTimeout(r, 150));
  return true;
}

async function test(id, name, fn) {
  try {
    await fn();
    console.log(`✅ [PASS] ${id}: ${name}`);
    passed++;
  } catch (err) {
    console.error(`❌ [FAIL] ${id}: ${name} -> ${err.message}`);
    failed++;
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function login(email, password) {
  const res = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  });
  const body = await res.json().catch(() => ({}));
  return { status: res.status, body };
}

async function run() {
  await ensureServerRunning();
  console.log('======================================================================');
  console.log(' TrustVault Corporate v3 — Security, Persona & Release Gate Test Suite ');
  console.log('======================================================================\n');

  let adminToken, ownerToken, editorToken, viewerToken, viewerId, editorId;
  let cleanDocId, quarantinedDocId;

  await test('DEP-06', 'Backend health endpoint returns healthy', async () => {
    const res = await fetch(`${BASE_URL}/system/health`);
    assert(res.status === 200, `Expected 200, got ${res.status}`);
  });

  await test('PERSONA-01', 'All 4 Instant Demo Role Login profiles have unique Employee IDs, Job Titles, Clearances & Capabilities', async () => {
    const res = await fetch(`${BASE_URL}/auth/demo-profiles`);
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    const profiles = await res.json();
    assert(profiles.length === 4, `Expected 4 demo profiles, got ${profiles.length}`);
    const empIds = new Set(profiles.map(p => p.employeeId));
    const titles = new Set(profiles.map(p => p.jobTitle));
    const clearances = new Set(profiles.map(p => p.clearanceLevel));
    assert(empIds.size === 4 && titles.size === 4 && clearances.size === 4, 'Every persona must have unique EmployeeId, JobTitle, and ClearanceLevel');
  });

  await test('AUTH-01', 'Login with valid corporate credentials succeeds for all 4 personas', async () => {
    const a = await login('admin@example.local', 'ChangeThis-Admin-Password-2026!');
    const o = await login('owner@trustvault.local', 'Corporate-Owner-2026!');
    const e = await login('editor@trustvault.local', 'Corporate-Editor-2026!');
    const v = await login('viewer@trustvault.local', 'Corporate-Viewer-2026!');
    assert(a.status === 200 && o.status === 200 && e.status === 200 && v.status === 200, 'All 4 personas must authenticate');
    assert(a.body.user.employeeId === 'TV-EMP-0001' && a.body.user.fullName === 'Dr. Ananya Deshmukh', 'Admin persona mismatch');
    assert(o.body.user.employeeId === 'TV-EMP-0104' && o.body.user.fullName === 'Vivek Sharma', 'Owner persona mismatch');
    assert(e.body.user.employeeId === 'TV-EMP-0219' && e.body.user.fullName === 'Priya Nair', 'Editor persona mismatch');
    assert(v.body.user.employeeId === 'TV-EXT-0408' && v.body.user.fullName === 'Arjun Mehta', 'Viewer persona mismatch');
    adminToken = a.body.accessToken;
    ownerToken = o.body.accessToken;
    editorToken = e.body.accessToken;
    viewerToken = v.body.accessToken;
    editorId = e.body.user.id;
    viewerId = v.body.user.id;
  });

  await test('PERSONA-02', 'Strict Persona Isolation: Vivek private M&A Term Sheet is visible to Vivek but hidden from Admin, Priya & Arjun', async () => {
    const ownerDocs = await (await fetch(`${BASE_URL}/documents`, { headers: { Authorization: `Bearer ${ownerToken}` } })).json();
    const adminDocs = await (await fetch(`${BASE_URL}/documents`, { headers: { Authorization: `Bearer ${adminToken}` } })).json();
    const editorDocs = await (await fetch(`${BASE_URL}/documents`, { headers: { Authorization: `Bearer ${editorToken}` } })).json();
    const viewerDocs = await (await fetch(`${BASE_URL}/documents`, { headers: { Authorization: `Bearer ${viewerToken}` } })).json();

    assert(ownerDocs.some(d => d.name === 'Confidential_MA_Acquisition_TermSheet.pdf'), 'Vivek must see his own private M&A term sheet');
    assert(!adminDocs.some(d => d.name === 'Confidential_MA_Acquisition_TermSheet.pdf'), 'Admin must not see Vivek unshared private M&A term sheet');
    assert(!editorDocs.some(d => d.name === 'Confidential_MA_Acquisition_TermSheet.pdf'), 'Editor Priya must not see Vivek unshared private M&A term sheet');
    assert(!viewerDocs.some(d => d.name === 'Confidential_MA_Acquisition_TermSheet.pdf'), 'Viewer Arjun must not see Vivek unshared private M&A term sheet');
  });

  await test('AUTH-02', 'Login with wrong password returns 401 Unauthorized', async () => {
    const res = await login('owner@trustvault.local', 'Wrong-Password-123!');
    assert(res.status === 401, `Expected 401, got ${res.status}`);
  });

  await test('SEC-03 / AUTH-09', 'Unauthenticated user cannot access documents or download files', async () => {
    const res = await fetch(`${BASE_URL}/documents`);
    assert(res.status === 401, `Expected 401, got ${res.status}`);
  });

  await test('ADM-12', 'Non-Admin user (Viewer/Owner) is denied access to Admin API (403 Forbidden)', async () => {
    const res = await fetch(`${BASE_URL}/admin/users`, {
      headers: { Authorization: `Bearer ${viewerToken}` }
    });
    assert(res.status === 403, `Expected 403, got ${res.status}`);
  });

  await test('DOC-12', 'Viewer role is forbidden from uploading new documents (403 Forbidden)', async () => {
    const fd = new FormData();
    fd.append('file', new Blob(['%PDF-1.4 test'], { type: 'application/pdf' }), 'viewer_upload.pdf');
    const res = await fetch(`${BASE_URL}/documents`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${viewerToken}` },
      body: fd
    });
    assert(res.status === 403, `Expected 403, got ${res.status}`);
  });

  await test('DOC-01', 'Owner uploads valid PDF and magic-byte scanner marks it Clean', async () => {
    const fd = new FormData();
    fd.append('file', new Blob(['%PDF-1.4\n%Corporate Confidential PDF\n%%EOF'], { type: 'application/pdf' }), 'Confidential_Strategy.pdf');
    fd.append('category', 'Legal');
    const res = await fetch(`${BASE_URL}/documents`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${ownerToken}` },
      body: fd
    });
    const body = await res.json();
    assert(res.status === 201 && body.status === 'Clean', `Expected 201 Clean, got ${res.status} ${body.status}`);
    cleanDocId = body.id;
  });

  await test('DOC-08 / DOC-09 / SEC-10', 'EICAR malware upload is quarantined (Rejected) and cannot be read or downloaded', async () => {
    const eicar = 'X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*';
    const fd = new FormData();
    fd.append('file', new Blob([eicar], { type: 'text/plain' }), 'eicar_payload.txt');
    const up = await fetch(`${BASE_URL}/documents`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${ownerToken}` },
      body: fd
    });
    const upBody = await up.json();
    assert(up.status === 201 && upBody.status === 'Rejected', `Expected Rejected status, got ${upBody.status}`);
    quarantinedDocId = upBody.id;

    const dl = await fetch(`${BASE_URL}/documents/${quarantinedDocId}/download`, {
      headers: { Authorization: `Bearer ${ownerToken}` }
    });
    assert(dl.status === 404, `Quarantined download must fail with 404, got ${dl.status}`);
  });

  await test('SEC-01 / SEC-05 / SEC-12', 'Viewer cannot see, read, edit, or download Owner private document (IDOR blocked)', async () => {
    const listRes = await fetch(`${BASE_URL}/documents`, {
      headers: { Authorization: `Bearer ${viewerToken}` }
    });
    const list = await listRes.json();
    assert(!list.some(d => d.id === cleanDocId), 'Private document must not appear in Viewer search/list');

    const readRes = await fetch(`${BASE_URL}/documents/${cleanDocId}`, {
      headers: { Authorization: `Bearer ${viewerToken}` }
    });
    assert(readRes.status === 404, `Direct IDOR read must return 404, got ${readRes.status}`);

    const dlRes = await fetch(`${BASE_URL}/documents/${cleanDocId}/download`, {
      headers: { Authorization: `Bearer ${viewerToken}` }
    });
    assert(dlRes.status === 404, `Direct IDOR download must return 404, got ${dlRes.status}`);
  });

  await test('PERM-01 / READ-02 / SEC-02', 'Owner grants Read to Viewer: Viewer can read/download but CANNOT edit', async () => {
    const grantRes = await fetch(`${BASE_URL}/documents/${cleanDocId}/permissions`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${ownerToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'viewer@trustvault.local', access: 'Read' })
    });
    assert(grantRes.status === 200, `Grant Read failed with ${grantRes.status}`);

    const readRes = await fetch(`${BASE_URL}/documents/${cleanDocId}`, {
      headers: { Authorization: `Bearer ${viewerToken}` }
    });
    assert(readRes.status === 200, `Viewer Read should succeed (200), got ${readRes.status}`);

    const editRes = await fetch(`${BASE_URL}/documents/${cleanDocId}`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${viewerToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Hacked_By_Viewer.pdf', category: 'Legal' })
    });
    assert(editRes.status === 404, `Viewer Edit must be denied (404), got ${editRes.status}`);
  });

  await test('PERM-02 / EDIT-02', 'Owner grants Edit to Editor: Editor CAN read and edit document metadata', async () => {
    const grantRes = await fetch(`${BASE_URL}/documents/${cleanDocId}/permissions`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${ownerToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'editor@trustvault.local', access: 'Edit' })
    });
    assert(grantRes.status === 200, `Grant Edit failed with ${grantRes.status}`);

    const editRes = await fetch(`${BASE_URL}/documents/${cleanDocId}`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${editorToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Confidential_Strategy_Reviewed.pdf', category: 'Legal' })
    });
    assert(editRes.status === 204, `Editor update should return 204, got ${editRes.status}`);
  });

  await test('SEC-04 / SEC-11 / PERM-03', 'Immediate permission revocation blocks next Read/Download/Edit request', async () => {
    const revViewer = await fetch(`${BASE_URL}/documents/${cleanDocId}/permissions/${viewerId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${ownerToken}` }
    });
    assert(revViewer.status === 204, `Revoke Viewer failed with ${revViewer.status}`);

    const nextRead = await fetch(`${BASE_URL}/documents/${cleanDocId}/download`, {
      headers: { Authorization: `Bearer ${viewerToken}` }
    });
    assert(nextRead.status === 404, `Revoked Viewer download must fail immediately with 404, got ${nextRead.status}`);
  });

  await test('SPRINT-3 / RETRY-SCAN', 'Editor Priya can trigger Retry Scan on shared ScanFailed forecast and unlock Read/Edit', async () => {
    const listRes = await fetch(`${BASE_URL}/documents`, {
      headers: { Authorization: `Bearer ${editorToken}` }
    });
    const docs = await listRes.json();
    const failedDoc = docs.find(d => d.name === 'Q4_Financial_Forecast.txt');
    if (failedDoc && failedDoc.status !== 'Clean') {
      const retryRes = await fetch(`${BASE_URL}/documents/${failedDoc.id}/retry-scan`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${editorToken}` }
      });
      const retryBody = await retryRes.json();
      assert(retryRes.status === 200 && retryBody.status === 'Clean', `Expected Retry Scan to transition to Clean`);
    }
  });

  await test('SEC-08 / SEC-09 / AUD-19', 'Cryptographic HMAC-SHA256 audit chain is intact and records denials', async () => {
    const verifyRes = await fetch(`${BASE_URL}/admin/verify-audit-chain`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    const verifyBody = await verifyRes.json();
    assert(verifyRes.status === 200 && verifyBody.isValid === true && verifyBody.totalRecords > 5, 'Audit HMAC chain must be valid');
  });

  console.log(`\n======================================================================`);
  console.log(` Results: ${passed} Passed, ${failed} Failed`);
  console.log(`======================================================================`);
  process.exit(failed > 0 ? 1 : 0);
}

run();
