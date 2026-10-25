import React, { useEffect, useState } from 'react';
import { useStore } from '../lib/store';
import { backend } from '../lib/backend';
import { emptyProject, type ProjectSummary, type StudioProject } from '../lib/types';
import { Modal, Field } from '../components/ui';

export default function HomeView() {
  const s = useStore();
  const [list, setList] = useState<ProjectSummary[]>([]);
  const [creating, setCreating] = useState(false);
  const [root, setRoot] = useState('');
  const [form, setForm] = useState({ name: '', author: '', id: '' });
  const [loading, setLoading] = useState(true);

  const refresh = async () => {
    setLoading(true);
    setList(await backend.listProjects());
    setRoot(await backend.projectsRoot());
    setLoading(false);
  };
  useEffect(() => { refresh(); }, []);

  const open = async (id: string) => {
    const p = await backend.loadProject(id);
    if (p) s.setProject(p);
    else s.toast('项目数据损坏或缺失', 'err');
  };

  const create = async () => {
    if (!form.name.trim()) return s.toast('请填写模组名称', 'err');
    const p = emptyProject(form.name.trim(), form.author.trim() || '无名作者', form.id.trim() || undefined);
    if ((await backend.listProjects()).some((x) => x.id === p.meta.id)) return s.toast('已存在同名 ID 的项目', 'err');
    await backend.createProject(p);
    s.setProject(p);
    s.toast(`项目「${p.meta.name}」创建成功`);
  };

  return (
    <div>
      <div className="home-hero">
        <h1>VPet Studio <span style={{ fontSize: 15, fontWeight: 400, color: 'var(--text2)' }}>桌宠模组可视化工坊</span></h1>
        <p>
          为 <b>VPet 虚拟桌宠模拟器</b> 打造的桌面端模组制作工具: 可视化配置宠物资料、动作动画、食物物品与对话文本, <b>支持一个模组多只桌宠</b>;
          内置<b>素材生成流水线</b>(原始素材上传管理 / 精灵图切片 / AI 生成), 一键导出符合游戏规范、可直接放进 <span className="mono">mod/</span> 文件夹的完整模组包。
        </p>
        <div style={{ display: 'flex', gap: 12, marginTop: 24, flexWrap: 'wrap' }}>
          <button className="btn primary" onClick={() => setCreating(true)}>＋ 新建模组项目</button>
          <button className="btn" onClick={refresh}>🔄 刷新列表</button>
          <button className="btn" onClick={() => s.setView('settings')}>⚙️ 设置</button>
        </div>
        <div className="muted small" style={{ marginTop: 14 }}>
          🐾 进入项目后, 左上角可随时<b>切换/添加桌宠</b>; 顶栏与工作台都有 <b>✨ AI 管理与生成</b> 入口(配置服务商后可用文生图和文案助手)
        </div>
      </div>

      <div className="card">
        <div className="card-title">📁 最近项目 {loading && <span className="muted small">加载中…</span>}</div>
        <div className="card-desc">项目保存在: <span className="mono">{root || '…'}</span></div>
        {!loading && !list.length ? (
          <div className="empty">
            <div className="big">🌱</div>
            还没有项目 —— 点击上方「新建模组项目」开始制作你的第一个桌宠模组
          </div>
        ) : (
          <div className="grid grid-2">
            {list.map((it) => (
              <div key={it.id} className="proj-card" onClick={() => open(it.id)}>
                <div className="proj-icon">🐱</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 650 }}>{it.name}</div>
                  <div className="muted small">{it.author} · <span className="mono">{it.id}</span> · {new Date(it.updatedAt).toLocaleString('zh-CN')}</div>
                </div>
                <button className="btn danger sm" onClick={async (e) => {
                  e.stopPropagation();
                  if (!confirm(`确定删除项目「${it.name}」? 该操作会删除项目目录下全部数据(含素材), 不可恢复。`)) return;
                  await backend.deleteProject(it.id);
                  refresh();
                }}>删除</button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="card">
        <div className="card-title">🧭 素材与模组制作流程一览</div>
        <div className="card-desc">从一张图片到一个能跑起来的桌宠, 只需五步(详见工作台内的流程指引)</div>
        <div className="flow">
          {[
            ['准备素材', '手动上传逐帧原图 / 精灵图切片, 或使用 AI 生成'],
            ['整理帧序列', '排序·镜像·设帧时长, 生成规范帧序列'],
            ['绑定动作', '选择动作类型与状态, 帧序列自动落位'],
            ['补充配置', '宠物资料·食物物品·对话文本·工作'],
            ['导出模组', '一键生成 mod 目录结构 + zip, 放入游戏'],
          ].map(([t, d], i) => (
            <div className="flow-step" key={i}>
              <div className="no">{i + 1}</div>
              <h4>{t}</h4><p>{d}</p>
            </div>
          ))}
        </div>
      </div>

      {creating && (
        <Modal
          title="新建模组项目"
          onClose={() => setCreating(false)}
          footer={<>
            <button className="btn" onClick={() => setCreating(false)}>取消</button>
            <button className="btn primary" onClick={create}>创建</button>
          </>}
        >
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
      )}
    </div>
  );
}
