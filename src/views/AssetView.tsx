import React, { useEffect, useState } from 'react';
import { useStore } from '../lib/store';
import { DropZone, Stepper, AssetPicker, Modal, Field } from '../components/ui';
import { pickImages, cropDataUrl, mirrorDataUrl, imageSize } from '../lib/backend';
import { GRAPHS, GRAPH_CATEGORIES, MODES, animatsFor, graphMeta } from '../lib/graphMeta';
import type { Asset, AnimationEntry, AnimatId, ModeId } from '../lib/types';
import { newId } from '../lib/types';

interface DraftFrame { dataUrl: string; name: string; duration: number; w: number; h: number }

const KIND_META: Record<string, { label: string; color: string }> = {
  raw: { label: '原始素材', color: 'pink' },
  frame: { label: '动画帧', color: 'blue' },
  icon: { label: '图标', color: 'amber' },
  ai: { label: 'AI 生成', color: 'teal' },
};

export default function AssetView() {
  const s = useStore();
  const [tab, setTab] = useState<'lib' | 'wizard'>('lib');
  const [seedSheet, setSeedSheet] = useState<{ dataUrl: string; name: string } | null>(null);
  // AI 中心「入库并去切片」等入口经全局种子进入切片流程
  useEffect(() => {
    if (s.wizardSeed) {
      setSeedSheet(s.wizardSeed);
      s.setWizardSeed(null);
      setTab('wizard');
    }
  }, [s.wizardSeed]);
  return (
    <div>
      <div className="tabs">
        <div className={`tab ${tab === 'lib' ? 'active' : ''}`} onClick={() => setTab('lib')}>🗃 素材库 · 上传与管理 ({s.project!.assets.length})</div>
        <div className={`tab ${tab === 'wizard' ? 'active' : ''}`} onClick={() => setTab('wizard')}>🛠 素材生成向导</div>
      </div>
      {tab === 'wizard'
        ? <Wizard seedSheet={seedSheet} onSeedConsumed={() => setSeedSheet(null)} />
        : <Library onQuickSplit={(a) => { setSeedSheet({ dataUrl: s.assetUrl(a.id) || '', name: a.name }); setTab('wizard'); }} />}
    </div>
  );
}

