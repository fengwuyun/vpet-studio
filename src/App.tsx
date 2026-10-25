import React, { useEffect, useState } from 'react';
import { StoreProvider, useStore } from './lib/store';
import HomeView from './views/HomeView';
import OverviewView from './views/OverviewView';
import PetInfoView from './views/PetInfoView';
import AnimeView from './views/AnimeView';
import AssetView from './views/AssetView';
import FoodView from './views/FoodView';
import TextView from './views/TextView';
import AiCenterView from './views/AiCenterView';
import ExportView from './views/ExportView';
import { backend } from './lib/backend';
import { Modal, Field } from './components/ui';
import SettingsView from './views/SettingsView';

const NAV = [
  { group: '项目', items: [
    { id: 'overview', ic: '🏠', label: '工作台' },
  ] },
  { group: '内容制作', items: [
    { id: 'pet', ic: '🐱', label: '宠物资料' },
    { id: 'assets', ic: '🎨', label: '素材工坊' },
    { id: 'anime', ic: '🎬', label: '动画工坊' },
    { id: 'food', ic: '🍰', label: '食物物品' },
    { id: 'text', ic: '💬', label: '对话文本' },
  ] },
  { group: '智能与发布', items: [
    { id: 'ai', ic: '✨', label: 'AI 生成' },
    { id: 'export', ic: '📦', label: '导出模组' },
  ] },
  { group: '系统', items: [
    { id: 'settings', ic: '⚙️', label: '设置' },
  ] },
];

const VIEW_TITLES: Record<string, [string, string]> = {
  overview: ['工作台', '项目概览 · 制作进度 · 快速入口'],
  pet: ['宠物资料', '基础信息 · 互动判定区 · 多语言'],
  assets: ['素材工坊', '上传素材 · 精灵图切片 · 帧序列生成'],
  anime: ['动画工坊', '动作配置 · 帧编排 · 实时预览'],
  food: ['食物物品', '商店物品与数值'],
  text: ['对话文本', '低状态 · 点击 · 选项文本'],
  ai: ['AI 生成', '提示词模板 · 素材/文案生成 · 调用日志'],
  export: ['导出模组', '校验 · 目录预览 · 打包'],
  settings: ['设置', '外观主题 · AI 服务商 · 关于'],
};

/** 侧栏顶部的桌宠切换器 */
function PetSwitcher() {
  const s = useStore();
  const p = s.project!;
  const [open, setOpen] = useState(false);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const cur = s.activePet;
  const petAnimCount = (id: string) => p.animations.filter((a) => a.petId === id && a.frames.length).length;

  return (
    <div className={`pet-switcher ${open ? 'open' : ''}`}>
      <div className="cur" onClick={() => setOpen(!open)}>
        <div className="pet-avatar">{['🐱', '🐶', '🐰', '🦊', '🐻', '🐧', '🐥', '🦄'][p.pets.indexOf(cur!) % 8]}</div>
        <div style={{ minWidth: 0 }}>
          <div className="nm">{cur?.i18nName || '未命名'}</div>
          <div className="sub">{p.pets.length > 1 ? `${p.pets.length} 只宠物 · 点击切换` : '单宠物 · 可添加更多'}</div>
        </div>
        <span className="caret">▼</span>
      </div>
      {open && (
        <div className="pet-list">
          {p.pets.map((pet) => (
            <div key={pet.id} className={`pet-item ${pet.id === cur?.id ? 'active' : ''}`} onClick={() => s.switchPet(pet.id)}>
              <span>{['🐱', '🐶', '🐰', '🦊', '🐻', '🐧', '🐥', '🦄'][p.pets.indexOf(pet) % 8]}</span>
              <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{pet.i18nName || pet.id}</span>
              <span className="muted small">{petAnimCount(pet.id)}动作</span>
              {p.pets.length > 1 && (
                <span className="del" onClick={(e) => {
                  e.stopPropagation();
                  if (!confirm(`删除宠物「${pet.i18nName}」及其全部动画配置?`)) return;
                  s.removePet(pet.id);
                }}>✕</span>
              )}
            </div>
          ))}
          <button className="pet-add" onClick={() => { setAdding(true); setName(''); }}>＋ 添加新宠物</button>
        </div>
      )}
      {adding && (
        <Modal title="添加新宠物" onClose={() => setAdding(false)}
          footer={<>
            <button className="btn" onClick={() => setAdding(false)}>取消</button>
            <button className="btn primary" onClick={() => {
              if (!name.trim()) return s.toast('请填写宠物名', 'err');
              s.addPet(name.trim());
              setAdding(false);
              setOpen(false);
              s.toast('新宠物已创建, 切换过去开始制作吧');
              s.setView('pet');
            }}>创建并切换</button>
          </>}>
          <Field label="宠物名称" hint="一个模组可以包含多只宠物, 玩家在游戏里可切换; 每只宠物有独立的动画/资料">
            <input className="input" autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="例如: 雪团子" />
          </Field>
        </Modal>
      )}
    </div>
  );
}

/** 首页侧栏(无项目时) */
function HomeNav() {
  const s = useStore();
  const items = [
    { group: '开始', list: [
      { id: 'home', ic: '🗂', label: '项目管理', hint: '' },
    ] },
    { group: '系统', list: [
      { id: 'settings', ic: '⚙️', label: '设置', hint: '' },
    ] },
  ];
  return (
    <nav className="nav">
      {items.map((g) => (
        <React.Fragment key={g.group}>
          <div className="nav-group">{g.group}</div>
          {g.list.map((it) => (
            <div key={it.id} className={`nav-item ${s.view === it.id ? 'active' : ''}`} onClick={() => s.setView(it.id as any)}>
              <span className="ic">{it.ic}</span>{it.label}
              {it.hint && <span className="badge">{it.hint}</span>}
            </div>
          ))}
        </React.Fragment>
      ))}
      <div className="nav-group">快速上手</div>
      <div className="nav-item" style={{ cursor: 'default' }}>
        <span className="ic">🧭</span>
        <span className="muted small" style={{ lineHeight: 1.5 }}>上传素材 → 切片<br />→ 绑定动作 → 导出</span>
      </div>
    </nav>
  );
}

