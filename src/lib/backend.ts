// ============ 后端适配层 ============
// Electron 桌面模式: 走 window.vpet IPC (完整文件系统/导出/AI)
// 浏览器开发模式: localStorage Mock (用于 UI 开发调试)

import type { StudioProject, ProjectSummary, Asset, AiConfig, AiLogItem, AiProvider } from './types';

export interface ExportPayload {
  files: { path: string; kind: 'text' | 'asset'; content?: string; assetId?: string; fileName?: string }[];
}

export interface Backend {
  isDesktop: boolean;
  projectsRoot(): Promise<string>;
  listProjects(): Promise<ProjectSummary[]>;
  createProject(p: StudioProject): Promise<void>;
  saveProject(p: StudioProject): Promise<void>;
  loadProject(id: string): Promise<StudioProject | null>;
  deleteProject(id: string): Promise<void>;
  importImageFiles(projectId: string, name: string, dataUrl: string): Promise<Asset>;
  readAsset(projectId: string, asset: Asset): Promise<string>;
  deleteAsset(projectId: string, asset: Asset): Promise<void>;
  pickImages(): Promise<{ name: string; dataUrl: string }[]>;
  pickSaveDir(): Promise<string | null>;
  exportMod(projectId: string, targetDir: string, payload: ExportPayload, makeZip: boolean): Promise<{ log: string[]; zipPath?: string; dir: string }>;
  openPath(path: string): Promise<void>;
  getAiConfig(): Promise<AiConfig>;
  setAiConfig(cfg: AiConfig): Promise<void>;
  aiTest(provider: AiProvider): Promise<{ ok: boolean; message: string }>;
  aiChat(provider: AiProvider, system: string, user: string): Promise<{ ok: boolean; message: string }>;
  aiImage(provider: AiProvider, prompt: string, size: string): Promise<{ ok: boolean; message: string; images: string[] }>;
}

declare global {
  interface Window { vpet?: Backend }
}

// ---------- Electron ----------
function electronBackend(): Backend {
  const ipc = (window as any).vpetRaw as any;
  return {
    isDesktop: true,
    projectsRoot: () => ipc.projectsRoot(),
    listProjects: () => ipc.listProjects(),
    createProject: (p) => ipc.createProject(JSON.parse(JSON.stringify(p))),
    saveProject: (p) => ipc.saveProject(JSON.parse(JSON.stringify(p))),
    loadProject: async (id) => {
      const p = await ipc.loadProject(id);
      return p ? JSON.parse(p) : null;
    },
    deleteProject: (id) => ipc.deleteProject(id),
    importImageFiles: async (projectId, name, dataUrl) => await ipc.importAssetData(projectId, name, dataUrl),
    readAsset: (projectId, asset) => ipc.readAsset(projectId, asset.fileName || asset.id),
    deleteAsset: (projectId, asset) => ipc.deleteAsset(projectId, asset.fileName || asset.id),
    pickImages: () => ipc.pickImages(),
    pickSaveDir: () => ipc.pickSaveDir(),
    exportMod: (projectId, targetDir, payload, makeZip) => ipc.exportMod(projectId, targetDir, payload, makeZip),
    openPath: (path) => ipc.openPath(path),
    getAiConfig: async () => {
      const s = await ipc.getAiConfig();
      return s ? JSON.parse(s) : { providers: [] };
    },
    setAiConfig: (cfg) => ipc.setAiConfig(JSON.stringify(cfg)),
    aiTest: (provider) => ipc.aiTest(JSON.parse(JSON.stringify(provider))),
    aiChat: (provider, system, user) => ipc.aiChat(JSON.parse(JSON.stringify(provider)), system, user),
    aiImage: (provider, prompt, size) => ipc.aiImage(JSON.parse(JSON.stringify(provider)), prompt, size),
  };
}

