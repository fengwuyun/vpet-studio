import React, { useEffect, useState } from 'react';
import { useStore } from '../lib/store';
import { Field, DropZone, AssetPicker } from '../components/ui';
import { CULTURES } from '../lib/graphMeta';
import type { Asset } from '../lib/types';

/** 图标裁剪为 500x500 PNG */
async function makeIcon(src: string): Promise<string> {
  const img = new Image();
  await new Promise((r) => { img.onload = r; img.onerror = r; img.src = src; });
  const c = document.createElement('canvas');
  c.width = 500; c.height = 500;
  const ctx = c.getContext('2d')!;
  const side = Math.min(img.naturalWidth, img.naturalHeight);
  ctx.drawImage(img, (img.naturalWidth - side) / 2, (img.naturalHeight - side) / 2, side, side, 0, 0, 500, 500);
  return c.toDataURL('image/png');
}

export default function PetInfoView() {
  const s = useStore();
  const p = s.project!;
  const pet = s.activePet!;
  const [pickIcon, setPickIcon] = useState(false);
  const [cultures, setCultures] = useState<string[]>(Object.keys(p.i18n));

  useEffect(() => {
    if (p.meta.iconAssetId) s.loadAssetUrls(p.assets.filter((a) => a.id === p.meta.iconAssetId));
  }, [p.meta.iconAssetId]);

  const upPet = (fn: (pet: any) => void) => s.update((d) => { fn(d.pets.find((x) => x.id === pet.id)); });

  const setIcon = async (assets: Asset[]) => {
    if (!assets.length) return;
    const url = s.assetUrl(assets[0].id) || '';
    if (!url) return s.toast('素材加载失败', 'err');
    const dataUrl = await makeIcon(url);
    const [iconAsset] = await s.importImages([{ name: 'icon.png', dataUrl }], 'split', 'icon');
    s.update((d) => { d.meta.iconAssetId = iconAsset.id; });
    s.toast('模组图标已设置(自动裁剪为 500×500)');
  };

  const rectField = (label: string, rect: any, onSet: (r: any) => void, hint?: string) => (
    <div className="field">
      <label>{label}</label>
      <div style={{ display: 'flex', gap: 8 }}>
        {[['x', 'X'], ['y', 'Y'], ['w', '宽'], ['h', '高']].map(([k, n]) => (
          <input key={k} className="input" type="number" style={{ width: 90 }} value={rect[k]}
            onChange={(e) => onSet({ ...rect, [k]: Number(e.target.value) || 0 })} placeholder={n} />
        ))}
      </div>
      {hint && <div className="hint">{hint}</div>}
    </div>
  );

  return (
    <div>
      {p.pets.length > 1 && (
        <div className="card" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 22 }}>🐱</span>
          <div style={{ flex: 1 }}>
            正在编辑 <b>{pet.i18nName || pet.id}</b>
            <span className="muted small">（本模组共 {p.pets.length} 只宠物，可在左侧顶部切换器切换或添加）</span>
          </div>
          <button className="btn sm" onClick={() => s.setView('overview')}>回工作台</button>
        </div>
      )}

      <div className="grid grid-2">
        {/* 基础资料 */}
        <div className="card">
          <div className="card-title">🐱 宠物基础资料</div>
          <div className="card-desc">写入 info.lps 与 lang 多语言文件; 每只宠物有独立的目录 pet/<span className="mono">{pet.id}</span>/</div>

          <div style={{ display: 'flex', gap: 18, alignItems: 'center', marginBottom: 16 }}>
            <div className="checker" style={{ width: 96, height: 96, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              {p.meta.iconAssetId && s.assetUrl(p.meta.iconAssetId)
                ? <img src={s.assetUrl(p.meta.iconAssetId)} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                : <span style={{ fontSize: 30 }}>🖼</span>}
            </div>
            <div style={{ flex: 1 }}>
              <div className="field" style={{ marginBottom: 10 }}>
                <label>模组图标 icon.png</label>
                <div className="hint">建议 500×500, 会显示在游戏模组列表与创意工坊</div>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn sm primary" onClick={() => setPickIcon(true)}>从素材库选择</button>
              </div>
            </div>
          </div>

          <Field label="宠物名称">
            <input className="input" value={pet.i18nName} onChange={(e) => { const v = e.target.value; upPet((x) => { x.i18nName = v; }); s.update((d) => { d.i18n['zh-CN'][`${pet.id}_PetName`] = v; }); }} />
          </Field>
          <Field label="宠物介绍" hint="显示在宠物选择界面">
            <textarea className="input" value={pet.i18nIntro} onChange={(e) => { const v = e.target.value; upPet((x) => { x.i18nIntro = v; }); s.update((d) => { d.i18n['zh-CN'][`${pet.id}_Description`] = v; }); }} />
          </Field>
          <div className="row">
            <Field label="作者">
              <input className="input" value={p.meta.author} onChange={(e) => s.update((d) => { d.meta.author = e.target.value; })} />
            </Field>
            <Field label="版本号" hint="如 1.0.0">
              <input className="input mono" value={p.meta.version} onChange={(e) => s.update((d) => { d.meta.version = e.target.value; })} />
            </Field>
            <Field label="适配游戏版本" hint="当前主流: 1.10+">
              <input className="input mono" value={p.meta.gameVersion} onChange={(e) => s.update((d) => { d.meta.gameVersion = e.target.value; })} />
            </Field>
          </div>
          <Field label="模组标签" hint="逗号分隔, 用于创意工坊分类检索">
            <input className="input" value={p.meta.tags} onChange={(e) => s.update((d) => { d.meta.tags = e.target.value; })} placeholder="猫猫,二次元,原创" />
          </Field>
        </div>

        {/* 互动判定区 */}
        <div className="card">
          <div className="card-title">👆 互动判定区(相对坐标 px)</div>
          <div className="card-desc">
            以「普通状态」帧的站立图为基准(原点=图片左上角)。摸头/摸身区域是点击判定框; 提起判定区决定拖拽时抓取的位置, 提起点是提起时鼠标相对图片的锚点。
            一般默认值即可工作, 精细调整可参考素材尺寸。
          </div>
          {rectField('摸头判定区 touchhead', pet.touchHead, (r) => upPet((x) => { x.touchHead = r; }))}
          {rectField('摸身体判定区 touchbody', pet.touchBody, (r) => upPet((x) => { x.touchBody = r; }))}
          <div className="card-title" style={{ fontSize: 13, marginTop: 8 }}>🖐 提起判定区 touchraised(四状态)</div>
          {(['Happy', 'Nomal', 'PoorCondition', 'Ill'] as const).map((m) => (
            <div key={m} style={{ marginBottom: 4 }}>
              <div className="small muted" style={{ margin: '6px 0 3px' }}>{{ Happy: '开心', Nomal: '普通', PoorCondition: '状态不佳', Ill: '生病' }[m]}</div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {[['x', 'X'], ['y', 'Y'], ['w', '宽'], ['h', '高']].map(([k, n]) => (
                  <input key={k} className="input" type="number" style={{ width: 84 }} value={pet.touchRaised[m][k]}
                    onChange={(e) => upPet((x) => { x.touchRaised[m][k] = Number(e.target.value) || 0; })} placeholder={n} />
                ))}
                <span style={{ display: 'flex', alignItems: 'center', gap: 4 }} className="small muted">
                  锚点 X
                  <input className="input" type="number" style={{ width: 72 }} value={pet.raisePoint[m].x} onChange={(e) => upPet((x) => { x.raisePoint[m].x = Number(e.target.value) || 0; })} />
                  Y
                  <input className="input" type="number" style={{ width: 72 }} value={pet.raisePoint[m].y} onChange={(e) => upPet((x) => { x.raisePoint[m].y = Number(e.target.value) || 0; })} />
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 多语言 */}
      <div className="card">
        <div className="card-title">🌐 多语言文案</div>
        <div className="card-desc">导出时写入 lang/&lt;语言&gt;/&lt;语言&gt;.lps; 模组名与宠物名/介绍是每语言必填项, 其余条目(食物名等)在各配置页填写后自动汇总</div>
        <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
          {CULTURES.map((c) => (
            <button key={c.id} className={`btn sm ${cultures.includes(c.id) ? 'primary' : ''}`}
              onClick={() => cultures.includes(c.id) ? (cultures.length > 1 && (setCultures(cultures.filter((x) => x !== c.id)), s.update((d) => { delete d.i18n[c.id]; }))) : (setCultures([...cultures, c.id]), s.update((d) => { d.i18n[c.id] = {}; }))}>
              {c.label} {cultures.includes(c.id) ? '✓' : '＋'}
            </button>
          ))}
        </div>
        {cultures.map((c) => (
          <div key={c} className="row" style={{ marginBottom: 12, alignItems: 'center' }}>
            <span className="tag pink" style={{ width: 92, justifyContent: 'center' }}>{c}</span>
            <input className="input" placeholder="模组名" style={{ maxWidth: 180 }}
              value={p.i18n[c]?.[p.meta.id] || ''} onChange={(e) => s.update((d) => { d.i18n[c] = d.i18n[c] || {}; d.i18n[c][d.meta.id] = e.target.value; })} />
            <input className="input" placeholder={`${pet.i18nName || '宠物名'} 的翻译`}
              value={p.i18n[c]?.[`${pet.id}_PetName`] || ''} onChange={(e) => s.update((d) => { d.i18n[c] = d.i18n[c] || {}; d.i18n[c][`${pet.id}_PetName`] = e.target.value; })} />
            <input className="input" placeholder="介绍翻译" style={{ flex: 2 }}
              value={p.i18n[c]?.[`${pet.id}_Description`] || ''} onChange={(e) => s.update((d) => { d.i18n[c] = d.i18n[c] || {}; d.i18n[c][`${pet.id}_Description`] = e.target.value; })} />
          </div>
        ))}
      </div>

      {pickIcon && <AssetPicker onClose={() => setPickIcon(false)} onPick={(a) => { setPickIcon(false); setIcon(a); }} />}
    </div>
  );
}
