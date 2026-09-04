'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const PORT = 21000 + Math.floor(Math.random() * 150);
const base = `http://127.0.0.1:${PORT}`;
const dataDir = fs.mkdtempSync('/tmp/foundly-business-workspaces-');
const password = 'foundly-business-workspaces-password-2026';
const auth = `Basic ${Buffer.from(`foundly:${password}`).toString('base64')}`;
const serverEnv = {
  ...process.env,
  NODE_ENV: 'production',
  PORT: String(PORT),
  FOUNDLY_DATA_DIR: dataDir,
  FOUNDLY_PUBLIC_BASE_URL: 'https://foundly.example.test',
  FOUNDLY_ADMIN_USERNAME: 'foundly',
  FOUNDLY_ADMIN_PASSWORD: password,
  FOUNDLY_ENCRYPTION_KEY: 'foundly-business-workspaces-encryption-key-2026-secure',
  FOUNDLY_TENANT_ID: 'tenant-workspaces',
  FOUNDLY_DEALER_ID: 'business-workspaces',
  FOUNDLY_PLATFORM_ROLES: 'ADMIN',
  FOUNDLY_CRM_ROLES: 'ADMIN',
  FOUNDLY_WORKER_INTERVAL_MS: '99999999',
  OPENAI_API_KEY: '',
  FOUNDLY_AI_API_KEY: ''
};
let child;
let logs = '';
const wait = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));

async function start() {
  child = spawn(process.execPath, ['server.js'], { cwd: __dirname, env: serverEnv, stdio: ['ignore', 'pipe', 'pipe'] });
  child.stdout.on('data', chunk => { logs += chunk; });
  child.stderr.on('data', chunk => { logs += chunk; });
  for (let attempt = 0; attempt < 80; attempt++) {
    try { if ((await fetch(`${base}/api/health`)).ok) return; }
    catch {}
    await wait(75);
  }
  throw new Error(`server start timeout\n${logs}`);
}

async function stop() {
  if (!child) return;
  child.kill('SIGTERM');
  for (let attempt = 0; attempt < 50 && child.exitCode === null; attempt++) await wait(40);
  child = null;
}

async function call(route, authenticated = true) {
  const response = await fetch(base + route, { redirect: 'manual', headers: authenticated ? { authorization: auth } : {} });
  return { response, text: await response.text() };
}

(async () => {
  try {
    const analysisHtml = fs.readFileSync(path.join(__dirname, 'analysis.html'), 'utf8');
    const financeHtml = fs.readFileSync(path.join(__dirname, 'finance.html'), 'utf8');
    const analysisScript = fs.readFileSync(path.join(__dirname, 'analysis-script.js'), 'utf8');
    const financeScript = fs.readFileSync(path.join(__dirname, 'finance-script.js'), 'utf8');
    const css = fs.readFileSync(path.join(__dirname, 'business-workspaces.css'), 'utf8');

    for (const token of ['Analysis Command Dashboard', 'analysisKpis', 'analysisFunnel', 'analysisEvents', 'analysisHistory', 'analysisSources', 'analysisAutomation', 'analysisZeroForm']) assert(analysisHtml.includes(token), `Analysis workspace mist ${token}`);
    for (const token of ['/api/analysis/dashboard', '/api/platform/status', '/api/platform/connectors', '/api/automation/status', '/api/platform/events/stream', '/api/platform/exports', '/api/zero/turn', 'NO_VERIFIED_SOURCE_DATA']) assert(analysisScript.includes(token), `Analysis client mist ${token}`);
    for (const token of ['Finance Command Center', 'financeKpis', 'financePnl', 'financeAging', 'financeForecast', 'financeCompliance', 'financeJournal', 'exportFinance', 'financeZeroForm']) assert(financeHtml.includes(token), `Finance workspace mist ${token}`);
    for (const token of ['/api/finance/status', '/api/finance/dashboard', '/api/finance/reports', '/api/finance/records/legal_entities', '/api/finance/exports', '/api/zero/turn', 'posted_immutable_journal_entries']) assert(financeScript.includes(token), `Finance client mist ${token}`);
    for (const token of [':root', 'body.finance', '.rail', '.workspace', '.toolbar', '.kpi-grid', '.dashboard-grid', '.zero-dock', '@media (max-width: 760px)', '@media (prefers-reduced-motion: reduce)']) assert(css.includes(token), `Business design system mist ${token}`);
    assert(css.length > 12000, 'Business workspace stylesheet mag niet terugvallen naar een incompleet fragment');
    assert(!/style\s*=/.test(analysisHtml + financeHtml + analysisScript + financeScript), 'Business workspaces moeten zonder inline styles werken');
    assert(!/\bprompt\s*\(/.test(analysisScript + financeScript), 'Business workspaces mogen niet op native prompt-dialogen steunen');
    assert(!/\b(?:12500|45000|Example Customer|Demo Revenue|Fake KPI)\b/i.test(analysisHtml + financeHtml + analysisScript + financeScript + css), 'Business UI mag geen fake bedrijfswaarden bevatten');
    assert(/escapeHtml/.test(analysisScript) && /escapeHtml/.test(financeScript), 'Extern geladen tekst moet HTML-geëscapet worden');

    await start();
    let result = await call('/analysis', false);
    assert.equal(result.response.status, 401);
    result = await call('/finance', false);
    assert.equal(result.response.status, 401);
    for (const route of ['/analysis', '/finance', '/analysis-script.js', '/finance-script.js', '/business-workspaces.css']) {
      result = await call(route);
      assert.equal(result.response.status, 200, `${route} niet bereikbaar`);
      assert.match(result.response.headers.get('content-security-policy'), /script-src 'self'/);
      assert.equal(result.response.headers.get('x-frame-options'), 'DENY');
    }
    result = await call('/api/analysis/dashboard');
    assert.equal(result.response.status, 200);
    const analysis = JSON.parse(result.text);
    assert.equal(analysis.no_fake_data, true);
    assert.equal(analysis.realtime.events, 0);
    assert.equal(analysis.kpis.roas.available, false);
    result = await call('/api/finance/dashboard');
    assert.equal(result.response.status, 200);
    const finance = JSON.parse(result.text);
    assert.equal(finance.no_fake_data, true);
    assert.equal(finance.widgets.find(widget => widget.id === 'revenue').value_cents, 0);

    console.log(JSON.stringify({
      ok: true,
      analysis_workspace: 'pass',
      finance_workspace: 'pass',
      authenticated_routes: 'pass',
      strict_csp_assets: 'pass',
      accessible_responsive_design: 'pass',
      intentional_empty_states: 'pass',
      no_fake_ui_data: 'pass'
    }, null, 2));
  } catch (error) {
    console.error(logs);
    console.error(error);
    process.exitCode = 1;
  } finally {
    await stop();
  }
})();
