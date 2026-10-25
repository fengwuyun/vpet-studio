// ============ 全局状态 ============
// 项目数据 + 素材 dataURL 缓存 + 自动保存

import React, { createContext, useContext, useEffect, useMemo, useRef, useState, useCallback } from 'react';
import type { StudioProject, Asset, PetConfig } from './types';
import { migrateProject, newPet, newId } from './types';
import { backend } from './backend';

type Mode = 'home' | 'overview' | 'pet' | 'anime' | 'assets' | 'food' | 'text' | 'ai' | 'export' | 'settings';

interface Store {
  project: StudioProject | null;
  setProject: (p: StudioProject | null) => void;
  update: (fn: (p: StudioProject) => void) => void;
  saving: boolean;
  dirty: boolean;
  view: Mode;
  setView: (m: Mode) => void;
  toast: (msg: string, kind?: 'ok' | 'err') => void;
  toasts: { id: number; msg: string; kind: 'ok' | 'err' }[];
  assetCache: Map<string, string>;
  assetUrl: (assetId: string) => string | undefined;
  loadAssetUrls: (assets: Asset[]) => Promise<void>;
  importImages: (imgs: { name: string; dataUrl: string }[], source?: Asset['source'], kind?: Asset['kind']) => Promise<Asset[]>;
  refreshProject: () => Promise<void>;
  activePet: PetConfig | null;
  switchPet: (id: string) => void;
  addPet: (name: string) => void;
  removePet: (id: string) => void;
  /** AI 生成图 → 素材工坊切片的种子通道 */
  wizardSeed: { dataUrl: string; name: string } | null;
  setWizardSeed: (s: { dataUrl: string; name: string } | null) => void;
}

