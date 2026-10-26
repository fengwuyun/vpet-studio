import React, { useMemo, useState } from 'react';
import { useStore } from '../lib/store';
import { validate, buildExport, buildTree, buildPayload } from '../lib/engine';
import { backend } from '../lib/backend';

export default function ExportView() {
  const s = useStore();
  const p = s.project!;
  const v = useMemo(() => validate(p), [p]);
  const files = useMemo(() => buildExport(p), [p]);
  const tree = useMemo(() => buildTree(files), [files]);
  const [zip, setZip] = useState(true);
  const [busy, setBusy] = useState(false);
  const [log, setLog] = useState<string[]>([]);

  const doExport = async () => {
    setBusy(true);
    setLog(['⏳ 正在选择导出位置…']);
    try {
      const dir = await backend.pickSaveDir();
      if (!dir) { setLog([]); setBusy(false); return; }
      // 组装文件载荷: 桌面版只传 fileName 引用由主进程从磁盘读取; 浏览器演示模式附带 dataURL
      const payload = { files: buildPayload(p, { isDesktop: backend.isDesktop, assetUrl: s.assetUrl }) };
      const missing = payload.files.filter((x) => x.kind === 'asset' && !x.content && !x.fileName).length;
      const r = await backend.exportMod(p.meta.id, dir, payload, zip);
      setLog([
        missing ? `⚠️ ${missing} 个素材文件缺失(可能已被删除), 请检查` : '✓ 素材文件全部就位',
        ...r.log.map((l) => (l.startsWith('+') ? `  ${l}` : l)),
        `✅ 导出完成 → ${r.dir}`,
        ...(r.zipPath ? [`📦 压缩包 → ${r.zipPath}`] : []),
        '',
        '📌 接下来: 把导出的文件夹/压缩包放入 VPet 游戏目录下的 mod/ 文件夹, 重启游戏即可在「模组设置」中启用。',
      ]);
      s.toast('模组导出成功');
    } catch (e: any) {
      setLog(['✕ 导出失败: ' + (e?.message || e)]);
      s.toast('导出失败', 'err');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid grid-2">
      <div>
        <div className="card">
          <div className="card-title">{v.ok ? '✅ 校验通过' : '❌ 校验未通过'}
            <span className={`tag ${v.ok ? 'green' : 'red'}`} style={{ marginLeft: 'auto' }}>{v.errors.length} 错误 / {v.warnings.length} 建议</span>
          </div>
          <div className="card-desc">错误项会导致游戏无法正常加载模组; 建议项影响体验但可导出</div>
          {v.errors.map((e, i) => <div key={i} className="tag red" style={{ display: 'block', marginBottom: 6, padding: '6px 10px' }}>✕ {e}</div>)}
          {v.warnings.map((w, i) => <div key={i} className="tag amber" style={{ display: 'block', marginBottom: 6, padding: '6px 10px' }}>! {w}</div>)}
          {!v.errors.length && !v.warnings.length && <div className="empty" style={{ padding: 20 }}>一切就绪, 可以导出 🎉</div>}
        </div>

        <div className="card">
          <div className="card-title">📦 导出</div>
          <div className="card-desc">生成 VPet 模组目录(info.lps + pet + lang + food + text + icon)并可选打包 zip</div>
          <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13, marginBottom: 14 }}>
            <input type="checkbox" checked={zip} onChange={(e) => setZip(e.target.checked)} />
            同时生成 .zip 压缩包(适合上传创意工坊/分享)
          </label>
          <button className="btn primary" disabled={busy || !v.ok} onClick={doExport}>{busy ? '导出中…' : `📦 导出模组 (${files.size} 个文件)`}</button>
          <div className="muted small" style={{ marginTop: 10 }}>
            导出目标将创建: <span className="mono">所选目录/{p.meta.id}/</span>
          </div>
        </div>

        {!!log.length && (
          <div className="card">
            <div className="card-title">🧾 导出日志</div>
            <div className="dirtree">{log.join('\n')}</div>
          </div>
        )}
      </div>

      <div className="card">
        <div className="card-title">🌳 模组目录结构预览 <span className="tag">{files.size} 文件</span></div>
        <div className="card-desc">与 VPet 官方 ModMaker 输出结构一致</div>
        <div className="dirtree">{tree}</div>
      </div>
    </div>
  );
}
