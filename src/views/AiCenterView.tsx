import React, { useEffect, useState } from 'react';
import { useStore } from '../lib/store';
import { backend } from '../lib/backend';
import { Modal, Field } from '../components/ui';
import type { AiConfig, AiProvider, AiLogItem } from '../lib/types';
import { newId } from '../lib/types';

const PRESETS = [
  { name: 'OpenAI 官方', baseUrl: 'https://api.openai.com/v1', chatModel: 'gpt-4o-mini', imageModel: 'gpt-image-1' },
  { name: '智谱 GLM', baseUrl: 'https://open.bigmodel.cn/api/paas/v4', chatModel: 'glm-4-flash', imageModel: 'cogview-3-plus' },
  { name: '自定义 / 中转站', baseUrl: 'https://your-proxy.example.com/v1', chatModel: '', imageModel: '' },
];

const STYLES = ['Q版厚涂', '像素风 16-bit', '日系赛璐璐', '手绘水彩', '3D 盲盒渲染', '黏土风格'];

/** 模板构建上下文: 提示词自动携带项目信息 */
export interface TplCtx {
  char: string;      // 角色设定
  style: string;     // 画风
  frames: number;    // 帧数
  petName: string;   // 桌宠名
  modName: string;   // 模组名
  tags: string;      // 标签
}

/** 素材提示词模板库: 每个提示词都携带项目上下文(模组/桌宠/角色/画风) */
const TEMPLATES: {
  id: string; icon: string; name: string; desc: string; sheet?: boolean;
  size: string; frames: number; build: (c: TplCtx) => string;
}[] = [
  {
    id: 'idle', icon: '🌬', name: '待机呼吸', desc: '站立轻微起伏+眨眼, 对应 Default 动作', sheet: true, size: '1024x1024', frames: 4,
    build: (x) => `为桌宠模组「${x.modName}」的桌宠「${x.petName}」制作「待机呼吸」动画精灵图 sprite sheet, 正面Q版全身站姿, ${x.frames} 帧横向等大排列, 仅身体轻微起伏和眨眼, 角色始终居中。角色设定: ${x.char}。画风: ${x.style}。要求: 透明背景纯角色, 每帧尺寸完全一致, 脚底基线严格对齐, 无文字无水印`,
  },
  {
    id: 'walk', icon: '🚶', name: '行走循环', desc: '侧面行走, 可镜像复用左右方向 (Move)', sheet: true, size: '1536x1024', frames: 6,
    build: (x) => `为桌宠模组「${x.modName}」的桌宠「${x.petName}」制作「侧面行走」动画精灵图 sprite sheet, 侧视全身, ${x.frames} 帧横向等大排列组成一个完整步伐循环, 步幅均匀, 前后帧衔接自然。角色设定: ${x.char}。画风: ${x.style}。要求: 透明背景纯角色, 每帧尺寸完全一致, 脚底基线严格对齐, 无文字无水印`,
  },
  {
    id: 'touch', icon: '🖐', name: '互动反应', desc: '被摸头时的开心反应 (Touch_Head)', sheet: true, size: '1024x1024', frames: 4,
    build: (x) => `为桌宠模组「${x.modName}」的桌宠「${x.petName}」制作「被摸头」互动反应动画精灵图, 正面Q版, ${x.frames} 帧横向等大排列: 表情从平静→惊讶→眯眼享受→恢复, 动作幅度适中。角色设定: ${x.char}。画风: ${x.style}。要求: 透明背景纯角色, 每帧尺寸完全一致, 脚底基线对齐, 无文字无水印`,
  },
  {
    id: 'sleep', icon: '💤', name: '睡觉', desc: '趴睡呼吸 (Sleep)', sheet: true, size: '1024x1024', frames: 4,
    build: (x) => `为桌宠模组「${x.modName}」的桌宠「${x.petName}」制作「趴着睡觉」动画精灵图, 侧视, ${x.frames} 帧横向等大排列, 缓慢呼吸起伏, 偶尔耳朵轻动。角色设定: ${x.char}。画风: ${x.style}。要求: 透明背景纯角色, 每帧尺寸完全一致, 无文字无水印`,
  },
  {
    id: 'raise', icon: '🎈', name: '被提起', desc: '悬空下垂微摆 (Raised)', sheet: true, size: '1024x1024', frames: 4,
    build: (x) => `为桌宠模组「${x.modName}」的桌宠「${x.petName}」制作「被提起悬空」动画精灵图, 正面全身, ${x.frames} 帧横向等大排列, 身体下垂四肢微摆的循环。角色设定: ${x.char}。画风: ${x.style}。要求: 透明背景纯角色, 每帧尺寸完全一致, 无文字无水印`,
  },
  {
    id: 'switch', icon: '🔄', name: '状态变化', desc: '精力充沛→疲惫过渡 (Switch_Down)', sheet: true, size: '1024x1024', frames: 4,
    build: (x) => `为桌宠模组「${x.modName}」的桌宠「${x.petName}」制作「精神变疲惫」状态过渡动画精灵图, 正面全身, ${x.frames} 帧横向等大排列, 姿态从精神饱满逐渐变得蔫蔫的。角色设定: ${x.char}。画风: ${x.style}。要求: 透明背景纯角色, 每帧尺寸完全一致, 无文字无水印`,
  },
  {
    id: 'icon', icon: '🏷', name: '模组图标', desc: '头像特写, 用于 icon.png', size: '1024x1024', frames: 1,
    build: (x) => `桌宠模组「${x.modName}」的应用图标, 主体是桌宠「${x.petName}」的头像特写居中构图, 保留圆形裁切安全边距, 表情可爱有神。角色设定: ${x.char}。画风: ${x.style}。要求: 透明背景, 干净无杂物, 无文字无水印`,
  },
  {
    id: 'food', icon: '🍰', name: '食物图标', desc: '等距视角道具图, 用于食物物品', size: '1024x1024', frames: 1,
    build: (x) => `桌宠模组「${x.modName}」(主角是桌宠「${x.petName}」)世界观里的宠物食物道具图, 等距视角 isometric, 单个物品居中, 摆盘精致。画风: ${x.style}。要求: 透明背景, 无文字无水印`,
  },
  {
    id: 'portrait', icon: '🖼', name: '角色立绘', desc: '三视图设定, 作为切片/绘制参考', size: '1024x1536', frames: 1,
    build: (x) => `桌宠「${x.petName}」(模组「${x.modName}」)的角色设定立绘, 正面/侧面/背面三视图, 全身, 比例统一。角色设定: ${x.char}。画风: ${x.style}。要求: 纯色浅背景, 细节清晰, 无文字无水印`,
  },
];