const Ctx = createContext<Store>(null as any);
export const useStore = () => useContext(Ctx);

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [project, setProjectState] = useState<StudioProject | null>(null);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [view, setView] = useState<Mode>('home');
  const [toasts, setToasts] = useState<{ id: number; msg: string; kind: 'ok' | 'err' }[]>([]);
  const assetCache = useRef(new Map<string, string>());
  const saveTimer = useRef<any>(null);
  const projectRef = useRef<StudioProject | null>(null);
  projectRef.current = project;

  const toast = useCallback((msg: string, kind: 'ok' | 'err' = 'ok') => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, msg, kind }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3200);
  }, []);

  const persist = useCallback(async (p: StudioProject) => {
    setSaving(true);
    try {
      await backend.saveProject(p);
      setDirty(false);
    } catch (e: any) {
      toast('保存失败: ' + (e?.message || e), 'err');
    } finally {
      setSaving(false);
    }
  }, [toast]);

  const update = useCallback((fn: (p: StudioProject) => void) => {
    setProjectState((prev) => {
      if (!prev) return prev;
      let next: StudioProject;
      try {
        next = structuredClone(prev); // 字符串按引用共享, 避免 JSON 往返复制大 dataURL
      } catch {
        next = JSON.parse(JSON.stringify(prev));
      }
      fn(next);
      next.meta.updatedAt = Date.now();
      setDirty(true);
      if (saveTimer.current) clearTimeout(saveTimer.current);
      const snapshot = next;
      saveTimer.current = setTimeout(() => persist(snapshot), 900);
      return next;
    });
  }, [persist]);

  const setProject = useCallback((p: StudioProject | null) => {
    // 释放旧的 blob: URL, 避免切换项目后内存滞留
    for (const url of assetCache.current.values()) {
      if (url.startsWith('blob:')) URL.revokeObjectURL(url);
    }
    assetCache.current.clear();
    setProjectState(p ? migrateProject(p) : p);
    setDirty(false);
    if (p) setView('overview');
    else setView('home');
  }, []);

  const refreshProject = useCallback(async () => {
    if (!projectRef.current) return;
    const fresh = await backend.loadProject(projectRef.current.meta.id);
    if (fresh) { assetCache.current.clear(); setProjectState(fresh); }
  }, []);

  const loadAssetUrls = useCallback(async (assets: Asset[]) => {
    if (!projectRef.current) return;
    if (backend.isDesktop) return; // 桌面版经 vpet-asset:// 协议直接从磁盘流式读取, 无需缓存
    const missing = assets.filter((a) => !assetCache.current.has(a.id));
    if (!missing.length) return;
    await Promise.all(missing.map(async (a) => {
      const src = await backend.readAsset(projectRef.current!.meta.id, a);
      if (!src) return;
      // dataURL → blob 对象URL, 让大字符串可被 GC(项目 JSON 里的原始串不再被 img 双份持有)
      try {
        const blob = await (await fetch(src)).blob();
        assetCache.current.set(a.id, URL.createObjectURL(blob));
      } catch {
        assetCache.current.set(a.id, src);
      }
    }));
  }, []);

  const assetUrl = useCallback((assetId: string) => {
    const p = projectRef.current;
    const a = p?.assets.find((x) => x.id === assetId);
    if (!a) return undefined;
    if (backend.isDesktop && a.fileName) {
      // 自定义协议: 由主进程按需从磁盘读取并流式响应, 渲染进程不驻留 base64
      return `vpet-asset://${encodeURIComponent(p!.meta.id)}/${a.fileName}`;
    }
    return assetCache.current.get(assetId);
  }, []);

  const [wizardSeed, setWizardSeed] = useState<{ dataUrl: string; name: string } | null>(null);

  const importImages = useCallback(async (imgs: { name: string; dataUrl: string }[], source: Asset['source'] = 'upload', kind: Asset['kind'] = 'raw') => {
    const pid = projectRef.current!.meta.id;
    const created: Asset[] = [];
    for (const img of imgs) {
      const asset = await backend.importImageFiles(pid, img.name, img.dataUrl);
      const a: Asset = { ...asset, source, kind: source === 'ai' ? 'ai' : kind };
      created.push(a);
      if (!backend.isDesktop) {
        try {
          const blob = await (await fetch(img.dataUrl)).blob();
          assetCache.current.set(a.id, URL.createObjectURL(blob));
        } catch {
          assetCache.current.set(a.id, img.dataUrl);
        }
      }
    }
    update((p) => { p.assets.push(...JSON.parse(JSON.stringify(created.map(({ dataUrl, ...rest }) => rest))) ); });
    return created;
  }, [update]);

  const activePet = useMemo(() => project?.pets.find((x) => x.id === project.activePetId) || project?.pets[0] || null, [project]);

  // 项目载入/素材数量变化时自动预热素材 URL 缓存(否则冷启动后帧图与导出会缺素材)
  useEffect(() => {
    const p = projectRef.current;
    if (p && p.assets.length) loadAssetUrls(p.assets);
  }, [project?.meta.id, project?.assets.length]);

  const switchPet = useCallback((id: string) => {
    update((p) => { p.activePetId = id; });
  }, [update]);
  const addPet = useCallback((name: string) => {
    update((p) => {
      const pet = newPet(name || `宠物${p.pets.length + 1}`, p.pets.length + 1);
      let id = pet.id, n = 2;
      while (p.pets.some((x) => x.id === id)) id = pet.id + '_' + n++;
      pet.id = id;
      p.pets.push(pet);
      p.i18n['zh-CN'] = p.i18n['zh-CN'] || {};
      p.i18n['zh-CN'][`${pet.id}_PetName`] = pet.i18nName;
      p.activePetId = pet.id;
    });
  }, [update]);
  const removePet = useCallback((id: string) => {
    update((p) => {
      if (p.pets.length <= 1) return;
      p.pets = p.pets.filter((x) => x.id !== id);
      p.animations = p.animations.filter((a) => a.petId !== id);
      if (p.activePetId === id) p.activePetId = p.pets[0]?.id;
    });
  }, [update]);

  const value = useMemo<Store>(() => ({
    project, setProject, update, saving, dirty, view, setView, toast, toasts,
    assetCache: assetCache.current, assetUrl, loadAssetUrls, importImages, refreshProject,
    activePet, switchPet, addPet, removePet, wizardSeed, setWizardSeed,
  }), [project, saving, dirty, view, toasts, toast, setProject, update, assetUrl, loadAssetUrls, importImages, refreshProject, activePet, switchPet, addPet, removePet, wizardSeed]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