function Shell() {
  const s = useStore();
  const p = s.project;
  const [browserMode, setBrowserMode] = useState(false);
  const [aiCount, setAiCount] = useState(0);

  useEffect(() => { setBrowserMode(!backend.isDesktop); }, []);
  useEffect(() => { document.title = p ? `${p.meta.name} · VPet Studio` : 'VPet Studio · 桌宠模组工坊'; }, [p]);
  useEffect(() => {
    backend.getAiConfig().then((c) => setAiCount(c.providers.length)).catch(() => {});
  }, [s.view === 'ai', s.view === 'settings']);

  useEffect(() => {
    const open = () => s.setView('settings');
    window.addEventListener('open-theme-picker', open);
    return () => window.removeEventListener('open-theme-picker', open);
  }, [s]);

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="logo">
          <div className="logo-icon">🐾</div>
          <div>
            <div className="logo-title">VPet Studio</div>
            <div className="logo-sub">桌宠模组可视化工坊</div>
          </div>
        </div>

        {p ? (
          <>
            <PetSwitcher />
            <nav className="nav">
              {NAV.map((g) => (
                <React.Fragment key={g.group}>
                  <div className="nav-group">{g.group}</div>
                  {g.items.map((it: any) => (
                    <div key={it.id} className={`nav-item ${s.view === it.id ? 'active' : ''}`} onClick={() => s.setView(it.id)}>
                      <span className="ic">{it.ic}</span>{it.label}
                      {it.id === 'anime' && <span className="badge">{p.animations.filter((a) => a.frames.length && a.petId === (s.activePet?.id || p.pets[0]?.id)).length}</span>}
                      {it.id === 'assets' && <span className="badge">{p.assets.length}</span>}
                      {it.id === 'food' && !!p.foods.length && <span className="badge">{p.foods.length}</span>}
                      {it.id === 'ai' && <span className={`ai-dot ${aiCount ? 'on' : ''}`} />}
                    </div>
                  ))}
                </React.Fragment>
              ))}
            </nav>
            <div className="nav-item" style={{ marginTop: 'auto' }} onClick={() => { if (!s.dirty || confirm('有未保存的修改, 仍要返回?')) s.setProject(null); }}>
              <span className="ic">↩</span>返回项目列表
            </div>
          </>
        ) : (
          <>
            <HomeNav />
          </>
        )}
      </aside>

      <div className="main">
        {p ? (
          <>
            <div className="topbar">
              <div>
                <div className="topbar-title">{VIEW_TITLES[s.view]?.[0]}</div>
                <div className="topbar-sub">{p.meta.name}{p.pets.length > 1 && s.activePet ? ` · ${s.activePet.i18nName}` : ''} · {VIEW_TITLES[s.view]?.[1]}</div>
              </div>
              <div className="topbar-actions">
                {browserMode && <span className="tag amber">浏览器演示模式</span>}
                <button className="btn sm" onClick={() => s.setView('ai')}>
                  <span className={`ai-dot ${aiCount ? 'on' : ''}`} />
                  ✨ AI {aiCount ? `已配置 ${aiCount} 家` : '未配置'}
                </button>
                <div className={`save-dot ${s.dirty ? 'dirty' : ''}`}>
                  <i />{s.saving ? '保存中…' : s.dirty ? '未保存' : '已自动保存'}
                </div>
                <button className="btn primary sm" onClick={() => s.setView('export')}>📦 导出模组</button>
              </div>
            </div>
            <div className="content">
              {s.view === 'overview' && <OverviewView aiCount={aiCount} />}
              {s.view === 'pet' && <PetInfoView />}
              {s.view === 'assets' && <AssetView />}
              {s.view === 'anime' && <AnimeView />}
              {s.view === 'food' && <FoodView />}
              {s.view === 'text' && <TextView />}
              {s.view === 'ai' && <AiCenterView onProvidersChanged={(n) => setAiCount(n)} />}
              {s.view === 'export' && <ExportView />}
              {s.view === 'settings' && <SettingsView onProvidersChanged={(n) => setAiCount(n)} />}
            </div>
          </>
        ) : s.view === 'settings' ? (
          <>
            <div className="topbar">
              <div>
                <div className="topbar-title">⚙️ 设置</div>
                <div className="topbar-sub">外观主题 · AI 服务商 · 关于（全局设置, 无需打开项目）</div>
              </div>
              <div className="topbar-actions">
                {browserMode && <span className="tag amber">浏览器演示模式</span>}
                <button className="btn sm" onClick={() => s.setView('home')}>← 返回项目管理</button>
              </div>
            </div>
            <div className="content">
              <SettingsView onProvidersChanged={(n) => setAiCount(n)} />
            </div>
          </>
        ) : (
          <div className="content" style={{ padding: '26px 34px' }}>
            <HomeView />
          </div>
        )}
      </div>

      <div className="toasts">
        {s.toasts.map((t) => (
          <div key={t.id} className={`toast ${t.kind}`}>{t.kind === 'ok' ? '✓ ' : '✕ '}{t.msg}</div>
        ))}
      </div>
    </div>
  );
}

export default function App() {
  return (
    <StoreProvider>
      <Shell />
    </StoreProvider>
  );
}