export default function AiCenterView({ onProvidersChanged }: { onProvidersChanged?: (n: number) => void }) {
  const s = useStore();
  const [tab, setTab] = useState<'gen' | 'logs'>('gen');
  const [cfg, setCfg] = useState<AiConfig>({ providers: [] });
  const [loaded, setLoaded] = useState(false);

  useEffect(() => { backend.getAiConfig().then(setCfg).finally(() => setLoaded(true)); }, []);

  const saveCfg = async (next: AiConfig) => {
    setCfg(next);
    await backend.setAiConfig(next);
    onProvidersChanged?.(next.providers.length);
  };
  const active = cfg.providers.find((p) => p.id === cfg.activeProviderId) || cfg.providers[0];
  const log = (l: Omit<AiLogItem, 'time'>) => {
    s.update((d) => { d.aiLogs.unshift({ ...l, time: Date.now() }); d.aiLogs = d.aiLogs.slice(0, 200); });
  };

  return (
    <div>
      <div className="tabs">
        <div className={`tab ${tab === 'gen' ? 'active' : ''}`} onClick={() => setTab('gen')}>🪄 AI 生成</div>
        <div className={`tab ${tab === 'logs' ? 'active' : ''}`} onClick={() => setTab('logs')}>📊 调用日志 ({s.project!.aiLogs.length})</div>
      </div>

      {!loaded ? <div className="empty">加载中…</div> : (
        <>
          {tab === 'gen' && <GenTab active={active} log={log} hasProvider={!!cfg.providers.length} onGoSettings={() => s.setView('settings')} />}
          {tab === 'logs' && <LogsTab />}
        </>
      )}
    </div>
  );
}

