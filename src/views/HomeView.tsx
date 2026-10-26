import React, { useEffect, useState } from 'react';
import { useStore } from '../lib/store';
import { backend } from '../lib/backend';
import { emptyProject, migrateProject, type ProjectSummary, type StudioProject } from '../lib/types';
import { Modal, Field } from '../components/ui';
import { projectProgress, buildPayload, validate } from '../lib/engine';

interface PetChip { id: string; name: string }
interface ProjectRow extends ProjectSummary {
  pct: number; ready: boolean; errors: number; warnings: number;
  pets: PetChip[]; installed?: boolean;
}

export default function HomeView() {
  const s = useStore();
  const [rows, setRows] = useState<ProjectRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [root, setRoot] = useState('');
  const [creating, setCreating] = useState(false);
  const [cfgOpen, setCfgOpen] = useState(false);
  const [cfg, setCfg] = useState<{ gameDir: string; lastProjectId?: string }>({ gameDir: '' });
  const [probe, setProbe] = useState<{ exe: string | null; modDir: string | null; ok: boolean } | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [pendingLaunch, setPendingLaunch] = useState<string | null>(null);
  const [isDesktop, setIsDesktop] = useState(false);

  useEffect(() => { setIsDesktop(backend.isDesktop); }, []);

  const refresh = async () => {
    setLoading(true);
    setRoot(await backend.projectsRoot());
    const lc = await backend.getLaunchConfig();
    setCfg(lc);
    if (lc.gameDir) setProbe(await backend.probeVpetDir(lc.gameDir));
    const list = await backend.listProjects();
    const detailed: ProjectRow[] = [];
    for (const it of list) {
      const p = await backend.loadProject(it.id);
      if (!p) continue;
      const st = projectProgress(p);
      let installed: boolean | undefined;
      if (lc.gameDir) installed = await backend.checkModInstalled(it.id, lc.gameDir);
      detailed.push({
        ...it,
        pct: st.pct, ready: st.ready, errors: st.errors, warnings: st.warnings,
        pets: p.pets.map((x) => ({ id: x.id, name: x.i18nName || x.id })),
        installed,
      });
    }
    setRows(detailed);
    setLoading(false);
  };
  useEffect(() => { refresh(); }, []);

  /* ---------- 启动 ---------- */
  const doLaunch = async (id: string, launch: boolean) => {
    setBusyId(id);
    try {
      const p = await backend.loadProject(id);
      if (!p) return s.toast('项目数据缺失', 'err');
      const v = validate(p);
      if (!v.ok) {
        s.toast('还不能启动: ' + v.errors[0], 'err');
        return;
      }
      let dir = cfg.gameDir;
      // 未配置游戏目录 → 打开配置向导, 配好后继续本次启动
      if (!dir || !probe?.ok) {
        setPendingLaunch(launch ? id : null);
        setCfgOpen(true);
        return;
      }
      const payload = { files: buildPayload(p, { isDesktop, assetUrl: s.assetUrl }) };
      const r = await backend.installAndLaunch(id, dir, payload, launch);
      r.log.slice(0, 3).forEach((l) => s.toast(l.replace(/^[✓✕↺⚠️🚀]\s*/, ''), r.ok ? 'ok' : 'err'));
      const next = { ...cfg, lastProjectId: launch ? id : cfg.lastProjectId };
      setCfg(next);
      await backend.setLaunchConfig(next);
      refresh();
    } finally {
      setBusyId(null);
    }
  };

  const openWithPet = async (projectId: string, petId: string) => {
    const p = await backend.loadProject(projectId);
    if (!p) return;
    const fixed = migrateProject({ ...p, activePetId: petId });
    await backend.saveProject(fixed);
    s.setProject(fixed);
  };

  const quickLaunch = () => {
    const target = rows.find((r) => r.id === cfg.lastProjectId) || rows[0];
    if (!target) return setCreating(true);
    doLaunch(target.id, true);
  };

  const heroStatus = !rows.length
    ? { text: '还没有桌宠 —— 创建项目, 30 分钟做出第一只会动的桌宠', tone: 'muted' }
    : !probe?.ok
      ? { text: '尚未配置 VPet 游戏目录 —— 点「启动桌宠」自动引导配置', tone: 'amber' }
      : { text: `游戏目录已就绪 · ${rows.filter((r) => r.ready).length}/${rows.length} 个桌宠可启动`, tone: 'ok' };

  return (
    <div>
      {/* Hero: 快速启动 */}
      <div className="home-hero">
        <h1>🐾 启动我的桌宠</h1>
        <p>
          制作完成的桌宠可以一键安装进 VPet 游戏并启动 —— 装好后游戏内「设置 → 模组」启用即可;
          多只桌宠装进游戏后随时在游戏里切换。
        </p>
        <div className="small" style={{
          margin: '14px 0 16px', display: 'inline-flex', alignItems: 'center', gap: 8,
          background: 'rgba(255,255,255,.6)', border: '1px solid var(--line)', borderRadius: 99, padding: '5px 14px',
        }}>
          <span className={`ai-dot ${heroStatus.tone === 'ok' ? 'on' : ''}`} style={heroStatus.tone === 'amber' ? { background: 'var(--warn)' } : {}} />
          {heroStatus.text}
        </div>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <button className="btn primary" style={{ padding: '11px 26px', fontSize: 15 }} onClick={quickLaunch}>▶ 启动桌宠</button>
          <button className="btn" onClick={() => setCreating(true)}>＋ 新建模组</button>
          <button className="btn" onClick={() => { setPendingLaunch(null); setCfgOpen(true); }}>🎮 游戏目录配置</button>
          <button className="btn" onClick={refresh}>🔄 刷新</button>
          <button className="btn" onClick={() => s.setView('settings')}>⚙️ 设置</button>
        </div>
      </div>

      {/* 我的桌宠列表 */}
      <div className="card">
        <div className="card-title">🐾 我的桌宠 {!loading && <span className="tag">{rows.length}</span>}
          {loading && <span className="muted small">加载中…</span>}
        </div>
        <div className="card-desc">每个项目是一套桌宠模组; 卡片内多只宠物可点击直接切换编辑对象</div>
        {!loading && !rows.length ? (
          <div className="empty"><div className="big">🌱</div>还没有项目 —— 点击上方「新建模组」开始</div>
        ) : (
          <div className="grid grid-2">
            {rows.map((it) => (
              <div key={it.id} className="proj-card" style={{ alignItems: 'flex-start', flexDirection: 'column', gap: 10 }}>
                <div style={{ display: 'flex', gap: 12, width: '100%' }}>
                  <div className="proj-icon" style={{ width: 46, height: 46, fontSize: 22 }}>🐱</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 800, fontSize: 14.5 }}>{it.name}</div>
                    <div className="muted small mono">{it.id} · {it.author}</div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'flex-end' }}>
                    {it.ready
                      ? <span className="tag green">✓ 可启动</span>
                      : <span className="tag red">需完善 {it.errors} 项</span>}
                    {it.installed != null && (it.installed
                      ? <span className="tag teal">已装进游戏</span>
                      : <span className="tag">未安装</span>)}
                  </div>
                </div>

                {/* 进度 */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%' }}>
                  <div style={{ flex: 1, height: 7, background: 'var(--bg3)', borderRadius: 99, overflow: 'hidden' }}>
                    <div style={{ width: `${it.pct}%`, height: '100%', background: 'var(--accent-grad)' }} />
                  </div>
                  <span className="muted small" style={{ width: 34, textAlign: 'right' }}>{it.pct}%</span>
                  {!!it.warnings && <span className="tag amber" title={it.warnings + ' 条建议'}>{it.warnings} 建议</span>}
                </div>

                {/* 宠物 chips(点击切换编辑对象) */}
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', width: '100%' }}>
                  {it.pets.map((pet) => (
                    <span key={pet.id} className="tag pink" style={{ cursor: 'pointer' }}
                      title="点击以此宠物为当前编辑对象打开项目"
                      onClick={() => openWithPet(it.id, pet.id)}>
                      {['🐱', '🐶', '🐰', '🦊', '🐻', '🐧', '🐥', '🦄'][it.pets.indexOf(pet) % 8]} {pet.name} · 编辑
                    </span>
                  ))}
                  {it.pets.length <= 1 && <span className="muted small" style={{ alignSelf: 'center' }}>单宠物模组</span>}
                </div>

                {/* 操作 */}
                <div style={{ display: 'flex', gap: 8, width: '100%', justifyContent: 'flex-end' }}>
                  <button className="btn primary sm" disabled={busyId === it.id || !it.ready} title={it.ready ? '安装进游戏并启动' : '先完成必备项(见红色标签)'}
                    onClick={() => doLaunch(it.id, true)}>▶ 启动</button>
                  <button className="btn sm" disabled={busyId === it.id} title="只安装进游戏, 不启动(装多只进游戏切换)"
                    onClick={() => doLaunch(it.id, false)}>📥 仅安装</button>
                  <button className="btn sm" onClick={async () => { const p = await backend.loadProject(it.id); if (p) s.setProject(p); }}>✏️ 编辑</button>
                  <button className="btn danger sm" onClick={async (e) => {
                    if (!confirm(`确定删除项目「${it.name}」? 项目目录下全部数据(含素材)将被删除, 不可恢复。`)) return;
                    await backend.deleteProject(it.id);
                    refresh();
                  }}>删除</button>
                </div>
                {busyId === it.id && <div className="muted small">⏳ 正在导出并安装…</div>}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 启动配置 */}
      <div className="card">
        <div className="card-title">🎮 VPet 游戏目录</div>
        <div className="card-desc">启动桌宠需要知道游戏装在哪里(含 <span className="mono">VPet-Simulator.Windows.exe</span> 与 <span className="mono">mod/</span> 的目录)</div>
        <div className="row">
          <Field label="游戏目录">
            <input className="input mono" value={cfg.gameDir} readOnly placeholder="未配置 —— 点「自动探测」或「浏览…」" />
          </Field>
          <button className="btn" onClick={async () => {
            const r = await backend.detectVpetDir();
            if (!r) return s.toast('常见路径未找到 VPet, 请手动浏览选择游戏目录', 'err');
            setCfg((c) => ({ ...c, gameDir: r.dir }));
            setProbe({ exe: r.exe, modDir: r.modDir, ok: true });
            await backend.setLaunchConfig({ ...cfg, gameDir: r.dir });
            s.toast('已自动找到游戏目录');
            refresh();
          }}>🔍 自动探测</button>
          <button className="btn" onClick={() => setCfgOpen(true)}>浏览…</button>
        </div>
        <div className="small" style={{ color: 'var(--text1)', lineHeight: 1.8, marginTop: 4 }}>
          💡 <b>游戏内切换桌宠</b>: 启动游戏后, 摸头打开菜单 → 设置 → 模组, 启用/停用对应模组即可切换桌宠;
          同一个模组里做多只宠物时, 也在模组启用处切换。改完动画重新「启动」会自动覆盖安装最新版本。
        </div>
      </div>

      {/* 新建弹窗 */}
      {creating && (
        <CreateModal onClose={() => setCreating(false)} onDone={() => { setCreating(false); refresh(); }} />
      )}

      {/* 游戏目录配置向导 */}
      {cfgOpen && (
        <GameDirWizard
          initialDir={cfg.gameDir}
          onClose={() => setCfgOpen(false)}
          onSaved={async (dir) => {
            const next = { ...cfg, gameDir: dir };
            setCfg(next);
            await backend.setLaunchConfig(next);
            setProbe(await backend.probeVpetDir(dir));
            setCfgOpen(false);
            s.toast('游戏目录已保存');
            refresh();
            // 配置向导前如果点了启动, 无缝继续
            if (pendingLaunch) { const id = pendingLaunch; setPendingLaunch(null); setTimeout(() => doLaunch(id, true), 300); }
          }}
        />
      )}
    </div>
  );
}

/* ---------- 新建项目弹窗 ---------- */
function CreateModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const s = useStore();
  const [form, setForm] = useState({ name: '', author: '', id: '' });
  const create = async () => {
    if (!form.name.trim()) return s.toast('请填写模组名称', 'err');
    const p = emptyProject(form.name.trim(), form.author.trim() || '无名作者', form.id.trim() || undefined);
    if ((await backend.listProjects()).some((x) => x.id === p.meta.id)) return s.toast('已存在同名 ID 的项目', 'err');
    await backend.createProject(p);
    s.setProject(p);
    s.toast(`项目「${p.meta.name}」创建成功`);
    onDone();
  };
  return (
    <Modal title="新建模组项目" onClose={onClose}
      footer={<><button className="btn" onClick={onClose}>取消</button>
        <button className="btn primary" onClick={create}>创建</button></>}>
      <Field label="模组名称" hint="游戏内显示的名称, 建议 2~8 字">
        <input className="input" autoFocus value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="例如: 星空小猫" />
      </Field>
      <div className="row">
        <Field label="作者">
          <input className="input" value={form.author} onChange={(e) => setForm({ ...form, author: e.target.value })} placeholder="你的名字" />
        </Field>
        <Field label="模组 ID" hint="留空自动生成; 作为文件夹名, 仅英文/数字/-/_">
          <input className="input mono" value={form.id} onChange={(e) => setForm({ ...form, id: e.target.value.replace(/[^a-zA-Z0-9_-]/g, '') })} placeholder="StarKitty" />
        </Field>
      </div>
    </Modal>
  );
}

