// ============ VPet Studio · Electron 主进程 ============
const { app, BrowserWindow, ipcMain, dialog, shell, protocol, net } = require('electron');
const path = require('path');
const fs = require('fs');
const AdmZip = require('adm-zip');

const PROJECTS_ROOT = path.join(app.getPath('documents'), 'VPetStudioProjects');
const ASSETS_DIR = 'assets';

let win = null;

// 素材流式读取协议: vpet-asset://<projectId>/<fileName> → 由主进程按需从磁盘响应, 渲染进程不驻留 base64
protocol.registerSchemesAsPrivileged([
  { scheme: 'vpet-asset', privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true } },
]);

function handleAssetProtocol() {
  protocol.handle('vpet-asset', (request) => {
    let projectId = '', fileName = '';
    try {
      const u = new URL(request.url);
      projectId = decodeURIComponent(u.hostname);
      fileName = decodeURIComponent(u.pathname.replace(/^\/+/, ''));
    } catch {
      return new Response('bad url', { status: 400 });
    }
    // 严格校验, 防目录穿越
    if (!/^[\w\u4e00-\u9fa5-]+$/.test(projectId) || !/^[\w.-]+$/.test(fileName)) {
      return new Response('bad request', { status: 400 });
    }
    const fp = path.join(PROJECTS_ROOT, projectId, ASSETS_DIR, fileName);
    if (!fs.existsSync(fp)) return new Response('not found', { status: 404 });
    return net.fetch('file:///' + fp.replace(/\\/g, '/'));
  });
}

function createWindow() {
  win = new BrowserWindow({
    width: 1360,
    height: 860,
    minWidth: 1100,
    minHeight: 700,
    backgroundColor: '#fbf1f7',
    title: 'VPet Studio · 桌宠模组工坊',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  const startUrl = process.env.ELECTRON_START_URL;
  if (startUrl) {
    win.loadURL(startUrl);
    win.webContents.openDevTools({ mode: 'detach' });
  } else {
    win.loadFile(path.join(__dirname, '../dist/index.html'));
  }
  win.setMenu(null);
}

// 单实例锁: 二次启动时聚焦已有窗口, 不开新窗口
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (win) {
      if (win.isMinimized()) win.restore();
      win.show();
      win.focus();
    }
  });

  app.whenReady().then(() => {
    handleAssetProtocol();
    createWindow();
  });
  app.on('window-all-closed', () => app.quit());
}

// ---------- 工具 ----------
function pngSize(buf) {
  if (buf.length > 24 && buf[12] === 0x49 && buf[13] === 0x48 && buf[14] === 0x44 && buf[15] === 0x52)
    return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
  return { w: 0, h: 0 };
}
function dataUrlToBuffer(dataUrl) {
  const base64 = String(dataUrl).split(',')[1] || '';
  return Buffer.from(base64, 'base64');
}
function projDir(id) { return path.join(PROJECTS_ROOT, id); }
function ensureProj(id) {
  const dir = projDir(id);
  fs.mkdirSync(path.join(dir, ASSETS_DIR), { recursive: true });
  return dir;
}

// ---------- IPC: 项目 ----------
ipcMain.handle('projects-root', () => PROJECTS_ROOT);

ipcMain.handle('list-projects', () => {
  if (!fs.existsSync(PROJECTS_ROOT)) return [];
  return fs.readdirSync(PROJECTS_ROOT, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => {
      const f = path.join(PROJECTS_ROOT, d.name, 'project.json');
      try {
        const p = JSON.parse(fs.readFileSync(f, 'utf8'));
        return { id: p.meta.id, name: p.meta.name, author: p.meta.author, updatedAt: p.meta.updatedAt, dir: path.join(PROJECTS_ROOT, d.name) };
      } catch { return null; }
    })
    .filter(Boolean)
    .sort((a, b) => b.updatedAt - a.updatedAt);
});

ipcMain.handle('create-project', (_e, project) => {
  const dir = ensureProj(project.meta.id);
  fs.writeFileSync(path.join(dir, 'project.json'), JSON.stringify(project, null, 2));
  return dir;
});

ipcMain.handle('save-project', (_e, project) => {
  const dir = ensureProj(project.meta.id);
  fs.writeFileSync(path.join(dir, 'project.json'), JSON.stringify(project, null, 2));
  return true;
});

ipcMain.handle('load-project', (_e, id) => {
  const f = path.join(projDir(id), 'project.json');
  if (!fs.existsSync(f)) return null;
  return fs.readFileSync(f, 'utf8');
});

ipcMain.handle('delete-project', (_e, id) => {
  fs.rmSync(projDir(id), { recursive: true, force: true });
  return true;
});

// ---------- IPC: 素材 ----------
ipcMain.handle('import-asset-data', (_e, projectId, name, dataUrl) => {
  const dir = ensureProj(projectId);
  const buf = dataUrlToBuffer(dataUrl);
  const { w, h } = pngSize(buf);
  const fileName = `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}.png`;
  fs.writeFileSync(path.join(dir, ASSETS_DIR, fileName), buf);
  return { id: 'a' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), name, w, h, bytes: buf.length, createdAt: Date.now(), fileName };
});

ipcMain.handle('read-asset', (_e, projectId, fileName) => {
  const f = path.join(projDir(projectId), ASSETS_DIR, String(fileName));
  if (!fs.existsSync(f)) return '';
  const buf = fs.readFileSync(f);
  return 'data:image/png;base64,' + buf.toString('base64');
});

