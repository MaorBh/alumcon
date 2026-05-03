import 'dotenv/config';
import express from 'express';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import cors from 'cors';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const upload = multer({ dest: 'uploads/', limits: { fileSize: 500 * 1024 * 1024 } });

app.use(cors());
app.use(express.json());

const BUCKET_KEY = process.env.APS_BUCKET_KEY || 'alumcon001';
const URNS_PATH = path.join(__dirname, 'data', 'project-urns.json');

fs.mkdirSync(path.join(__dirname, 'data'), { recursive: true });
fs.mkdirSync(path.join(__dirname, 'uploads'), { recursive: true });

function loadUrns() {
  try { return JSON.parse(fs.readFileSync(URNS_PATH, 'utf8')); }
  catch { return {}; }
}

function saveUrns(urns) {
  fs.writeFileSync(URNS_PATH, JSON.stringify(urns, null, 2));
}

let _tokenCache = null;

async function getToken() {
  if (_tokenCache && _tokenCache.expires_at > Date.now() + 60000) {
    return _tokenCache.access_token;
  }
  const params = new URLSearchParams({
    client_id: process.env.APS_CLIENT_ID,
    client_secret: process.env.APS_CLIENT_SECRET,
    grant_type: 'client_credentials',
    scope: 'data:read data:write data:create bucket:create bucket:read'
  });
  const resp = await fetch('https://developer.api.autodesk.com/authentication/v2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString()
  });
  if (!resp.ok) throw new Error(`APS Auth failed: ${resp.status}`);
  const data = await resp.json();
  _tokenCache = { access_token: data.access_token, expires_at: Date.now() + data.expires_in * 1000 };
  return _tokenCache.access_token;
}

async function ensureBucket() {
  const token = await getToken();
  const check = await fetch(`https://developer.api.autodesk.com/oss/v2/buckets/${BUCKET_KEY}/details`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (check.status === 200) { console.log('Bucket exists:', BUCKET_KEY); return; }
  if (check.status === 404) {
    const create = await fetch('https://developer.api.autodesk.com/oss/v2/buckets', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ bucketKey: BUCKET_KEY, policyKey: 'persistent' })
    });
    if (!create.ok) throw new Error(`Bucket creation failed: ${await create.text()}`);
    console.log('Bucket created:', BUCKET_KEY);
  }
}

app.get('/api/token', async (req, res) => {
  try { res.json({ access_token: await getToken() }); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/project-urn/:projectId', (req, res) => {
  const urns = loadUrns();
  res.json({ urn: urns[req.params.projectId] || null });
});

app.post('/api/upload-model/:projectId', upload.single('model'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'no file' });
  const { projectId } = req.params;
  try {
    const token = await getToken();
    const ext = req.file.originalname.split('.').pop().toLowerCase();
    const supported = ['rvt','stp','step','iges','igs','ifc','dwg','nwd','ipt','iam'];
    if (!supported.includes(ext)) {
      fs.unlinkSync(req.file.path);
      return res.status(400).json({ error: `Unsupported format: .${ext}` });
    }
    const objectName = `${projectId}_${req.file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
    const fileBuffer = fs.readFileSync(req.file.path);

    const signedResp = await fetch(
      `https://developer.api.autodesk.com/oss/v2/buckets/${BUCKET_KEY}/objects/${encodeURIComponent(objectName)}/signeds3upload?minutesExpiration=60`,
      { method: 'GET', headers: { Authorization: `Bearer ${token}` } }
    );
    if (!signedResp.ok) throw new Error(`Signed URL failed: ${await signedResp.text()}`);
    const { uploadKey, urls } = await signedResp.json();

    const s3Resp = await fetch(urls[0], {
      method: 'PUT',
      headers: { 'Content-Type': 'application/octet-stream' },
      body: fileBuffer
    });
    if (!s3Resp.ok) throw new Error(`S3 upload failed: ${s3Resp.status}`);

    const completeResp = await fetch(
      `https://developer.api.autodesk.com/oss/v2/buckets/${BUCKET_KEY}/objects/${encodeURIComponent(objectName)}/signeds3upload`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ uploadKey })
      }
    );
    if (!completeResp.ok) throw new Error(`Complete upload failed: ${await completeResp.text()}`);

    fs.unlinkSync(req.file.path);

    const urn = Buffer.from(`urn:adsk.objects:os.object:${BUCKET_KEY}/${objectName}`)
      .toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');

    const jobResp = await fetch('https://developer.api.autodesk.com/modelderivative/v2/designdata/job', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', 'x-ads-force': 'true' },
      body: JSON.stringify({
        input: { urn },
        output: { formats: [{ type: 'svf2', views: ['3d', '2d'], advanced: { generateMasterViews: true } }] }
      })
    });
    if (!jobResp.ok && jobResp.status !== 409) throw new Error(`Translation failed: ${await jobResp.text()}`);

    const urns = loadUrns();
    urns[projectId] = urn;
    saveUrns(urns);

    console.log('Uploaded + translation started. URN:', urn);
    res.json({ urn });
  } catch (err) {
    if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/translate-status/:urn', async (req, res) => {
  try {
    const token = await getToken();
    const resp = await fetch(
      `https://developer.api.autodesk.com/modelderivative/v2/designdata/${req.params.urn}/manifest`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    if (!resp.ok) {
      return res.json({ status: 'pending', progress: '0%' });
    }
    const data = await resp.json();
    res.json({
      status: data.status || 'pending',
      progress: data.progress || '0%',
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, 'dist')));
  app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'dist', 'index.html')));
}

const PORT = process.env.PORT || 3001;
app.listen(PORT, async () => {
  console.log(`\nBIM Server: http://localhost:${PORT}`);
  try { await ensureBucket(); } catch (err) { console.error('Bucket error:', err.message); }
});