/* ---------- 游戏目录配置向导 ---------- */
function GameDirWizard({ initialDir, onClose, onSaved }: {
  initialDir: string; onClose: () => void; onSaved: (dir: string) => void;
}) {
  const s = useStore();
  const [dir, setDir] = useState(initialDir);
  const [probe, setProbe] = useState<{ exe: string | null; modDir: string | null; ok: boolean } | null>(null);
  const [autoMsg, setAutoMsg] = useState('');

  const check = async (d: string) => {
    setDir(d);
    if (d) setProbe(await backend.probeVpetDir(d));
    else setProbe(null);
  };

  return (
    <Modal title="🎮 配置 VPet 游戏目录" onClose={onClose}
      footer={<>
        <button className="btn" onClick={onClose}>取消</button>
        <button className="btn primary" disabled={!probe?.ok} onClick={() => onSaved(dir)}>保存{probe?.ok ? '并继续' : ''}</button>
      </>}>
      <div className="card-desc">
        选择 VPet 游戏安装目录(目录下应有 <span className="mono">VPet-Simulator.Windows.exe</span> 与 <span className="mono">mod/</span> 文件夹)。
        Steam 版通常在 <span className="mono">Steam\steamapps\common\VPet</span>
      </div>
      <div style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
        <button className="btn" onClick={async () => {
          setAutoMsg('探测中…');
          const r = await backend.detectVpetDir();
          if (r) { setAutoMsg('✓ 自动找到: ' + r.dir); check(r.dir); }
          else setAutoMsg('常见路径未找到, 请点「浏览…」手动选择游戏安装目录');
        }}>🔍 自动探测</button>
        <button className="btn" onClick={async () => {
          const d = await backend.pickGameDir();
          if (d) check(d);
        }}>📁 浏览…</button>
      </div>
      {autoMsg && <div className="small muted" style={{ marginBottom: 10 }}>{autoMsg}</div>}
      <Field label="游戏目录">
        <input className="input mono" value={dir} onChange={(e) => check(e.target.value.trim())} placeholder="D:\Steam\steamapps\common\VPet" />
      </Field>
      {probe && (probe.ok ? (
        <div className="tag green" style={{ padding: '6px 12px' }}>✓ 校验通过: 找到游戏主程序与 mod 文件夹</div>
      ) : (
        <div className="tag red" style={{ padding: '6px 12px', display: 'block' }}>
          ✗ 目录校验失败: {probe.exe ? '' : '缺少 VPet-Simulator.Windows.exe '}{probe.modDir ? '' : '缺少 mod/ 文件夹'}
        </div>
      ))}
    </Modal>
  );
}
