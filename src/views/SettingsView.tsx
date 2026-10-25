import React, { useEffect, useState } from 'react';
import { useStore } from '../lib/store';
import { backend } from '../lib/backend';
import { Modal, Field } from '../components/ui';
import { THEMES, currentTheme, applyTheme, patternEnabled, applyPattern } from '../lib/theme';
import { newId } from '../lib/types';
import type { AiConfig, AiProvider } from '../lib/types';

const PRESETS = [
  { name: 'OpenAI 官方', baseUrl: 'https://api.openai.com/v1', chatModel: 'gpt-4o-mini', imageModel: 'gpt-image-1' },
  { name: '智谱 GLM', baseUrl: 'https://open.bigmodel.cn/api/paas/v4', chatModel: 'glm-4-flash', imageModel: 'cogview-3-plus' },
  { name: '自定义 / 中转站', baseUrl: 'https://your-proxy.example.com/v1', chatModel: '', imageModel: '' },
];

const THEME_PATTERNS: Record<string, string> = {
  sakura: '樱花花瓣点缀',
  blue: '海浪与气泡',
  green: '飘落的叶子',
  yellow: '暖阳光斑',
  dark: '夜空繁星',
};

export default function SettingsView({ onProvidersChanged }: { onProvidersChanged?: (n: number) => void }) {
  const s = useStore();
  const [tab, setTab] = useState<'appearance' | 'ai' | 'about'>('appearance');
  const [cfg, setCfg] = useState<AiConfig>({ providers: [] });
  const [loaded, setLoaded] = useState(false);
  const [patOn, setPatOn] = useState(patternEnabled());
  const [root, setRoot] = useState('');
  const [, forceTick] = useState(0);

  useEffect(() => {
    backend.getAiConfig().then(setCfg).finally(() => setLoaded(true));
    backend.projectsRoot().then(setRoot);
    const h = () => forceTick((x) => x + 1);
    window.addEventListener('theme-changed', h);
    return () => window.removeEventListener('theme-changed', h);
  }, []);

  const saveCfg = async (next: AiConfig) => {
    setCfg(next);
    await backend.setAiConfig(next);
    onProvidersChanged?.(next.providers.length);
  };

  return (
    <div>
      <div className="tabs">
        <div className={`tab ${tab === 'appearance' ? 'active' : ''}`} onClick={() => setTab('appearance')}>🎨 外观</div>
        <div className={`tab ${tab === 'ai' ? 'active' : ''}`} onClick={() => setTab('ai')}>✨ AI 服务商 ({cfg.providers.length})</div>
        <div className={`tab ${tab === 'about' ? 'active' : ''}`} onClick={() => setTab('about')}>ℹ️ 关于</div>
      </div>

      {tab === 'appearance' && (
        <div>
          <div className="card">
            <div className="card-title">🎨 外观主题</div>
            <div className="card-desc">点击即时切换并自动记住(重启后保持); 「暗夜」为深色护眼主题, 其余为明亮主题</div>
            <div className="theme-grid">
              {THEMES.map((t) => (
                <ThemeCard key={t.id} id={t.id} name={t.name} desc={t.desc} dots={t.dots} />
              ))}
            </div>
          </div>
          <div className="card">
            <div className="card-title">🖼 主题图案背景 <span className="tag pink">{THEME_PATTERNS[currentTheme()]}</span></div>
            <div className="card-desc">每套主题搭配专属的浅色装饰图案(樱花 / 海浪 / 叶子 / 光斑 / 星空), 让界面不那么单调; 若觉得干扰可关闭</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <label className="switch">
                <input type="checkbox" checked={patOn} onChange={(e) => { setPatOn(e.target.checked); applyPattern(e.target.checked); }} />
                <span className="track" />
              </label>
              <span className="small" style={{ color: 'var(--text1)' }}>{patOn ? '已开启 —— 背景显示主题专属图案' : '已关闭 —— 纯色渐变背景'}</span>
            </div>
          </div>
        </div>
      )}

      {tab === 'ai' && (
        <ProvidersSection cfg={cfg} loaded={loaded} onSave={saveCfg} />
      )}

      {tab === 'about' && (
        <div className="card" style={{ maxWidth: 720 }}>
          <div className="card-title">ℹ️ 关于 VPet Studio</div>
          <div className="card-desc">桌宠模组可视化工坊 · 基于 VPet 官方模组格式</div>
          <div className="about-row"><span className="k">版本</span><span className="v mono">{(window as any).__APP_VERSION__ || '1.2.0'}</span></div>
          <div className="about-row"><span className="k">开源仓库</span><span className="v"><a href="https://github.com/fengwuyun/vpet-studio" target="_blank" rel="noreferrer" style={{ color: 'var(--accent-deep)' }}>github.com/fengwuyun/vpet-studio</a></span></div>
          <div className="about-row"><span className="k">项目数据目录</span><span className="v mono">{root || '…'}</span></div>
          <div className="about-row"><span className="k">AI 配置文件</span><span className="v mono">本机 userData/ai-config.json</span></div>
          <div className="about-row"><span className="k">导出格式</span><span className="v">与 VPet 官方 ModMaker 逐行对齐</span></div>
          <div className="about-row"><span className="k">许可</span><span className="v">MIT License</span></div>
        </div>
      )}
    </div>
  );
}