/* ================= 素材库: 原始素材上传与管理 ================= */
function Library({ onQuickSplit }: { onQuickSplit: (a: Asset) => void }) {
  const s = useStore();
  const p = s.project!;
  const [q, setQ] = useState('');
  const [kind, setKind] = useState<'all' | 'raw' | 'frame' | 'icon' | 'ai'>('all');
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [bindPick, setBindPick] = useState(false);
  const [renameFor, setRenameFor] = useState<Asset | null>(null);
  useEffect(() => { s.loadAssetUrls(p.assets); }, []);

  const assets = p.assets.filter((a) =>
    (kind === 'all' || a.kind === kind || (kind === 'ai' && a.source === 'ai')) &&
    (!q || a.name.toLowerCase().includes(q.toLowerCase())));
  const selAssets = assets.filter((a) => sel.has(a.id));

  const mirrorSelected = async () => {
    const out = [];
    for (const a of selAssets) {
      const url = s.assetUrl(a.id);
      if (!url) continue;
      out.push({ name: a.name.replace(/\.png$/, '') + '_R.png', dataUrl: await mirrorDataUrl(url) });
    }
    await s.importImages(out, 'mirror', 'frame');
    s.toast(`已生成 ${out.length} 张镜像素材`);
  };

  return (
    <div>
      {/* 上传原始素材 */}
      <div className="grid grid-2" style={{ marginBottom: 16 }}>
        <div className="card" style={{ marginBottom: 0 }}>
          <DropZone onFiles={async (imgs) => { await s.importImages(imgs, 'upload', 'raw'); s.toast(`已上传 ${imgs.length} 张原始素材`); }}
            title="📤 上传原始素材" sub="立绘 · 精灵图 · 参考图 · 逐帧原图都可先存这里, 统一管理后再去切片/绑定" />
        </div>
        <div className="card" style={{ marginBottom: 0 }}>
          <div className="card-title">🧰 素材库管理</div>
          <div className="card-desc" style={{ marginBottom: 10 }}>左侧上传后可按分类筛选; 选中素材可批量操作</div>
          <button className="btn primary" onClick={async () => {
            const imgs = await pickImages();
            if (imgs.length) { await s.importImages(imgs, 'upload', 'raw'); s.toast(`已上传 ${imgs.length} 张原始素材`); }
          }}>📁 系统对话框选择…</button>
          <div className="muted small" style={{ marginTop: 10 }}>💡 单张精灵图可选中后点「去切片」直接进入生成向导</div>
        </div>
      </div>

      <div className="card">
        <div className="row" style={{ marginBottom: 14 }}>
          <input className="input" style={{ maxWidth: 240 }} placeholder="🔍 搜索素材名…" value={q} onChange={(e) => setQ(e.target.value)} />
          <div className="kind-chips">
            {([['all', '全部'], ['raw', '🖼 原始素材'], ['frame', '🎞 动画帧'], ['icon', '🏷 图标'], ['ai', '✨ AI 生成']] as const).map(([k, n]) => (
              <div key={k} className={`kind-chip ${kind === k ? 'on' : ''}`} onClick={() => setKind(k as any)}>{n}</div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 8, marginLeft: 'auto', flexWrap: 'wrap' }}>
            <button className="btn" disabled={sel.size !== 1} onClick={() => onQuickSplit(selAssets[0])}>✂️ 去切片</button>
            <button className="btn" disabled={!sel.size} onClick={mirrorSelected}>🪞 镜像选中 ({sel.size})</button>
            <button className="btn" disabled={!sel.size} onClick={() => setBindPick(true)}>🎬 绑定为动画帧</button>
            <button className="btn" disabled={sel.size !== 1} onClick={() => {
              const a = selAssets[0];
              s.update((d) => { d.meta.iconAssetId = a.id; });
              s.toast('已设为模组图标(建议正方形图)');
            }}>🏷 设为模组图标</button>
            <button className="btn" disabled={sel.size !== 1} onClick={() => setRenameFor(selAssets[0])}>✏️ 重命名</button>
            <button className="btn danger" disabled={!sel.size} onClick={() => {
              if (!confirm(`删除选中的 ${sel.size} 张素材? 已被动画引用的帧会失效!`)) return;
              s.update((d) => { d.assets = d.assets.filter((a) => !sel.has(a.id)); });
              setSel(new Set());
            }}>删除</button>
          </div>
        </div>

        {!assets.length ? <div className="empty"><div className="big">🗃</div>{p.assets.length ? '没有符合筛选条件的素材' : '素材库还是空的 —— 从上方上传第一张素材吧'}</div> : (
          <div className="asset-grid">
            {assets.map((a) => (
              <div key={a.id} className={`asset-card ${sel.has(a.id) ? 'selected' : ''}`}
                onClick={() => setSel((x) => { const n = new Set(x); n.has(a.id) ? n.delete(a.id) : n.add(a.id); return n; })}>
                <span className="src">{KIND_META[a.kind || 'raw']?.label || a.source}</span>
                <div className="im">{s.assetUrl(a.id) ? <img src={s.assetUrl(a.id)} /> : null}</div>
                <div className="nm" title={`${a.name} · ${a.w}×${a.h}`}>{a.name}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {bindPick && (
        <BindFromLibrary assets={selAssets} onClose={() => setBindPick(false)}
          onDone={() => { setBindPick(false); setSel(new Set()); }} />
      )}
      {renameFor && (
        <Modal title="重命名素材" onClose={() => setRenameFor(null)}
          footer={<><button className="btn" onClick={() => setRenameFor(null)}>取消</button>
            <button className="btn primary" onClick={() => {
              const v = (document.getElementById('asset-rename') as HTMLInputElement).value.trim();
              if (v) s.update((d) => { d.assets.find((x) => x.id === renameFor.id)!.name = v; });
              setRenameFor(null); s.toast('已重命名');
            }}>保存</button></>}>
          <Field label="素材名称"><input className="input" id="asset-rename" defaultValue={renameFor.name} autoFocus /></Field>
        </Modal>
      )}
    </div>
  );
}

/* ================= 素材生成向导 ================= */
function Wizard({ seedSheet, onSeedConsumed }: { seedSheet: { dataUrl: string; name: string } | null; onSeedConsumed: () => void }) {
  const s = useStore();
  const [step, setStep] = useState(0);
  const [sheet, setSheet] = useState<string | null>(null);
  const [sheetName, setSheetName] = useState('');
  const [frames, setFrames] = useState<DraftFrame[]>([]);
  const [cellSel, setCellSel] = useState<Set<number>>(new Set());
  const [grid, setGrid] = useState({ cols: 4, rows: 1, margin: 0, spacing: 0 });
  const [sheetSize, setSheetSize] = useState({ w: 0, h: 0 });
  const [bindOpen, setBindOpen] = useState(false);
  const steps = ['选择来源', '切分帧', '整理帧序列', '绑定动作'];

  const cellW = sheetSize.w ? Math.floor((sheetSize.w - grid.margin * 2 - grid.spacing * (grid.cols - 1)) / grid.cols) : 0;
  const cellH = sheetSize.h ? Math.floor((sheetSize.h - grid.margin * 2 - grid.spacing * (grid.rows - 1)) / grid.rows) : 0;
  const cellCount = grid.cols * grid.rows;

  const loadSheet = async (dataUrl: string, name: string) => {
    const dim = await imageSize(dataUrl);
    setSheet(dataUrl);
    setSheetName(name);
    setSheetSize(dim);
    const guessCols = Math.max(1, Math.min(16, Math.round(dim.w / Math.max(1, dim.h))));
    setGrid((g) => ({ ...g, cols: dim.w / dim.h > 1.6 ? guessCols : 1, rows: dim.w / dim.h > 1.6 ? 1 : Math.min(8, Math.round(dim.h / dim.w)) }));
    setStep(1);
  };

  useEffect(() => {
    if (sheet) {
      const set = new Set<number>();
      for (let i = 0; i < cellCount; i++) set.add(i);
      setCellSel(set);
    }
  }, [sheet, grid.cols, grid.rows]);

  // 素材库「去切片」种子
  useEffect(() => {
    if (seedSheet?.dataUrl) { loadSheet(seedSheet.dataUrl, seedSheet.name); onSeedConsumed(); }
  }, [seedSheet]);

  const doSplit = async () => {
    if (!sheet) return;
    const out: DraftFrame[] = [];
    const idx = [...cellSel].sort((a, b) => a - b);
    for (const i of idx) {
      const r = Math.floor(i / grid.cols), c = i % grid.cols;
      const x = grid.margin + c * (cellW + grid.spacing);
      const y = grid.margin + r * (cellH + grid.spacing);
      const url = await cropDataUrl(sheet, x, y, cellW, cellH);
      const d = await imageSize(url);
      out.push({ dataUrl: url, name: `${sheetName.replace(/\.[^.]+$/, '')}_${String(i).padStart(2, '0')}`, duration: 125, w: d.w, h: d.h });
    }
    setFrames(out);
    setStep(2);
    s.toast(`已切出 ${out.length} 帧`);
  };

  const mirrorFrames = async () => {
    const out: DraftFrame[] = [];
    for (const f of frames) out.push({ ...f, dataUrl: await mirrorDataUrl(f.dataUrl), name: f.name + '_R' });
    setFrames(out);
    s.toast('已整体水平镜像(适合左右方向动画复用)');
  };

  return (
    <div>
      <Stepper steps={steps} current={step} />
      {/* ---------- Step 0 来源 ---------- */}
      {step === 0 && (
        <div className="grid grid-2">
          <div className="card" style={{ marginBottom: 0 }}>
            <div className="card-title">📤 手动上传图片(推荐)</div>
            <div className="card-desc">方式 A: 逐帧序列图(多选文件, 每张是一帧) · 方式 B: 精灵图/雪碧图(多帧合在一张大图, 下一步切片)</div>
            <DropZone onFiles={async (imgs) => {
              if (imgs.length === 1) {
                const dim = await imageSize(imgs[0].dataUrl);
                if (dim.w / dim.h > 1.8 || dim.w > 900) { loadSheet(imgs[0].dataUrl, imgs[0].name); return; }
                const fs: DraftFrame[] = [];
                for (const im of imgs) { const d = await imageSize(im.dataUrl); fs.push({ dataUrl: im.dataUrl, name: im.name.replace(/\.[^.]+$/, ''), duration: 125, w: d.w, h: d.h }); }
                setFrames(fs); setStep(2);
              } else {
                const fs: DraftFrame[] = [];
                for (const im of [...imgs].sort((a, b) => a.name.localeCompare(b.name, 'zh-CN', { numeric: true }))) {
                  const d = await imageSize(im.dataUrl);
                  fs.push({ dataUrl: im.dataUrl, name: im.name.replace(/\.[^.]+$/, ''), duration: 125, w: d.w, h: d.h });
                }
                setFrames(fs); setStep(2);
                s.toast(`已导入 ${fs.length} 帧序列`);
              }
            }} />
            <div style={{ marginTop: 12 }}>
              <button className="btn" onClick={async () => { const imgs = await pickImages(); if (imgs.length === 1) { loadSheet(imgs[0].dataUrl, imgs[0].name); } else if (imgs.length) { const fs: DraftFrame[] = []; for (const im of imgs.sort((a, b) => a.name.localeCompare(b.name, 'zh-CN', { numeric: true }))) { const d = await imageSize(im.dataUrl); fs.push({ dataUrl: im.dataUrl, name: im.name.replace(/\.[^.]+$/, ''), duration: 125, w: d.w, h: d.h }); } setFrames(fs); setStep(2); } }}>
                📁 使用系统对话框选择…
              </button>
            </div>
          </div>
          <div className="card" style={{ marginBottom: 0 }}>
            <div className="card-title">✨ 其他来源</div>
            <div className="card-desc">AI 生成与素材库复用同样接入本流水线</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <button className="btn" onClick={() => s.setView('ai')}>🤖 AI 生成图片(跳转 AI 管理与生成) →</button>
              <div className="muted small">提示: AI 生成桌宠精灵图时, 建议在提示词中要求「sprite sheet, 横向排列, 透明背景, 同一角色」, 生成后回到本向导切片。</div>
            </div>
          </div>
        </div>
      )}

      {/* ---------- Step 1 切片 ---------- */}
      {step === 1 && sheet && (
        <div className="card">
          <div className="card-title">✂️ 精灵图切片 · {sheetName} ({sheetSize.w}×{sheetSize.h})</div>
          <div className="card-desc">点击格子可排除不需要的帧; 生成的帧按从左到右、从上到下排序</div>
          <div className="row" style={{ marginBottom: 16 }}>
            {([['cols', '列数'], ['rows', '行数'], ['margin', '外边距'], ['spacing', '格间距']] as const).map(([k, n]) => (
              <Field key={k} label={n}>
                <input className="input" type="number" min={1} style={{ width: 100 }} value={(grid as any)[k]}
                  onChange={(e) => setGrid({ ...grid, [k]: Math.max(0, Number(e.target.value) || 0) })} />
              </Field>
            ))}
            <div style={{ display: 'flex', gap: 8, paddingBottom: 2 }}>
              <span className="tag">格子 {cellW}×{cellH}</span>
              <span className="tag pink">已选 {cellSel.size} / {cellCount}</span>
            </div>
          </div>
          <div style={{ maxWidth: 720, position: 'relative', display: 'inline-block' }} className="checker">
            <img src={sheet} style={{ display: 'block', maxWidth: '100%' }} />
            {Array.from({ length: cellCount }).map((_, i) => {
              const r = Math.floor(i / grid.cols), c = i % grid.cols;
              const dispW = 100 / grid.cols, dispH = 100 / grid.rows;
              return (
                <div key={i} onClick={() => setCellSel((sel) => { const n = new Set(sel); n.has(i) ? n.delete(i) : n.add(i); return n; })}
                  style={{
                    position: 'absolute',
                    left: `${c * dispW}%`, top: `${r * dispH}%`, width: `${dispW}%`, height: `${dispH}%`,
                    outline: cellSel.has(i) ? '1.5px solid rgba(240,78,141,.9)' : '1.5px dashed rgba(120,100,140,.35)',
                    background: cellSel.has(i) ? 'rgba(255,111,165,.14)' : 'rgba(255,255,255,.55)',
                    cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 11, color: cellSel.has(i) ? '#f04e8d' : 'rgba(120,100,140,.5)', fontWeight: 700,
                  }}>{i + 1}</div>
              );
            })}
          </div>
          <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
            <button className="btn" onClick={() => setStep(0)}>← 上一步</button>
            <button className="btn primary" disabled={!cellSel.size || !cellW} onClick={doSplit}>✂️ 切出 {cellSel.size} 帧, 去整理 →</button>
          </div>
        </div>
      )}

      {/* ---------- Step 2 整理帧 ---------- */}
      {step === 2 && (
        <div className="card">
          <div className="card-title">🎞 帧序列整理 ({frames.length} 帧)</div>
          <div className="card-desc">拖动卡片调整顺序 · 修改每帧时长(ms) · 需要反方向动画可一键镜像生成新序列</div>
          <div className="frame-strip">
            {frames.map((f, i) => (
              <div key={i} className="frame-cell" draggable
                onDragStart={(e) => (e.dataTransfer.setData('text/plain', String(i)))}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  const from = Number(e.dataTransfer.getData('text/plain'));
                  const to = i;
                  setFrames((fs) => { const n = [...fs]; const [it] = n.splice(from, 1); n.splice(to, 0, it); return n; });
                }}>
                <button className="frame-del" onClick={() => setFrames((fs) => fs.filter((_, j) => j !== i))}>✕</button>
                <img src={f.dataUrl} />
                <div className="frame-meta">
                  <span>#{i + 1}</span>
                  <input style={{ width: 52, background: 'transparent', border: 'none', color: 'var(--text1)', fontSize: 10.5, textAlign: 'right', outline: 'none' }}
                    value={f.duration} onChange={(e) => setFrames((fs) => fs.map((x, j) => j === i ? { ...x, duration: Math.max(16, Number(e.target.value) || 125) } : x))} />
                  <span>ms</span>
                </div>
              </div>
            ))}
            {!frames.length && <div className="muted small" style={{ padding: 20 }}>没有帧, 请回到第一步</div>}
          </div>
          <div className="row" style={{ marginTop: 14 }}>
            <Field label="批量时长(ms)"><input className="input" type="number" style={{ width: 120 }} defaultValue={125} id="bulk-dur" /></Field>
            <button className="btn" onClick={() => { const v = Math.max(16, Number((document.getElementById('bulk-dur') as HTMLInputElement).value) || 125); setFrames((fs) => fs.map((f) => ({ ...f, duration: v }))); }}>应用到全部</button>
            <button className="btn" onClick={mirrorFrames}>🪞 水平镜像生成反向序列</button>
            <div style={{ marginLeft: 'auto', display: 'flex', gap: 10 }}>
              <button className="btn" onClick={() => setStep(sheet ? 1 : 0)}>← 上一步</button>
              <button className="btn primary" disabled={!frames.length} onClick={() => setBindOpen(true)}>🎯 绑定到动作 →</button>
            </div>
          </div>
        </div>
      )}

      {/* ---------- Step 3 绑定 ---------- */}
      {step === 3 && (
        <div className="card">
          <div className="card-title">✅ 完成</div>
          <div className="card-desc">帧序列已入库并绑定动作, 可前往动画工坊预览或继续制作</div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button className="btn primary" onClick={() => s.setView('anime')}>🎬 去动画工坊预览</button>
            <button className="btn" onClick={() => { setFrames([]); setSheet(null); setStep(0); }}>🔄 再做一组动画</button>
          </div>
        </div>
      )}

      {bindOpen && (
        <BindModal frames={frames} onClose={() => setBindOpen(false)} onDone={() => { setBindOpen(false); setStep(3); }} />
      )}
    </div>
  );
}

/* ================= 绑定动作弹窗 ================= */
function BindModal({ frames, onClose, onDone }: { frames: DraftFrame[]; onClose: () => void; onDone: () => void }) {
  const s = useStore();
  const pet = s.activePet!;
  const [gId, setGId] = useState('Default');
  const [mode, setMode] = useState<ModeId>('Nomal');
  const [animat, setAnimat] = useState<AnimatId>('Single');
  const [name, setName] = useState('Default');
  const [busy, setBusy] = useState(false);
  const g = graphMeta(gId)!;
  const animats = animatsFor(g.layout);

  useEffect(() => {
    setAnimat(animatsFor(graphMeta(gId)!.layout)[0]);
    const defaultName: Record<string, string> = { Default: 'Default', Move: 'Walk_Left', Work: 'Work_Read', Common: 'RandomAct' };
    setName(defaultName[gId] || gId);
  }, [gId]);

  const suggest = s.project!.animations.filter((a) => a.petId === pet.id && a.graphType === gId && a.mode === mode && a.animat === animat).length;

  const submit = async () => {
    setBusy(true);
    try {
      const assets = await s.importImages(
        frames.map((f, i) => ({ name: `${name}_${String(i).padStart(3, '0')}.png`, dataUrl: f.dataUrl })),
        'split', 'frame'
      );
      const entry: AnimationEntry = {
        id: newId('an'), name, graphType: gId, mode, animat,
        variantIndex: suggest,
        petId: pet.id,
        frames: frames.map((f, i) => ({ assetId: assets[i].id, duration: f.duration })),
      };
      s.update((d) => { d.animations.push(entry); });
      s.toast(`已绑定 ${frames.length} 帧 → ${pet.i18nName} 的 ${g.label}`);
      onDone();
    } finally { setBusy(false); }
  };

  return (
    <Modal title="🎯 绑定动作" onClose={onClose} wide
      footer={<><button className="btn" onClick={onClose}>取消</button>
        <button className="btn primary" disabled={busy || !name.trim()} onClick={submit}>{busy ? '处理中…' : `入库并绑定 ${frames.length} 帧`}</button></>}>
      <div className="grid grid-2">
        <div>
          <div className="tag pink" style={{ marginBottom: 10 }}>目标宠物: {pet.i18nName}（多宠物时可在左侧切换器更换）</div>
          <Field label="动作类型" hint={g.desc}>
            <select className="select" value={gId} onChange={(e) => setGId(e.target.value)}>
              {GRAPH_CATEGORIES.map((cat) => (
                <optgroup key={cat} label={cat}>
                  {GRAPHS.filter((x) => x.category === cat).map((x) => (
                    <option key={x.id} value={x.id}>{x.label} ({x.id}){x.required ? ' *' : ''}</option>
                  ))}
                </optgroup>
              ))}
            </select>
          </Field>
          <Field label="身体状态" hint="同一动作的每个状态可以有不同的动画; 只做一套时选「普通」, 其余状态自动回落">
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {MODES.map((m) => (
                <button key={m.id} className={`btn sm ${mode === m.id ? 'primary' : ''}`} onClick={() => setMode(m.id)}>{m.label}</button>
              ))}
            </div>
          </Field>
          <Field label="段落" hint={animats.length === 1 ? '该动作为一段式' : '三段式: A 起手 → B 循环 → C 结束, 需分别绑定帧序列'}>
            <div style={{ display: 'flex', gap: 8 }}>
              {animats.map((a) => {
                const meta = { A_Start: ['A · 开始'], B_Loop: ['B · 循环'], C_End: ['C · 结束'], Single: ['单段'] }[a]!;
                return <button key={a} className={`btn sm ${animat === a ? 'primary' : ''}`} onClick={() => setAnimat(a)}>{meta[0]}</button>;
              })}
            </div>
          </Field>
          <Field label="动画名称" hint={g.layout === 'named' || g.layout === 'common' ? '具名动画: 如 Walk_Left / Work_Read / Squat, 移动与工作配置按名称引用' : '该类型下名称仅用于展示'}>
            <input className="input mono" value={name} onChange={(e) => setName(e.target.value.replace(/[\\/:*?"<>|#:|]/g, '_'))} />
          </Field>
          {!!suggest && <div className="tag amber">该槽位已有 {suggest} 个变体, 本次将作为随机变体 #{suggest} 加入(同名变体会被随机播放)</div>}
        </div>
        <div>
          <div className="field"><label>帧预览 ({frames.length} 帧)</label></div>
          <div className="frame-strip" style={{ flexWrap: 'wrap', maxHeight: 300, overflowY: 'auto' }}>
            {frames.map((f, i) => (
              <div key={i} className="frame-cell"><img src={f.dataUrl} /><div className="frame-meta"><span>#{i + 1}</span><span>{f.duration}ms</span></div></div>
            ))}
          </div>
        </div>
      </div>
    </Modal>
  );
}

/* ================= 从素材库绑定 ================= */
function BindFromLibrary({ assets, onClose, onDone }: { assets: Asset[]; onClose: () => void; onDone: () => void }) {
  const s = useStore();
  const pet = s.activePet!;
  const [durations, setDurations] = useState<number[]>(() => assets.map(() => 125));
  const [gId, setGId] = useState('Default');
  const [mode, setMode] = useState<ModeId>('Nomal');
  const [animat, setAnimat] = useState<AnimatId>('Single');
  const [name, setName] = useState('Default');
  const g = graphMeta(gId)!;
  const animats = animatsFor(g.layout);
  useEffect(() => { setAnimat(animatsFor(graphMeta(gId)!.layout)[0]); }, [gId]);

  const submit = () => {
    const variant = s.project!.animations.filter((a) => a.petId === pet.id && a.graphType === gId && a.mode === mode && a.animat === animat).length;
    s.update((d) => {
      d.animations.push({
        id: newId('an'), name, graphType: gId, mode, animat, variantIndex: variant, petId: pet.id,
        frames: assets.map((a, i) => ({ assetId: a.id, duration: durations[i] })),
      });
    });
    s.toast(`已绑定 ${assets.length} 帧 → ${pet.i18nName} 的 ${g.label}`);
    onDone();
  };

  return (
    <Modal title={`绑定 ${assets.length} 张素材为动画帧`} onClose={onClose} wide
      footer={<><button className="btn" onClick={onClose}>取消</button>
        <button className="btn primary" disabled={!name.trim()} onClick={submit}>绑定 {assets.length} 帧</button></>}>
      <div className="grid grid-2">
        <div>
          <div className="tag pink" style={{ marginBottom: 10 }}>目标宠物: {pet.i18nName}</div>
          <Field label="动作类型" hint={g.desc}>
            <select className="select" value={gId} onChange={(e) => setGId(e.target.value)}>
              {GRAPH_CATEGORIES.map((cat) => (
                <optgroup key={cat} label={cat}>
                  {GRAPHS.filter((x) => x.category === cat).map((x) => <option key={x.id} value={x.id}>{x.label} ({x.id})</option>)}
                </optgroup>
              ))}
            </select>
          </Field>
          <Field label="身体状态">
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {MODES.map((m) => <button key={m.id} className={`btn sm ${mode === m.id ? 'primary' : ''}`} onClick={() => setMode(m.id)}>{m.label}</button>)}
            </div>
          </Field>
          <Field label="段落">
            <div style={{ display: 'flex', gap: 8 }}>
              {animats.map((a) => (
                <button key={a} className={`btn sm ${animat === a ? 'primary' : ''}`} onClick={() => setAnimat(a)}>
                  {{ A_Start: 'A · 开始', B_Loop: 'B · 循环', C_End: 'C · 结束', Single: '单段' }[a]}
                </button>
              ))}
            </div>
          </Field>
          <Field label="动画名称">
            <input className="input mono" value={name} onChange={(e) => setName(e.target.value.replace(/[\\/:*?"<>|]/g, '_'))} />
          </Field>
        </div>
        <div>
          <div className="field"><label>帧与时长 ({assets.length} 帧, 按选择顺序)</label></div>
          <div className="frame-strip" style={{ flexWrap: 'wrap', maxHeight: 300, overflowY: 'auto' }}>
            {assets.map((a, i) => (
              <div key={a.id} className="frame-cell">
                {s.assetUrl(a.id) ? <img src={s.assetUrl(a.id)} /> : <div style={{ height: 78 }} />}
                <div className="frame-meta"><span>#{i + 1}</span>
                  <input style={{ width: 52, background: 'transparent', border: 'none', color: 'var(--text1)', fontSize: 10.5, textAlign: 'right', outline: 'none' }}
                    value={durations[i]} onChange={(e) => setDurations(durations.map((d, j) => j === i ? Math.max(16, Number(e.target.value) || 125) : d))} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Modal>
  );
}