ipcMain.handle('delete-asset', (_e, projectId, fileName) => {
  const f = path.join(projDir(projectId), ASSETS_DIR, String(fileName));
  if (fs.existsSync(f)) fs.unlinkSync(f);
  return true;
});

ipcMain.handle('pick-images', async () => {
  const r = await dialog.showOpenDialog(win, {
    title: '选择图片素材',
    properties: ['openFile', 'multiSelections'],
    filters: [{ name: '图片', extensions: ['png', 'jpg', 'jpeg', 'webp'] }],
  });
  if (r.canceled || !r.filePaths.length) return [];
  return r.filePaths.map((fp) => ({
    name: path.basename(fp),
    dataUrl: 'data:' + mime(fp) + ';base64,' + fs.readFileSync(fp).toString('base64'),
  }));
});

function mime(fp) {
  const ext = path.extname(fp).toLowerCase();
  return ext === '.png' ? 'image/png' : ext === '.webp' ? 'image/webp' : 'image/jpeg';
}

ipcMain.handle('pick-save-dir', async () => {
  const r = await dialog.showOpenDialog(win, { title: '选择导出位置', properties: ['openDirectory', 'createDirectory'] });
  return r.canceled ? null : r.filePaths[0];
});

ipcMain.handle('open-path', (_e, p) => { shell.openPath(p); return true; });
ipcMain.handle('show-in-folder', (_e, p) => { shell.showItemInFolder(p); return true; });

// ---------- IPC: 导出 ----------
ipcMain.handle('export-mod', async (_e, projectId, targetDir, payload, makeZip) => {
  const log = [];
  const assetDir = path.join(projDir(projectId), ASSETS_DIR);
  const outRoot = path.join(targetDir, projectId);
  for (const f of payload.files) {
    let buf;
    if (f.kind === 'text') {
      buf = Buffer.from(f.content, 'utf8');
    } else {
      // 素材: 渲染层以 dataURL 携带; 若为空则回退到项目素材目录按 id/fileName 查找
      if (f.content && String(f.content).startsWith('data:')) {
        buf = dataUrlToBuffer(f.content);
      } else {
        const fp = path.join(assetDir, String(f.fileName || f.assetId));
        if (!fs.existsSync(fp)) { log.push(`✗ 缺失素材: ${f.assetId} (${f.path})`); continue; }
        buf = fs.readFileSync(fp);
      }
    }
    const out = path.join(outRoot, f.path);
    fs.mkdirSync(path.dirname(out), { recursive: true });
    fs.writeFileSync(out, buf);
    log.push(`+ ${f.path}`);
  }
  let zipPath;
  if (makeZip) {
    zipPath = outRoot + '.zip';
    const zip = new AdmZip();
    zip.addLocalFolder(outRoot);
    zip.writeZip(zipPath);
    log.push(`📦 打包完成: ${zipPath}`);
  }
  return { log, zipPath, dir: outRoot };
});

// ---------- IPC: AI ----------
ipcMain.handle('get-ai-config', () => {
  const f = path.join(app.getPath('userData'), 'ai-config.json');
  return fs.existsSync(f) ? fs.readFileSync(f, 'utf8') : null;
});
ipcMain.handle('set-ai-config', (_e, json) => {
  fs.writeFileSync(path.join(app.getPath('userData'), 'ai-config.json'), json);
  return true;
});

function joinUrl(base, api) {
  return base.replace(/\/+$/, '') + api;
}

ipcMain.handle('ai-test', async (_e, provider) => {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 15000);
    const res = await fetch(joinUrl(provider.baseUrl, '/models'), {
      headers: { Authorization: 'Bearer ' + provider.apiKey },
      signal: ctrl.signal,
    });
    clearTimeout(t);
    if (!res.ok) return { ok: false, message: `HTTP ${res.status} ${res.statusText}` };
    const j = await res.json();
    const n = (j.data || []).length;
    return { ok: true, message: `连接成功, 可用模型 ${n} 个` };
  } catch (e) {
    return { ok: false, message: String(e?.message || e) };
  }
});

ipcMain.handle('ai-chat', async (_e, provider, system, user) => {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 120000);
    const res = await fetch(joinUrl(provider.baseUrl, '/chat/completions'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + provider.apiKey },
      body: JSON.stringify({
        model: provider.chatModel,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
        temperature: 0.9,
      }),
      signal: ctrl.signal,
    });
    clearTimeout(t);
    const j = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false, message: `HTTP ${res.status}: ${j?.error?.message || res.statusText}` };
    return { ok: true, message: j.choices?.[0]?.message?.content || '(空回复)' };
  } catch (e) {
    return { ok: false, message: String(e?.message || e) };
  }
});

ipcMain.handle('ai-image', async (_e, provider, prompt, size) => {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 300000);
    const res = await fetch(joinUrl(provider.baseUrl, '/images/generations'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + provider.apiKey },
      body: JSON.stringify({ model: provider.imageModel, prompt, size, n: 1, response_format: 'b64_json' }),
      signal: ctrl.signal,
    });
    clearTimeout(t);
    const j = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false, message: `HTTP ${res.status}: ${j?.error?.message || res.statusText}`, images: [] };
    const images = (j.data || []).map((d) => (d.b64_json ? 'data:image/png;base64,' + d.b64_json : d.url || '')).filter(Boolean);
    return { ok: images.length > 0, message: images.length ? '生成成功' : '返回为空', images };
  } catch (e) {
    return { ok: false, message: String(e?.message || e), images: [] };
  }
});