function ThemeCard({ id, name, desc, dots }: { id: string; name: string; desc: string; dots: string[] }) {
  const [cur, setCur] = useState(currentTheme());
  useEffect(() => {
    const h = () => setCur(currentTheme());
    window.addEventListener('theme-changed', h);
    return () => window.removeEventListener('theme-changed', h);
  }, []);
  return (
    <div className={`theme-card ${cur === id ? 'active' : ''}`}
      onClick={() => { applyTheme(id); window.dispatchEvent(new CustomEvent('theme-changed')); }}>
      <div className="swatch">{dots.map((c, i) => <i key={i} style={{ background: c }} />)}</div>
      <div className="nm">{name}</div>
      <div className="ds">{desc}</div>
      {cur === id && <div className="on-mark">✓ 当前使用</div>}
    </div>
  );
}

/* ================= AI 服务商管理(从 AI 中心迁入) ================= */
function ProvidersSection({ cfg, loaded, onSave }: { cfg: AiConfig; loaded: boolean; onSave: (c: AiConfig) => void }) {
  const s = useStore();
  const [editing, setEditing] = useState<AiProvider | null>(null);
  const [testing, setTesting] = useState<string | null>(null);

  const test = async (pv: AiProvider) => {
    setTesting(pv.id);
    const t0 = Date.now();
    const r = await backend.aiTest(pv);
    s.update((d) => { d.aiLogs.unshift({ time: Date.now(), provider: pv.name, kind: 'test', model: pv.chatModel, ok: r.ok, message: r.message, costMs: Date.now() - t0 }); });
    s.toast(`${pv.name}: ${r.message}`, r.ok ? 'ok' : 'err');
    setTesting(null);
  };

  if (!loaded) return <div className="empty">加载中…</div>;
  return (
    <div className="card">
      <div className="card-title">🔌 AI 服务商</div>
      <div className="card-desc">兼容一切 OpenAI 接口格式的服务(官方/智谱/DeepSeek/中转站…)。密钥仅保存在本机; 配置好后到「AI 生成」页使用文生图与文案助手</div>
      <button className="btn primary" style={{ marginBottom: 14 }} onClick={() => setEditing({ id: newId('pv'), name: '', baseUrl: '', apiKey: '', chatModel: '', imageModel: '', enabled: true })}>＋ 添加服务商</button>
      {!cfg.providers.length ? <div className="empty"><div className="big">🔌</div>还没有服务商</div> : (
        <table className="tbl">
          <thead><tr><th>名称</th><th>接口地址</th><th>聊天模型</th><th>生图模型</th><th>状态</th><th style={{ width: 240 }}>操作</th></tr></thead>
          <tbody>
            {cfg.providers.map((pv) => (
              <tr key={pv.id}>
                <td><b>{pv.name}</b> {cfg.activeProviderId === pv.id && <span className="tag pink">默认</span>}</td>
                <td className="mono small">{pv.baseUrl}</td>
                <td className="small">{pv.chatModel || '-'}</td>
                <td className="small">{pv.imageModel || '-'}</td>
                <td>{testing === pv.id ? <span className="tag amber">测试中…</span> : pv.enabled ? <span className="tag green">启用</span> : <span className="tag">停用</span>}</td>
                <td>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button className="btn sm" disabled={testing === pv.id} onClick={() => test(pv)}>测试</button>
                    <button className="btn sm" onClick={() => setEditing(pv)}>编辑</button>
                    <button className="btn sm" onClick={() => onSave({ ...cfg, activeProviderId: pv.id })}>设为默认</button>
                    <button className="btn sm danger" onClick={() => { if (confirm(`删除服务商「${pv.name}」?`)) onSave({ ...cfg, providers: cfg.providers.filter((x) => x.id !== pv.id) }); }}>删</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {editing && (
        <Modal title={cfg.providers.some((x) => x.id === editing.id) ? '编辑服务商' : '添加服务商'} onClose={() => setEditing(null)}
          footer={<>
            <button className="btn" onClick={() => setEditing(null)}>取消</button>
            <button className="btn primary" onClick={() => {
              if (!editing.name.trim() || !editing.baseUrl.trim()) return s.toast('名称和接口地址必填', 'err');
              const exists = cfg.providers.some((x) => x.id === editing.id);
              const providers = exists ? cfg.providers.map((x) => (x.id === editing.id ? editing : x)) : [...cfg.providers, editing];
              onSave({ ...cfg, providers, activeProviderId: cfg.activeProviderId || editing.id });
              setEditing(null);
              s.toast('已保存服务商配置');
            }}>保存</button>
          </>}>
          <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
            <span className="muted small">快速填充:</span>
            {PRESETS.map((pr) => (
              <button key={pr.name} className="btn sm" onClick={() => setEditing({ ...editing, ...pr, name: pr.name === '自定义 / 中转站' ? '' : pr.name })}>{pr.name}</button>
            ))}
          </div>
          <div className="row">
            <Field label="名称"><input className="input" value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} placeholder="我的 OpenAI" /></Field>
            <Field label="接口 Base URL" hint="一般以 /v1 结尾"><input className="input mono" value={editing.baseUrl} onChange={(e) => setEditing({ ...editing, baseUrl: e.target.value.trim() })} placeholder="https://api.openai.com/v1" /></Field>
          </div>
          <Field label="API Key" hint="仅保存在本机 userData/ai-config.json">
            <input className="input mono" type="password" value={editing.apiKey} onChange={(e) => setEditing({ ...editing, apiKey: e.target.value.trim() })} placeholder="sk-…" />
          </Field>
          <div className="row">
            <Field label="聊天模型" hint="文案/台词/起名使用"><input className="input mono" value={editing.chatModel} onChange={(e) => setEditing({ ...editing, chatModel: e.target.value.trim() })} placeholder="gpt-4o-mini" /></Field>
            <Field label="生图模型" hint="生成素材图使用"><input className="input mono" value={editing.imageModel} onChange={(e) => setEditing({ ...editing, imageModel: e.target.value.trim() })} placeholder="gpt-image-1 / cogview-3-plus" /></Field>
          </div>
          <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13 }}>
            <input type="checkbox" checked={editing.enabled} onChange={(e) => setEditing({ ...editing, enabled: e.target.checked })} /> 启用该服务商
          </label>
        </Modal>
      )}
    </div>
  );
}