// ---------- 浏览器 Mock ----------
function browserBackend(): Backend {
  const KEY = 'vpet-studio-projects';
  const readAll = (): Record<string, string> => JSON.parse(localStorage.getItem(KEY) || '{}');
  const writeAll = (m: Record<string, string>) => localStorage.setItem(KEY, JSON.stringify(m));
  const projKey = (id: string) => `proj:${id}`;
  return {
    isDesktop: false,
    projectsRoot: async () => '(浏览器演示模式 · 数据保存在 localStorage)',
    listProjects: async () => {
      const all = readAll();
      return Object.keys(all).filter((k) => k.startsWith('proj:')).map((k) => {
        const p = JSON.parse(all[k]);
        return { id: p.meta.id, name: p.meta.name, author: p.meta.author, updatedAt: p.meta.updatedAt };
      }).sort((a, b) => b.updatedAt - a.updatedAt);
    },
    createProject: async (p) => { const all = readAll(); all[projKey(p.meta.id)] = JSON.stringify(p); writeAll(all); },
    saveProject: async (p) => { const all = readAll(); all[projKey(p.meta.id)] = JSON.stringify(p); writeAll(all); },
    loadProject: async (id) => {
      const all = readAll();
      const s = all[projKey(id)];
      return s ? JSON.parse(s) : null;
    },
    deleteProject: async (id) => { const all = readAll(); delete all[projKey(id)]; writeAll(all); },
    importImageFiles: async (_id, name, dataUrl) => {
      const dim = await imageSize(dataUrl);
      return { id: 'a' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), name, w: dim.w, h: dim.h, bytes: Math.round(dataUrl.length * 0.75), createdAt: Date.now(), source: 'upload' as const, dataUrl };
    },
    readAsset: async (_id, asset) => asset.dataUrl || '',
    deleteAsset: async () => {},
    pickImages: () => new Promise((resolve) => {
      const input = document.createElement('input');
      input.type = 'file'; input.accept = 'image/png,image/jpeg,image/webp'; input.multiple = true;
      input.onchange = async () => {
        const out: { name: string; dataUrl: string }[] = [];
        for (const f of Array.from(input.files || [])) out.push({ name: f.name, dataUrl: await fileToDataUrl(f) });
        resolve(out);
      };
      input.click();
    }),
    pickSaveDir: async () => null,
    exportMod: async (_id, dir, payload) => ({ log: payload.files.map((f) => `+ ${f.path}`), dir: '(浏览器演示模式不写盘)' }),
    openPath: async () => {},
    getAiConfig: async () => {
      const s = localStorage.getItem('vpet-ai-config');
      return s ? JSON.parse(s) : { providers: [] };
    },
    setAiConfig: async (cfg) => localStorage.setItem('vpet-ai-config', JSON.stringify(cfg)),
    aiTest: async () => ({ ok: false, message: '浏览器演示模式不支持真实 AI 调用, 请在桌面版中使用' }),
    aiChat: async () => ({ ok: false, message: '浏览器演示模式不支持真实 AI 调用, 请在桌面版中使用' }),
    aiImage: async () => ({ ok: false, message: '浏览器演示模式不支持真实 AI 调用, 请在桌面版中使用', images: [] }),
  };
}

export const backend: Backend = (window as any).vpetRaw ? electronBackend() : browserBackend();

/** 系统文件选择(桌面版走原生对话框, 浏览器走 input) */
export function pickImages(): Promise<{ name: string; dataUrl: string }[]> {
  return backend.pickImages();
}

// ---------- 图片工具 ----------
export function fileToDataUrl(f: File): Promise<string> {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(String(r.result));
    r.onerror = rej;
    r.readAsDataURL(f);
  });
}

export function imageSize(dataUrl: string): Promise<{ w: number; h: number }> {
  return new Promise((res) => {
    const img = new Image();
    img.onload = () => res({ w: img.naturalWidth, h: img.naturalHeight });
    img.onerror = () => res({ w: 0, h: 0 });
    img.src = dataUrl;
  });
}

/** canvas 切片: 从精灵图取格子 / 镜像 */
export function cropDataUrl(src: string, x: number, y: number, w: number, h: number): Promise<string> {
  return new Promise((res, rej) => {
    const img = new Image();
    img.onload = () => {
      const c = document.createElement('canvas');
      c.width = w; c.height = h;
      c.getContext('2d')!.drawImage(img, x, y, w, h, 0, 0, w, h);
      res(c.toDataURL('image/png'));
    };
    img.onerror = rej;
    img.src = src;
  });
}

export function mirrorDataUrl(src: string): Promise<string> {
  return new Promise((res, rej) => {
    const img = new Image();
    img.onload = () => {
      const c = document.createElement('canvas');
      c.width = img.naturalWidth; c.height = img.naturalHeight;
      const ctx = c.getContext('2d')!;
      ctx.translate(c.width, 0);
      ctx.scale(-1, 1);
      ctx.drawImage(img, 0, 0);
      res(c.toDataURL('image/png'));
    };
    img.onerror = rej;
    img.src = src;
  });
}
