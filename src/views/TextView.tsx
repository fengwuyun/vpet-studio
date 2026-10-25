import React, { useState } from 'react';
import { useStore } from '../lib/store';
import { Modal, Field } from '../components/ui';
import { MODES } from '../lib/graphMeta';
import type { ClickTextItem, LowTextItem, SelectTextItem, ModeId } from '../lib/types';
import { newId } from '../lib/types';

const PLACEHOLDERS = '{name}名字 {food}饱腹 {drink}口渴 {feel}心情 {strength}体力 {money}金钱 {level}等级 {health}健康 {hostname}主人';
const MODE_LABEL: Record<ModeId, string> = { Happy: '开心', Nomal: '普通', PoorCondition: '不佳', Ill: '生病' };

export default function TextView() {
  const [tab, setTab] = useState<'low' | 'click' | 'select'>('low');
  return (
    <div>
      <div className="tabs">
        <div className={`tab ${tab === 'low' ? 'active' : ''}`} onClick={() => setTab('low')}>📉 低状态文本</div>
        <div className={`tab ${tab === 'click' ? 'active' : ''}`} onClick={() => setTab('click')}>👆 点击文本</div>
        <div className={`tab ${tab === 'select' ? 'active' : ''}`} onClick={() => setTab('select')}>🤔 选项文本</div>
      </div>
      <div className="card" style={{ marginBottom: 12 }}>
        <div className="muted small">💡 文本支持变量占位符: <span className="mono">{PLACEHOLDERS}</span> · 也可以在 <b>AI 中心</b> 批量生成台词</div>
      </div>
      {tab === 'low' && <LowTab />}
      {tab === 'click' && <ClickTab />}
      {tab === 'select' && <SelectTab />}
    </div>
  );
}

