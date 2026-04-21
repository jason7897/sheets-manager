// GitHub Actions: deploy sheets-manager.html to Google Apps Script hosting project
const https = require('https');
const fs = require('fs');

const CLIENT_ID     = process.env.GOOGLE_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const REFRESH_TOKEN = process.env.GOOGLE_REFRESH_TOKEN;
const SCRIPT_ID     = process.env.GAS_SCRIPT_ID;
const DEPLOY_ID     = process.env.GAS_DEPLOY_ID;

function request(method, path, body, token) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const opts = {
      hostname: path.startsWith('/token') ? 'oauth2.googleapis.com' : 'script.googleapis.com',
      path,
      method,
      headers: {
        'Content-Type': path.startsWith('/token') ? 'application/x-www-form-urlencoded' : 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(data ? { 'Content-Length': Buffer.byteLength(data) } : {})
      }
    };
    const req = https.request(opts, res => {
      let buf = '';
      res.on('data', d => buf += d);
      res.on('end', () => {
        try { resolve(JSON.parse(buf)); }
        catch { resolve(buf); }
      });
    });
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

function formPost(path, params) {
  return new Promise((resolve, reject) => {
    const data = new URLSearchParams(params).toString();
    const opts = {
      hostname: 'oauth2.googleapis.com',
      path,
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(data)
      }
    };
    const req = https.request(opts, res => {
      let buf = '';
      res.on('data', d => buf += d);
      res.on('end', () => { try { resolve(JSON.parse(buf)); } catch { resolve(buf); } });
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

const GAS_MANIFEST = JSON.stringify({
  timeZone: 'Asia/Seoul',
  dependencies: {},
  exceptionLogging: 'STACKDRIVER',
  runtimeVersion: 'V8',
  webapp: { executeAs: 'USER_DEPLOYING', access: 'ANYONE_ANONYMOUS' }
});

const GAS_CODE = `function doGet(e) {
  return HtmlService.createHtmlOutputFromFile('index')
    .setTitle('Sheets Manager')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}`;

async function main() {
  // 1. Refresh access token
  console.log('Getting access token...');
  const tokenRes = await formPost('/token', {
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET,
    refresh_token: REFRESH_TOKEN,
    grant_type: 'refresh_token'
  });
  if (!tokenRes.access_token) {
    console.error('Token error:', JSON.stringify(tokenRes));
    process.exit(1);
  }
  const token = tokenRes.access_token;
  console.log('Access token obtained.');

  // 2. Upload new HTML content
  console.log('Uploading content...');
  const htmlSource = fs.readFileSync('sheets-manager.html', 'utf8');
  const uploadRes = await request('PUT', `/v1/projects/${SCRIPT_ID}/content`, {
    files: [
      { name: 'Code',        type: 'SERVER_JS', source: GAS_CODE },
      { name: 'index',       type: 'HTML',      source: htmlSource },
      { name: 'appsscript',  type: 'JSON',      source: GAS_MANIFEST }
    ]
  }, token);
  if (uploadRes.error) {
    console.error('Upload error:', JSON.stringify(uploadRes.error));
    process.exit(1);
  }
  console.log('Content uploaded.');

  // 3. Create new version
  console.log('Creating version...');
  const now = new Date().toISOString().slice(0, 16).replace('T', ' ');
  const versionRes = await request('POST', `/v1/projects/${SCRIPT_ID}/versions`, {
    description: `Auto-deploy ${now}`
  }, token);
  if (!versionRes.versionNumber) {
    console.error('Version error:', JSON.stringify(versionRes));
    process.exit(1);
  }
  const versionNumber = versionRes.versionNumber;
  console.log(`Version ${versionNumber} created.`);

  // 4. Update existing deployment to new version
  console.log('Updating deployment...');
  const deployRes = await request('PUT', `/v1/projects/${SCRIPT_ID}/deployments/${DEPLOY_ID}`, {
    deploymentConfig: {
      versionNumber,
      manifestFileName: 'appsscript',
      description: `Auto-deploy ${now}`
    }
  }, token);
  if (deployRes.error) {
    console.error('Deploy error:', JSON.stringify(deployRes.error));
    process.exit(1);
  }
  console.log('Deployment updated successfully.');
  console.log(`URL: https://script.google.com/macros/s/${DEPLOY_ID}/exec`);
}

main().catch(e => { console.error(e.message); process.exit(1); });
