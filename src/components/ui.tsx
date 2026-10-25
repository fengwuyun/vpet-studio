// ============ 共享 UI 组件 ============
import React, { useEffect, useRef, useState } from 'react';
import { useStore } from '../lib/store';
import { backend, fileToDataUrl } from '../lib/backend';
import type { Asset } from '../lib/types';

export function Modal({ title, onClose, children, footer, wide }: any) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);
  return (
    <div className="modal-mask" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`modal ${wide ? 'wide' : ''}`}>
        <div className="modal-head">
          <span>{title}</span>
          <button className="btn ghost sm" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>
  );
}

export function Field({ label, hint, children }: any) {
  return (
    <div className="field">
      {label && <label>{label}</label>}
      {children}
      {hint && <div className="hint">{hint}</div>}
    </div>
  );
}

/** 通用图片拖拽/点击上传区 —— 手动上传素材的统一入口 */
export function DropZone({ onFiles, title, sub, compact }: {
  onFiles: (imgs: { name: string; dataUrl: string }[]) => void;
  title?: string; sub?: string; compact?: boolean;
}) {
  const [over, setOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const handle = async (files: FileList | null) => {
    if (!files?.length) return;
    const imgs: { name: string; dataUrl: string }[] = [];
    for (const f of Array.from(files)) {
      if (!/image\/(png|jpeg|webp)/.test(f.type)) continue;
      imgs.push({ name: f.name, dataUrl: await fileToDataUrl(f) });
    }
    if (imgs.length) onFiles(imgs);
  };
  return (
    <div
      className={`dropzone ${over ? 'over' : ''}`}
      style={compact ? { padding: '18px 16px' } : undefined}
      onClick={() => inputRef.current?.click()}
      onDragOver={(e) => { e.preventDefault(); setOver(true); }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => { e.preventDefault(); setOver(false); handle(e.dataTransfer.files); }}
    >
      <input ref={inputRef} type="file" accept="image/png,image/jpeg,image/webp" multiple hidden onChange={(e) => { handle(e.target.files); e.currentTarget.value = ''; }} />
      <div className="ic">{compact ? '🖼' : '⬆️'}</div>
      <div className="t1">{title || '拖拽图片到此处, 或点击选择文件'}</div>
      <div className="t2">{sub || '支持 PNG(推荐透明底) / JPG / WebP, 可多选 · 逐帧原图或精灵图均可'}</div>
    </div>
  );
}

/** 系统文件选择(桌面版走原生对话框) — 统一从 backend.ts 导入 */

export function Stepper({ steps, current }: { steps: string[]; current: number }) {
  return (
    <div className="steps">
      {steps.map((s, i) => (
        <React.Fragment key={s}>
          <div className={`step ${i === current ? 'active' : i < current ? 'done' : ''}`}>
            <div className="n">{i < current ? '✓' : i + 1}</div>{s}
          </div>
          {i < steps.length - 1 && <div className={`step-line ${i < current ? 'done' : ''}`} />}
        </React.Fragment>
      ))}
    </div>
  );
}

/** 素材多选弹窗(从素材库挑帧) */
export function AssetPicker({ multi, onClose, onPick }: {
  multi?: boolean; onClose: () => void; onPick: (assets: Asset[]) => void;
}) {
  const s = useStore();
  const [sel, setSel] = useState<string[]>([]);
  const [q, setQ] = useState('');
  useEffect(() => { s.loadAssetUrls(s.project!.assets); }, []);
  const assets = (s.project?.assets || []).filter((a) => !q || a.name.toLowerCase().includes(q.toLowerCase()));
  return (
    <Modal
      title={`从素材库选择 ${multi ? '(可多选)' : ''}`}
      onClose={onClose}
      wide
      footer={<>
        <button className="btn" onClick={onClose}>取消</button>
        <button className="btn primary" disabled={!sel.length} onClick={() => onPick(assets.filter((a) => sel.includes(a.id)))}>
          确定 ({sel.length})
        </button>
      </>}
    >
      <div className="field"><input className="input" placeholder="搜索素材名…" value={q} onChange={(e) => setQ(e.target.value)} /></div>
      {!assets.length ? <div className="empty"><div className="big">🗃</div>素材库为空, 请先到「素材工坊」上传或生成素材</div> : (
        <div className="pick-list">
          {assets.map((a) => (
            <div key={a.id} className={`pick-item ${sel.includes(a.id) ? 'selected' : ''}`}
              onClick={() => setSel(multi ? (sel.includes(a.id) ? sel.filter((x) => x !== a.id) : [...sel, a.id]) : [a.id])}>
              {s.assetUrl(a.id) ? <img src={s.assetUrl(a.id)} /> : <div style={{ height: 66 }} />}
              <div className="nm" style={{ fontSize: 10.5, textAlign: 'center', padding: '3px 2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.name}</div>
            </div>
          ))}
        </div>
      )}
    </Modal>
  );
}

/** 帧序列播放器 */
export function FramePlayer({ urls, durations, height, loopMode }: {
  urls: string[]; durations: number[]; height?: number; loopMode?: 'loop' | 'once' | 'abc';
}) {
  const [idx, setIdx] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [speed, setSpeed] = useState(1);
  const raf = useRef<any>(null);
  const acc = useRef(0);
  const last = useRef(0);

  useEffect(() => { setIdx(0); }, [urls.length]);

  useEffect(() => {
    if (!playing || !urls.length) return;
    last.current = performance.now();
    const tick = (t: number) => {
      const dt = t - last.current;
      last.current = t;
      acc.current += dt * speed;
      const dur = Math.max(20, durations[idx] || 125);
      if (acc.current >= dur) {
        acc.current = 0;
        setIdx((i) => {
          const next = i + 1;
          if (next >= urls.length) {
            if (loopMode === 'once') { setPlaying(false); return i; }
            return 0;
          }
          return next;
        });
      }
      raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [playing, idx, speed, urls.length, durations, loopMode]);

  const total = durations.reduce((a, b) => a + (b || 125), 0);
  return (
    <div>
      <div className="player checker" style={{ minHeight: height || 320 }}>
        {urls.length ? <img className="frame" src={urls[Math.min(idx, urls.length - 1)]} /> : <div className="muted small">无帧可预览</div>}
        <span style={{ position: 'absolute', left: 10, bottom: 8 }} className="tag">{urls.length ? `${idx + 1} / ${urls.length} 帧` : ''}</span>
      </div>
      <div className="player-bar">
        <button className="btn sm" onClick={() => { setPlaying(!playing); }}>{playing ? '⏸ 暂停' : '▶ 播放'}</button>
        <button className="btn sm" onClick={() => { setPlaying(false); setIdx((i) => (i - 1 + urls.length) % urls.length); }}>◀ 上一帧</button>
        <button className="btn sm" onClick={() => { setPlaying(false); setIdx((i) => (i + 1) % urls.length); }}>下一帧 ▶</button>
        <div className="speed-pill">
          {[0.25, 0.5, 1, 2].map((x) => (
            <button key={x} className={speed === x ? 'on' : ''} onClick={() => setSpeed(x)}>{x}x</button>
          ))}
        </div>
        <span className="muted small">总时长 ≈ {(total / 1000).toFixed(2)}s</span>
      </div>
    </div>
  );
}
