import React, { useEffect, useMemo, useState } from 'react';
import { useStore } from '../lib/store';
import { FramePlayer, AssetPicker, Field } from '../components/ui';
import { pickImages } from '../lib/backend';
import { GRAPHS, GRAPH_CATEGORIES, MODES, animatsFor, graphMeta, animRelDir } from '../lib/graphMeta';
import type { AnimationEntry, AnimatId, ModeId } from '../lib/types';
import { newId } from '../lib/types';

export default function AnimeView() {
  const s = useStore();
  const p = s.project!;
  const pet = s.activePet!;
  const [gId, setGId] = useState('Default');
  const [mode, setMode] = useState<ModeId>('Nomal');
  const [animat, setAnimat] = useState<AnimatId>('Single');
  const g = graphMeta(gId)!;
  const animats = animatsFor(g.layout);

  useEffect(() => { setAnimat(animatsFor(graphMeta(gId)!.layout)[0]); }, [gId]);

  const entries = p.animations.filter((a) => a.petId === pet.id && a.graphType === gId && a.mode === mode && a.animat === animat);
  const [curId, setCurId] = useState<string | null>(null);
  const cur = entries.find((e) => e.id === curId) || entries[0] || null;

  // 预览数据: 三段连播 (A → B×3 → C)
  const previewUrls = useMemo(() => {
    const get = (e: AnimationEntry | undefined) => (e ? e.frames.map((f) => s.assetUrl(f.assetId)).filter(Boolean) : []);
    const durs = (e: AnimationEntry | undefined) => (e ? e.frames.map((f) => f.duration) : []);
    if (!cur) return { urls: [] as string[], durations: [] as number[], loop: 'loop' as const };
    if (g.layout === 'single' || g.layout === 'switch' || g.layout === 'raiseDynamic') {
      return { urls: get(cur), durations: durs(cur), loop: 'loop' as const };
    }
    const A = entries.find((e) => e.animat === 'A_Start');
    const B = entries.find((e) => e.animat === 'B_Loop');
    const C = entries.find((e) => e.animat === 'C_End');
    const base = cur.animat === 'A_Start' ? A : cur.animat === 'B_Loop' ? B : C;
    if (!base) return { urls: get(cur), durations: durs(cur), loop: 'loop' as const };
    const urls = [...get(A), ...get(B), ...get(B), ...get(C)].filter((x: any) => x);
    const durations = [...durs(A), ...durs(B), ...durs(B), ...durs(C)];
    return { urls: urls.length ? urls : get(cur), durations, loop: 'loop' as const };
  }, [cur, entries, s.project, g.layout]);

  const cntOf = (gid: string) => p.animations.filter((a) => a.petId === pet.id && a.graphType === gid && a.frames.length).length;

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '216px 1fr 330px', gap: 16 }}>
      {/* 左: 动作树 */}
      <div className="card" style={{ padding: '10px 8px', marginBottom: 0, maxHeight: 'calc(100vh - 150px)', overflowY: 'auto' }}>
        <div className="tree">
          {GRAPH_CATEGORIES.map((cat) => (
            <React.Fragment key={cat}>
              <div className="tree-cat">{cat}</div>
              {GRAPHS.filter((x) => x.category === cat).map((x) => (
                <div key={x.id} className={`tree-item ${gId === x.id ? 'active' : ''}`} onClick={() => setGId(x.id)}>
                  <span>{cntOf(x.id) ? '🟢' : '⚪'}</span>
                  <span style={{ flex: 1 }}>{x.label}{x.required && <span className="req-star"> *</span>}</span>
                  <span className="cnt">{cntOf(x.id) || ''}</span>
                </div>
              ))}
            </React.Fragment>
          ))}
        </div>
      </div>

      {/* 中: 配置 */}
      <div>
        <div className="card">
          <div className="card-title">{g.label} <span className="tag">{g.id}</span>{g.required && <span className="tag red">必备</span>}</div>
          <div className="card-desc">{g.desc} · 导出目录: <span className="mono">pet/{pet.id}/{animRelDir(g, { name: '动画名', mode, animat })}/动画名_000_时长.png</span>{p.pets.length > 1 && <span className="tag pink" style={{ marginLeft: 6 }}>当前宠物: {pet.i18nName}</span>}</div>

          {/* 状态 & 段落 */}
          <div style={{ display: 'flex', gap: 10, marginBottom: 12, flexWrap: 'wrap', alignItems: 'center' }}>
            {MODES.map((m) => (
              <button key={m.id} className={`btn sm ${mode === m.id ? 'primary' : ''}`} onClick={() => setMode(m.id)}>{m.label}</button>
            ))}
            <span style={{ color: 'var(--text2)' }}>|</span>
            {animats.map((a) => (
              <button key={a} className={`btn sm ${animat === a ? 'primary' : ''}`} onClick={() => setAnimat(a)}
                title={{ A_Start: '起手帧, 播完进循环', B_Loop: '循环主体', C_End: '收尾帧', Single: '一段式' }[a]}>
                {{ A_Start: 'A 开始', B_Loop: 'B 循环', C_End: 'C 结束', Single: '单段' }[a]}
              </button>
            ))}
          </div>

          {/* 变体列表 */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
            {entries.map((e, i) => (
              <span key={e.id} className={`tag ${cur?.id === e.id ? 'blue' : ''}`} style={{ cursor: 'pointer', padding: '5px 12px' }}
                onClick={() => setCurId(e.id)}>
                #{i} {e.name} · {e.frames.length}帧
                <span onClick={(ev) => { ev.stopPropagation(); if (confirm(`删除变体「${e.name}」?`)) s.update((d) => { d.animations = d.animations.filter((x) => x.id !== e.id); }); }}
                  style={{ marginLeft: 4, color: 'var(--red)' }}>✕</span>
              </span>
            ))}
            <button className="btn sm" onClick={() => {
              const variant = entries.length;
              const name = g.layout === 'named' || g.layout === 'common' ? `${g.id}_${variant}` : (g.id === 'Default' ? 'Default' : g.id);
              s.update((d) => {
                d.animations.push({ id: newId('an'), name, graphType: gId, mode, animat, variantIndex: variant, frames: [], petId: pet.id });
              });
              s.toast('已创建空变体, 现在添加帧');
            }}>＋ 新变体</button>
          </div>

          {cur ? (
            <>
              <div className="row" style={{ marginBottom: 12 }}>
                <Field label="动画名称" hint={(g.layout === 'named' || g.layout === 'common') ? '移动/工作等具名动画按此名称被引用' : undefined}>
                  <input className="input mono" value={cur.name} style={{ width: 220 }}
                    onChange={(e) => s.update((d) => { d.animations.find((x) => x.id === cur.id)!.name = e.target.value.replace(/[\\/:*?"<>|]/g, '_'); })} />
                </Field>
                <button className="btn" onClick={async () => {
                  const imgs = await pickImages();
                  if (!imgs.length) return;
                  const assets = await s.importImages(imgs.sort((a, b) => a.name.localeCompare(b.name, 'zh-CN', { numeric: true })), 'upload');
                  s.update((d) => { d.animations.find((x) => x.id === cur.id)!.frames.push(...assets.map((a) => ({ assetId: a.id, duration: 125 }))); });
                  s.toast(`追加了 ${assets.length} 帧`);
                }}>📤 直接上传帧</button>
                <AddFromLibrary onAdd={(assets, durations) => s.update((d) => {
                  const e = d.animations.find((x) => x.id === cur.id)!;
                  e.frames.push(...assets.map((a, i) => ({ assetId: a.id, duration: durations[i] })));
                })} />
              </div>

              <div className="frame-strip">
                {cur.frames.map((f, i) => (
                  <div key={i} className="frame-cell" draggable
                    onDragStart={(e) => e.dataTransfer.setData('text/plain', String(i))}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => {
                      e.preventDefault();
                      const from = Number(e.dataTransfer.getData('text/plain'));
                      s.update((d) => {
                        const e2 = d.animations.find((x) => x.id === cur.id)!;
                        const [it] = e2.frames.splice(from, 1);
                        e2.frames.splice(i, 0, it);
                      });
                    }}>
                    <button className="frame-del" onClick={() => s.update((d) => { d.animations.find((x) => x.id === cur.id)!.frames.splice(i, 1); })}>✕</button>
                    {s.assetUrl(f.assetId) ? <img src={s.assetUrl(f.assetId)} /> : <div style={{ height: 78 }} />}
                    <div className="frame-meta"><span>#{i + 1}</span>
                      <input style={{ width: 52, background: 'transparent', border: 'none', color: 'var(--text1)', fontSize: 10.5, textAlign: 'right', outline: 'none' }}
                        value={f.duration} onChange={(e) => s.update((d) => { d.animations.find((x) => x.id === cur.id)!.frames[i].duration = Math.max(16, Number(e.target.value) || 125); })} />
                    </div>
                  </div>
                ))}
                {!cur.frames.length && <div className="muted small" style={{ padding: 22 }}>暂无帧 —— 「直接上传帧」或「从素材库添加」</div>}
              </div>
            </>
          ) : (
            <div className="empty"><div className="big">🎬</div>该槽位还没有动画变体<br />点击「＋ 新变体」创建, 或前往 <b>素材工坊</b> 用生成向导一站式完成</div>
          )}
        </div>
      </div>

      {/* 右: 预览 */}
      <div>
        <div className="card" style={{ position: 'sticky', top: 0, marginBottom: 12 }}>
          <div className="card-title">▶️ 实时预览</div>
          <div className="card-desc">{animats.length > 1 && cur ? '三段连播模拟: A → B×2 → C' : '循环播放当前帧序列'}</div>
          <FramePlayer urls={previewUrls.urls} durations={previewUrls.durations} height={300} loopMode="loop" />
        </div>
        {animats.length > 1 && (
          <div className="card">
            <div className="card-title">分段清单</div>
            {(['A_Start', 'B_Loop', 'C_End'] as AnimatId[]).map((a) => {
              const e = entries.find((x) => x.animat === a);
              return (
                <div key={a} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 0', borderBottom: '1px solid rgba(38,46,64,.4)' }}>
                  <span className={`tag ${e ? 'green' : ''}`}>{a[0]}</span>
                  <span className="small">{e ? `${e.name} · ${e.frames.length} 帧` : '未配置'}</span>
                </div>
              );
            })}
            <div className="muted small" style={{ marginTop: 8 }}>A/B/C 齐全时互动动画衔接最自然; 只有 B 也能工作</div>
          </div>
        )}
      </div>
    </div>
  );
}

function AddFromLibrary({ onAdd }: { onAdd: (assets: any[], durations: number[]) => void }) {
  const s = useStore();
  const [open, setOpen] = useState(false);
  return (
    <>
      <button className="btn" onClick={() => setOpen(true)}>🗂 从素材库添加</button>
      {open && (
        <AssetPicker multi onClose={() => setOpen(false)} onPick={(assets) => {
          setOpen(false);
          onAdd(assets, assets.map(() => 125));
          s.toast(`添加了 ${assets.length} 帧`);
        }} />
      )}
    </>
  );
}
