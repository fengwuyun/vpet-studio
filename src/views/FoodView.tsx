import React, { useEffect, useState } from 'react';
import { useStore } from '../lib/store';
import { Modal, Field, AssetPicker, DropZone } from '../components/ui';
import { pickImages } from '../lib/backend';
import { FOOD_TYPES } from '../lib/graphMeta';
import type { FoodItem, FoodTypeId } from '../lib/types';
import { newId } from '../lib/types';

const NUM_FIELDS: [keyof FoodItem, string, string][] = [
  ['price', '价格 $', '商店售价'],
  ['strengthFood', '饱腹度', '主食类优先加这个'],
  ['strengthDrink', '口渴度', '饮料类优先加这个'],
  ['strength', '体力', '工作消耗的体力'],
  ['feeling', '心情', '零食/礼物加成'],
  ['health', '健康', '药品恢复'],
  ['likability', '好感度', '礼物类提升'],
  ['exp', '经验值', '喂食获得的经验'],
];

export default function FoodView() {
  const s = useStore();
  const p = s.project!;
  const [editing, setEditing] = useState<FoodItem | null>(null);
  const [pickImageFor, setPickImageFor] = useState<string | null>(null);
  useEffect(() => { s.loadAssetUrls(p.assets); }, []);

  const editItem = (f?: FoodItem) => setEditing(f ? { ...f } : {
    id: '', name: '', desc: '', type: 'Meal', price: 10,
    strength: 0, strengthFood: 5, strengthDrink: 0, feeling: 1, health: 0, likability: 0, exp: 1,
  });

  return (
    <div>
      <div className="card">
        <div className="card-title">🍰 食物 / 物品 <span className="tag">{p.foods.length}</span>
          <button className="btn primary sm" style={{ marginLeft: 'auto' }} onClick={() => editItem()}>＋ 新增物品</button>
        </div>
        <div className="card-desc">导出到 <span className="mono">food/&lt;类型&gt;.lps</span> 与 <span className="mono">image/food/&lt;ID&gt;.png</span>; 数值为正=恢复, 负=消耗</div>

        {!p.foods.length ? <div className="empty"><div className="big">🍽</div>还没有物品 —— 桌宠饿了的时侯会去商店买食物哦</div> : (
          <table className="tbl">
            <thead><tr><th style={{ width: 60 }}>图标</th><th>ID / 名称</th><th>类型</th><th>价格</th><th>主要效果</th><th style={{ width: 130 }}>操作</th></tr></thead>
            <tbody>
              {p.foods.map((f) => {
                const main = NUM_FIELDS.slice(1, 7).filter(([k]) => (f as any)[k] > 0).map(([k, n]) => `${n}+${(f as any)[k]}`).slice(0, 3).join(' · ') || '无';
                return (
                  <tr key={f.id}>
                    <td>
                      <div className="checker" style={{ width: 40, height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        {f.imageAssetId && s.assetUrl(f.imageAssetId) ? <img src={s.assetUrl(f.imageAssetId)} style={{ maxWidth: 36, maxHeight: 36 }} /> : <span className="muted small">无</span>}
                      </div>
                    </td>
                    <td><b>{f.name}</b><div className="muted small mono">{f.id}</div></td>
                    <td><span className="tag">{FOOD_TYPES.find((t) => t.id === f.type)?.label || f.type}</span></td>
                    <td>${f.price}</td>
                    <td className="small">{main}</td>
                    <td>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button className="btn sm" onClick={() => editItem(f)}>编辑</button>
                        <button className="btn sm danger" onClick={() => { if (confirm(`删除物品「${f.name}」?`)) s.update((d) => { d.foods = d.foods.filter((x) => x.id !== f.id); }); }}>删</button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {editing && (
        <Modal title={p.foods.some((f) => f.id === editing.id) ? '编辑物品' : '新增物品'} onClose={() => setEditing(null)} wide
          footer={<>
            <button className="btn" onClick={() => setEditing(null)}>取消</button>
            <button className="btn primary" onClick={() => {
              if (!editing.name.trim()) return s.toast('请填写名称', 'err');
              const id = editing.id || ('f_' + editing.name.replace(/[^a-zA-Z0-9]/g, '').toLowerCase() + '_' + Math.random().toString(36).slice(2, 5)) ;
              const item = { ...editing, id };
              s.update((d) => {
                const i = d.foods.findIndex((x) => x.id === id);
                if (i >= 0) d.foods[i] = item; else d.foods.push(item);
                d.i18n['zh-CN'][id] = item.name;
                d.i18n['zh-CN'][`${id}_Describe`] = item.desc;
              });
              setEditing(null);
              s.toast('物品已保存');
            }}>保存</button>
          </>}>
          <div className="grid grid-2">
            <div>
              <div className="row">
                <Field label="名称"><input className="input" value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} /></Field>
                <Field label="ID" hint="留空自动生成, 图片文件名"><input className="input mono" value={editing.id} onChange={(e) => setEditing({ ...editing, id: e.target.value.replace(/[^a-zA-Z0-9_-]/g, '') })} /></Field>
              </div>
              <Field label="类型">
                <select className="select" value={editing.type} onChange={(e) => setEditing({ ...editing, type: e.target.value as FoodTypeId })}>
                  {FOOD_TYPES.map((t) => <option key={t.id} value={t.id}>{t.label} — {t.desc}</option>)}
                </select>
              </Field>
              <Field label="描述"><textarea className="input" value={editing.desc} onChange={(e) => setEditing({ ...editing, desc: e.target.value })} placeholder="商店里显示的说明文字" /></Field>
              <div className="row">
                {NUM_FIELDS.map(([k, label, hint]) => (
                  <Field key={k} label={label} hint={hint}>
                    <input className="input" type="number" value={(editing as any)[k]} onChange={(e) => setEditing({ ...editing, [k]: Number(e.target.value) || 0 })} />
                  </Field>
                ))}
              </div>
            </div>
            <div>
              <Field label="物品图片" hint="建议正方形透明底 PNG">
                <DropZone compact onFiles={async (imgs) => {
                  const [a] = await s.importImages([imgs[0]], 'upload');
                  setEditing({ ...editing, imageAssetId: a.id });
                }} title="上传物品图片" sub="或从素材库选择 →" />
              </Field>
              <button className="btn" onClick={() => setPickImageFor(editing.id || 'new')}>🗂 从素材库选择</button>
              {editing.imageAssetId && s.assetUrl(editing.imageAssetId) && (
                <div style={{ marginTop: 12, textAlign: 'center' }}>
                  <img src={s.assetUrl(editing.imageAssetId)} style={{ maxWidth: 120, maxHeight: 120 }} className="checker" />
                </div>
              )}
            </div>
          </div>
        </Modal>
      )}

      {pickImageFor && editing && (
        <AssetPicker onClose={() => setPickImageFor(null)} onPick={(assets) => {
          setPickImageFor(null);
          if (assets[0]) setEditing({ ...editing, imageAssetId: assets[0].id });
        }} />
      )}
    </div>
  );
}