/* ================= AI 生成 ================= */
function GenTab({ active, log, hasProvider, onGoSettings }: { active?: AiProvider; log: (l: any) => void; hasProvider?: boolean; onGoSettings?: () => void }) {
  const s = useStore();
  const p = s.project!;
  const char = p.meta.character || '';
  const style = p.meta.artStyle || 'Q版厚涂';
  const [tplId, setTplId] = useState('idle');
  const [frames, setFrames] = useState(4);
  const [prompt, setPrompt] = useState('');
  const [auto, setAuto] = useState(true);
  const [size, setSize] = useState('1024x1024');
  const [busy, setBusy] = useState(false);
  const [results, setResults] = useState<string[]>([]);
  const [chatKind, setChatKind] = useState<'intro' | 'texts' | 'names'>('intro');
  const [chatOut, setChatOut] = useState('');
  const [chatBusy, setChatBusy] = useState(false);

  const tpl = TEMPLATES.find((t) => t.id === tplId)!;

  // 模板/设定变化时自动重拼提示词(手动编辑过后停止自动)
  useEffect(() => {
    if (!auto) return;
    setPrompt(tpl.build({
      char: char || '一只可爱的原创角色', style, frames: tpl.sheet ? frames : 1,
      petName: s.activePet?.i18nName || p.meta.name, modName: p.meta.name, tags: p.meta.tags || '',
    }));
    setSize(tpl.size);
  }, [tplId, char, style, frames, auto, s.activePet?.i18nName, p.meta.name]);

  // 工作台清单等入口带入的 AI 任务: 预选模板/文案任务并携带上下文
  useEffect(() => {
    const t = s.aiTask;
    if (!t) return;
    if (t.tplId) {
      const target = TEMPLATES.find((x) => x.id === t.tplId);
      if (target) { setTplId(target.id); setFrames(target.frames); setAuto(true); }
    }
    if (t.chat) setChatKind(t.chat);
    s.setAiTask(null);
    s.toast(t.note || '已带入项目上下文, 提示词按当前设定自动生成');
  }, [s.aiTask]);

  const genImage = async () => {
    if (!active || !prompt.trim()) return;
    setBusy(true);
    const t0 = Date.now();
    const r = await backend.aiImage(active, prompt.trim(), size);
    log({ provider: active.name, kind: 'image', model: active.imageModel, ok: r.ok, message: r.message, costMs: Date.now() - t0 });
    if (r.ok) setResults((x) => [...r.images, ...x]);
    else s.toast(r.message, 'err');
    setBusy(false);
  };

  const toLibrary = async (imgs: string[], names?: string[]) => {
    await s.importImages(imgs.map((d, i) => ({ name: names?.[i] || `AI_${tpl.name}_${Date.now().toString(36)}_${i}.png`, dataUrl: d })), 'ai', 'ai');
    s.toast(`已入库 ${imgs.length} 张`);
  };

  const splitNow = async (img: string) => {
    if (!img.startsWith('data:')) return s.toast('该结果为 URL 形式, 请先入库后从素材库去切片', 'err');
    await s.importImages([{ name: `AI_${tpl.name}_${Date.now().toString(36)}.png`, dataUrl: img }], 'ai', 'raw');
    s.setWizardSeed({ dataUrl: img, name: `AI_${tpl.name}` });
    s.setView('assets');
    s.toast('已入库并打开切片向导');
  };

  const CHAT_TASKS: Record<'intro' | 'texts' | 'names', { label: string; sys: string; make: (out: string) => void; user: () => string }> = {
    intro: {
      label: '🐾 宠物介绍文案',
      sys: '你是桌宠模组文案师, 用中文为虚拟桌宠写介绍, 2~3句, 可爱有个性, 直接输出文案本身',
      make: (out) => { s.update((d) => { d.pets.find((x) => x.id === s.activePet!.id)!.i18nIntro = out; d.i18n['zh-CN'][`${s.activePet!.id}_Description`] = out; }); },
      user: () => `桌宠名字: ${s.activePet?.i18nName || p.meta.name}, 模组名: ${p.meta.name}, 角色设定: ${char || '自由发挥'}, 标签: ${p.meta.tags || '无'}。请写宠物介绍。`,
    },
    texts: {
      label: '💬 低状态/互动台词',
      sys: '你是桌宠台词设计师。输出 10 行台词, 每行格式: 场景|台词。场景取值: 低体力/低心情/低饱腹/摸头/摸身体/提起。台词口语化不超过18字',
      make: (out) => {
        const rows = out.split('\n').map((l) => l.trim()).filter((l) => l.includes('|')).map((l) => l.split('|')[1].trim()).filter(Boolean);
        s.update((d) => { rows.slice(0, 10).forEach((t) => d.texts.low.push({ id: newId('lt'), text: t, mode: 'L', strength: 'S', like: 'N' })); });
      },
      user: () => `桌宠名字: ${s.activePet?.i18nName || p.meta.name}, 角色设定: ${char || '自由发挥'}。请生成台词。`,
    },
    names: {
      label: '✨ 起名/动动脑',
      sys: '你是命名顾问, 为桌宠模组提供命名建议, 中文, 每行一个, 共10个, 附一句话说明',
      make: () => {},
      user: () => `模组主题: ${p.meta.name} ${p.meta.tags}。请给出名字建议。`,
    },
  };

  const runChat = async () => {
    if (!active) return;
    const task = CHAT_TASKS[chatKind];
    setChatBusy(true);
    const t0 = Date.now();
    const r = await backend.aiChat(active, task.sys, task.user());
    log({ provider: active.name, kind: 'chat', model: active.chatModel, ok: r.ok, message: r.message.slice(0, 120), costMs: Date.now() - t0 });
    if (r.ok) { setChatOut(r.message); task.make(r.message); s.toast('生成完成, 已回填(可在对应配置页查看)'); }
    else s.toast(r.message, 'err');
    setChatBusy(false);
  };

  return (
    <div>
      {/* 角色设定 */}
      <div className="card">
        <div className="card-title">🎭 角色与画风设定 <span className="tag pink">所有素材模板共用, 保存在项目中</span></div>
        <div className="card-desc">把角色外观写清楚(物种/毛色/服装/配饰/性格), 生成的所有动画/图标会保持同一角色; 画风统一选一种</div>
        <div className="row">
          <div className="field" style={{ flex: 3 }}>
            <label>角色设定描述</label>
            <textarea className="input" rows={3} value={char}
              placeholder="例如: 一只圆滚滚的奶油色柴犬, 左耳有一枚草莓发夹, 系红色围巾, 性格软萌黏人"
              onChange={(e) => s.update((d) => { d.meta.character = e.target.value; })} />
          </div>
          <Field label="默认画风">
            <select className="select" value={style} onChange={(e) => s.update((d) => { d.meta.artStyle = e.target.value; })}>
              {STYLES.map((x) => <option key={x}>{x}</option>)}
            </select>
          </Field>
        </div>
      </div>

      <div className="grid grid-2">
        {/* 模板库 + 提示词 */}
        <div>
          <div className="card">
            <div className="card-title">📚 素材提示词模板 <span className="tag">{TEMPLATES.length} 个</span></div>
            <div className="card-desc">点击套用模板 → 自动拼装完整提示词(含精灵图规范) → 可再手动微调</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              {TEMPLATES.map((t) => (
                <div key={t.id} className={`flow-step ${tplId === t.id ? 'selected' : ''}`} style={{ padding: '12px 12px', cursor: 'pointer', borderColor: tplId === t.id ? 'var(--pink)' : undefined, boxShadow: tplId === t.id ? '0 0 0 3px rgba(255,111,165,.2)' : undefined }}
                  onClick={() => { setTplId(t.id); setFrames(t.frames); setAuto(true); }}>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 4 }}>
                    <span style={{ fontSize: 18 }}>{t.icon}</span>
                    <b style={{ fontSize: 13 }}>{t.name}</b>
                    {t.sheet && <span className="tag blue">精灵图</span>}
                  </div>
                  <p style={{ fontSize: 11.5 }}>{t.desc}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="card">
            <div className="card-title">🪄 生成 {active && <span className="tag teal">{active.name} · {active.imageModel || '未填生图模型'}</span>}</div>
            {tpl.sheet && (
              <div className="row" style={{ marginBottom: 12 }}>
                <Field label="帧数"><select className="select" style={{ width: 110 }} value={frames} onChange={(e) => setFrames(Number(e.target.value))}>
                  {[2, 3, 4, 6, 8].map((n) => <option key={n} value={n}>{n} 帧</option>)}
                </select></Field>
                <Field label="尺寸"><select className="select" style={{ width: 130 }} value={size} onChange={(e) => setSize(e.target.value)}>
                  {['1024x1024', '1536x1024', '1024x1536', '512x512'].map((x) => <option key={x}>{x}</option>)}
                </select></Field>
                <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
                  {!auto && <button className="btn sm" onClick={() => { setAuto(true); setPrompt(tpl.build({ char: char || '一只可爱的原创角色', style, frames: tpl.sheet ? frames : 1, petName: s.activePet?.i18nName || p.meta.name, modName: p.meta.name, tags: p.meta.tags || '' })); }}>按模板重拼</button>}
                </div>
              </div>
            )}
            <div className="field">
              <label>完整提示词{auto ? '(自动携带项目上下文, 可直接编辑)' : '(已手动编辑)'}</label>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 6 }}>
                <span className="tag blue">模组: {p.meta.name}</span>
                <span className="tag pink">桌宠: {s.activePet?.i18nName || p.meta.name}</span>
                <span className="tag teal">画风: {style}</span>
                {char ? <span className="tag green">✓ 已含角色设定</span> : <button className="tag amber" style={{ cursor: 'pointer' }} onClick={() => s.setView('ai')}>未填角色设定, 建议补充</button>}
              </div>
              <textarea className="input" rows={5} value={prompt} onChange={(e) => { setAuto(false); setPrompt(e.target.value); }} />
            </div>
            {!tpl.sheet && size !== tpl.size && <div className="muted small" style={{ marginBottom: 8 }}>该模板建议尺寸 {tpl.size}</div>}
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
              <button className="btn primary" disabled={busy || !prompt.trim() || !active?.imageModel} onClick={genImage}>{busy ? '生成中…(最长5分钟)' : '🪄 生成图片'}</button>
              {!hasProvider && <button className="btn sm" onClick={onGoSettings}>⚙️ 未配置服务商, 去设置后即可生成</button>}
              {!!hasProvider && !active?.imageModel && <span className="tag amber">请先在「设置 → AI 服务商」填写生图模型</span>}
            </div>
          </div>
        </div>

        {/* 结果 + 文案 */}
        <div>
          <div className="card">
            <div className="card-title">🖼 生成结果 {results.length ? <span className="tag">{results.length} 张</span> : null}</div>
            {!results.length ? (
              <div className="empty" style={{ padding: 26 }}><div className="big">🎨</div>选择模板点击生成<br /><span className="muted small">精灵图生成后可一键「入库并去切片」直通动画流程</span></div>
            ) : (
              <>
                <div className="asset-grid" style={{ marginBottom: 12 }}>
                  {results.map((r, i) => (
                    <div key={i} className="asset-card" style={{ cursor: 'default' }}>
                      <span className="src">AI 生成</span>
                      <div className="im"><img src={r} /></div>
                      <div style={{ display: 'flex', gap: 4, padding: 6 }}>
                        <button className="btn sm" style={{ flex: 1 }} onClick={() => toLibrary([r], [`AI_${tplId}_${i}.png`])}>入库</button>
                        {tpl.sheet && <button className="btn sm primary" style={{ flex: 1.4 }} onClick={() => splitNow(r)}>入库并去切片</button>}
                      </div>
                    </div>
                  ))}
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="btn primary" onClick={() => toLibrary(results)}>📥 全部入库素材库</button>
                  <button className="btn" onClick={() => setResults([])}>清空</button>
                </div>
              </>
            )}
          </div>

          <div className="card">
            <div className="card-title">✍️ AI 文案助手</div>
            <div className="card-desc">用聊天模型生成宠物介绍 / 台词 / 命名建议, 生成后一键回填到项目配置</div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
              {(Object.keys(CHAT_TASKS) as ('intro' | 'texts' | 'names')[]).map((k) => (
                <button key={k} className={`btn sm ${chatKind === k ? 'primary' : ''}`} onClick={() => setChatKind(k)}>{CHAT_TASKS[k].label}</button>
              ))}
            </div>
            <button className="btn primary" disabled={chatBusy || !active?.chatModel} onClick={runChat}>{chatBusy ? '思考中…' : '🪄 生成并回填'}</button>
            {chatOut && (
              <div style={{ marginTop: 12 }}>
                <div className="field"><label>输出结果</label></div>
                <textarea className="input" rows={8} value={chatOut} onChange={(e) => setChatOut(e.target.value)} />
                <button className="btn sm" style={{ marginTop: 8 }} onClick={() => CHAT_TASKS[chatKind].make(chatOut)}>再次回填到项目</button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ================= 日志 ================= */
function LogsTab() {
  const s = useStore();
  const logs = s.project!.aiLogs;
  return (
    <div className="card">
      <div className="card-title">📊 AI 调用日志 {logs.length > 0 && <button className="btn sm danger" style={{ marginLeft: 'auto' }} onClick={() => s.update((d) => { d.aiLogs = []; })}>清空</button>}</div>
      {!logs.length ? <div className="empty"><div className="big">📭</div>暂无调用记录</div> : (
        <table className="tbl">
          <thead><tr><th style={{ width: 150 }}>时间</th><th>服务商</th><th>类型</th><th>模型</th><th>结果</th><th style={{ width: 90 }}>耗时</th></tr></thead>
          <tbody>
            {logs.map((l, i) => (
              <tr key={i}>
                <td className="small muted">{new Date(l.time).toLocaleString('zh-CN')}</td>
                <td>{l.provider}</td>
                <td><span className={`tag ${l.kind === 'image' ? 'teal' : l.kind === 'chat' ? 'blue' : ''}`}>{({ test: '连通测试', chat: '对话', image: '生图' } as any)[l.kind]}</span></td>
                <td className="small mono">{l.model || '-'}</td>
                <td className="small" style={{ color: l.ok ? '#0e9f6e' : '#e11d48' }}>{l.ok ? '✓ ' : '✕ '}{l.message}</td>
                <td className="small muted">{(l.costMs / 1000).toFixed(1)}s</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