/* ---------- 低状态文本 ---------- */
function LowTab() {
  const s = useStore();
  const p = s.project!;
  const [edit, setEdit] = useState<LowTextItem | null>(null);
  return (
    <div className="card">
      <div className="card-title">低状态文本 <span className="tag">{p.texts.low.length}</span>
        <button className="btn primary sm" style={{ marginLeft: 'auto' }} onClick={() => setEdit({ id: newId('lt'), text: '', mode: 'L', strength: 'S', like: 'N' })}>＋ 新增</button>
      </div>
      <div className="card-desc">桌宠饿了/渴了/不开心时头顶气泡说的话。导出到 <span className="mono">text/lowText.lps</span></div>
      {!p.texts.low.length ? <div className="empty"><div className="big">💬</div>暂无文本</div> : (
        <table className="tbl">
          <thead><tr><th>文本</th><th>心情</th><th>体力</th><th>好感</th><th style={{ width: 130 }}>操作</th></tr></thead>
          <tbody>
            {p.texts.low.map((t) => (
              <tr key={t.id}>
                <td>{t.text}</td>
                <td><span className="tag">{{ H: '高', L: '低' }[t.mode]}</span></td>
                <td><span className="tag">{{ L: '低体力', M: '中', S: '充足' }[t.strength]}</span></td>
                <td><span className="tag">{{ N: '无', S: '低', M: '中', L: '高' }[t.like]}</span></td>
                <td>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button className="btn sm" onClick={() => setEdit({ ...t })}>编辑</button>
                    <button className="btn sm danger" onClick={() => s.update((d) => { d.texts.low = d.texts.low.filter((x) => x.id !== t.id); })}>删</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {edit && (
        <Modal title="低状态文本" onClose={() => setEdit(null)}
          footer={<ModalFooter onClose={() => setEdit(null)} onSave={() => {
            if (!edit.text.trim()) return s.toast('请填写文本', 'err');
            s.update((d) => {
              const i = d.texts.low.findIndex((x) => x.id === edit.id);
              if (i >= 0) d.texts.low[i] = edit; else d.texts.low.push(edit);
            });
            setEdit(null); s.toast('已保存');
          }} />}>
          <Field label="文本"><textarea className="input" rows={3} value={edit.text} onChange={(e) => setEdit({ ...edit, text: e.target.value })} placeholder="{name}的肚子咕咕叫了…" /></Field>
          <div className="row">
            <Field label="心情档位"><select className="select" value={edit.mode} onChange={(e) => setEdit({ ...edit, mode: e.target.value as any })}><option value="H">高</option><option value="L">低</option></select></Field>
            <Field label="体力档位"><select className="select" value={edit.strength} onChange={(e) => setEdit({ ...edit, strength: e.target.value as any })}><option value="L">低</option><option value="M">中</option><option value="S">充足</option></select></Field>
            <Field label="好感档位"><select className="select" value={edit.like} onChange={(e) => setEdit({ ...edit, like: e.target.value as any })}><option value="N">无</option><option value="S">低</option><option value="M">中</option><option value="L">高</option></select></Field>
          </div>
        </Modal>
      )}
    </div>
  );
}

/* ---------- 点击文本 ---------- */
function ClickTab() {
  const s = useStore();
  const p = s.project!;
  const [edit, setEdit] = useState<ClickTextItem | null>(null);
  return (
    <div className="card">
      <div className="card-title">点击文本 <span className="tag">{p.texts.click.length}</span>
        <button className="btn primary sm" style={{ marginLeft: 'auto' }} onClick={() => setEdit({ id: newId('ct'), text: '', modes: ['Happy', 'Nomal', 'PoorCondition', 'Ill'], dayTimes: ['Morning', 'Afternoon', 'Night', 'Midnight'] })}>＋ 新增</button>
      </div>
      <div className="card-desc">点击桌宠(非判定区)时随机说出的话, 可按状态/时段/好感/健康筛选触发条件。导出到 <span className="mono">text/clickText.lps</span></div>
      {!p.texts.click.length ? <div className="empty"><div className="big">💬</div>暂无文本</div> : (
        <table className="tbl">
          <thead><tr><th>文本</th><th>状态</th><th>时段</th><th style={{ width: 130 }}>操作</th></tr></thead>
          <tbody>
            {p.texts.click.map((t) => (
              <tr key={t.id}>
                <td>{t.text}</td>
                <td>{t.modes.length === 4 ? <span className="tag">全部</span> : t.modes.map((m) => <span key={m} className="tag blue">{MODE_LABEL[m]}</span>)}</td>
                <td>{t.dayTimes.length === 4 ? <span className="tag">全天</span> : t.dayTimes.map((m) => <span key={m} className="tag teal">{{ Morning: '早', Afternoon: '午', Night: '晚', Midnight: '深夜' }[m]}</span>)}</td>
                <td>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button className="btn sm" onClick={() => setEdit({ ...t, modes: [...t.modes], dayTimes: [...t.dayTimes] })}>编辑</button>
                    <button className="btn sm danger" onClick={() => s.update((d) => { d.texts.click = d.texts.click.filter((x) => x.id !== t.id); })}>删</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {edit && (
        <Modal title="点击文本" onClose={() => setEdit(null)}
          footer={<ModalFooter onClose={() => setEdit(null)} onSave={() => {
            if (!edit.text.trim()) return s.toast('请填写文本', 'err');
            s.update((d) => {
              const i = d.texts.click.findIndex((x) => x.id === edit.id);
              if (i >= 0) d.texts.click[i] = edit; else d.texts.click.push(edit);
            });
            setEdit(null); s.toast('已保存');
          }} />}>
          <Field label="文本"><textarea className="input" rows={3} value={edit.text} onChange={(e) => setEdit({ ...edit, text: e.target.value })} placeholder="再摸就要收费了哦" /></Field>
          <Field label="触发状态" hint="不选=全部">
            <div style={{ display: 'flex', gap: 8 }}>
              {MODES.map((m) => (
                <button key={m.id} className={`btn sm ${edit.modes.includes(m.id) ? 'primary' : ''}`}
                  onClick={() => setEdit({ ...edit, modes: edit.modes.includes(m.id) ? edit.modes.filter((x) => x !== m.id) : [...edit.modes, m.id] })}>{m.label}</button>
              ))}
            </div>
          </Field>
          <Field label="触发时段">
            <div style={{ display: 'flex', gap: 8 }}>
              {([['Morning', '早上'], ['Afternoon', '下午'], ['Night', '晚上'], ['Midnight', '深夜']] as const).map(([k, n]) => (
                <button key={k} className={`btn sm ${(edit.dayTimes as any[]).includes(k) ? 'primary' : ''}`}
                  onClick={() => setEdit({ ...edit, dayTimes: ((edit.dayTimes as any[]).includes(k) ? edit.dayTimes.filter((x) => x !== k) : [...edit.dayTimes, k]) as any })}>{n}</button>
              ))}
            </div>
          </Field>
          <div className="row">
            <Field label="好感下限"><input className="input" type="number" value={edit.likeMin ?? ''} onChange={(e) => setEdit({ ...edit, likeMin: e.target.value === '' ? undefined : Number(e.target.value) })} /></Field>
            <Field label="健康下限"><input className="input" type="number" value={edit.healthMin ?? ''} onChange={(e) => setEdit({ ...edit, healthMin: e.target.value === '' ? undefined : Number(e.target.value) })} /></Field>
          </div>
        </Modal>
      )}
    </div>
  );
}

/* ---------- 选项文本 ---------- */
function SelectTab() {
  const s = useStore();
  const p = s.project!;
  const [edit, setEdit] = useState<SelectTextItem | null>(null);
  const blank = (): SelectTextItem => ({
    id: newId('st'), text: '', choose: '', modes: ['Happy', 'Nomal', 'PoorCondition', 'Ill'],
    money: 0, exp: 0, strength: 0, strengthFood: 0, strengthDrink: 0, feeling: 0, health: 0, likability: 0,
  });
  return (
    <div className="card">
      <div className="card-title">选项文本 <span className="tag">{p.texts.select.length}</span>
        <button className="btn primary sm" style={{ marginLeft: 'auto' }} onClick={() => setEdit(blank())}>＋ 新增</button>
      </div>
      <div className="card-desc">随机弹出的选择题: 上句+选项, 选择后对属性产生加减。导出到 <span className="mono">text/selectText.lps</span></div>
      {!p.texts.select.length ? <div className="empty"><div className="big">💬</div>暂无文本</div> : (
        <table className="tbl">
          <thead><tr><th>情境文本</th><th>选项</th><th>效果</th><th style={{ width: 130 }}>操作</th></tr></thead>
          <tbody>
            {p.texts.select.map((t) => {
              const eff = [['money', '钱'], ['exp', '经验'], ['feeling', '心情'], ['strengthFood', '饱腹'], ['strengthDrink', '口渴'], ['health', '健康'], ['likability', '好感']].filter(([k]) => (t as any)[k]).map(([k, n]) => `${n}${(t as any)[k] > 0 ? '+' : ''}${(t as any)[k]}`).join(' ');
              return (
                <tr key={t.id}>
                  <td>{t.text}</td><td><b>{t.choose}</b></td><td className="small">{eff || '无'}</td>
                  <td>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button className="btn sm" onClick={() => setEdit({ ...t, modes: [...t.modes] })}>编辑</button>
                      <button className="btn sm danger" onClick={() => s.update((d) => { d.texts.select = d.texts.select.filter((x) => x.id !== t.id); })}>删</button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
      {edit && (
        <Modal title="选项文本" onClose={() => setEdit(null)} wide
          footer={<ModalFooter onClose={() => setEdit(null)} onSave={() => {
            if (!edit.text.trim() || !edit.choose.trim()) return s.toast('请填写情境和选项', 'err');
            s.update((d) => {
              const i = d.texts.select.findIndex((x) => x.id === edit.id);
              if (i >= 0) d.texts.select[i] = edit; else d.texts.select.push(edit);
            });
            setEdit(null); s.toast('已保存');
          }} />}>
          <Field label="情境文本"><textarea className="input" rows={2} value={edit.text} onChange={(e) => setEdit({ ...edit, text: e.target.value })} placeholder="{name}看起来有点无聊…" /></Field>
          <Field label="选项文字"><input className="input" value={edit.choose} onChange={(e) => setEdit({ ...edit, choose: e.target.value })} placeholder="一起去公园玩吧" /></Field>
          <Field label="触发状态">
            <div style={{ display: 'flex', gap: 8 }}>
              {MODES.map((m) => (
                <button key={m.id} className={`btn sm ${edit.modes.includes(m.id) ? 'primary' : ''}`}
                  onClick={() => setEdit({ ...edit, modes: edit.modes.includes(m.id) ? edit.modes.filter((x) => x !== m.id) : [...edit.modes, m.id] })}>{m.label}</button>
              ))}
            </div>
          </Field>
          <div className="row">
            {([['money', '金钱'], ['exp', '经验'], ['strength', '体力'], ['strengthFood', '饱腹'], ['strengthDrink', '口渴'], ['feeling', '心情'], ['health', '健康'], ['likability', '好感']] as const).map(([k, n]) => (
              <Field key={k} label={n}><input className="input" type="number" value={(edit as any)[k]} onChange={(e) => setEdit({ ...edit, [k]: Number(e.target.value) || 0 })} /></Field>
            ))}
          </div>
        </Modal>
      )}
    </div>
  );
}

function ModalFooter({ onClose, onSave }: { onClose: () => void; onSave: () => void }) {
  return (<>
    <button className="btn" onClick={onClose}>取消</button>
    <button className="btn primary" onClick={onSave}>保存</button>
  </>);
}
