import React, { useEffect, useState } from 'react';
import { useStore } from '../lib/store';
import { validate, frameCount, unusedAssets } from '../lib/engine';
import { GRAPHS } from '../lib/graphMeta';

export default function OverviewView({ aiCount }: { aiCount: number }) {
  const s = useStore();
  const p = s.project!;
  const pet = s.activePet!;
  const v = validate(p);
  const petAnims = p.animations.filter((a) => a.petId === pet.id);
  const has = (g: string) => petAnims.some((a) => a.graphType === g && a.frames.length);

  // 制作清单(按当前宠物) — 每步都可一键带入项目上下文跳转 AI 生成
  const checks = [
    { label: `填写「${pet.i18nName || '宠物'}」资料(名称/介绍)`, done: !!pet.i18nName && !!pet.i18nIntro, link: 'pet', ai: { chat: 'intro' as const, note: '已选择「宠物介绍文案」任务, 将基于项目信息生成并回填' } },
    { label: '设置模组图标 icon.png', done: !!p.meta.iconAssetId, link: 'pet', ai: { tplId: 'icon' } },
    { label: '上传/生成素材帧', done: p.assets.length > 0, link: 'assets', ai: { tplId: 'idle', note: '生成待机精灵图后, 点结果上的「入库并去切片」直接进入素材流程' } },
    { label: '配置「呼吸/待机」动画(必备)', done: has('Default'), link: 'anime', ai: { tplId: 'idle' } },
    { label: '配置「开机」动画', done: has('StartUP'), link: 'anime', ai: { tplId: 'idle', note: '暂无开机专用模板: 可先生成待机帧, 再在动画工坊改绑为开机' } },
    { label: '配置「睡觉/说话/提起」动画', done: ['Sleep', 'Say', 'Raised_Static', 'Raised_Dynamic'].every(has), link: 'anime', ai: { tplId: 'sleep' } },
    { label: '配置摸头/摸身体动画', done: ['Touch_Head', 'Touch_Body'].every(has), link: 'anime', ai: { tplId: 'touch' } },
    { label: '配置移动动画(左右行走)', done: has('Move'), link: 'anime', ai: { tplId: 'walk' } },
    { label: '添加食物物品(可选)', done: p.foods.length > 0, link: 'food', ai: { tplId: 'food' } },
    { label: '添加对话文本(可选)', done: p.texts.low.length + p.texts.click.length + p.texts.select.length > 0, link: 'text', ai: { chat: 'texts' as const, note: '已选择「低状态/互动台词」任务, 将基于桌宠名与角色设定生成' } },
  ];
  const progress = Math.round((checks.filter((c) => c.done).length / checks.length) * 100);

  const modeCoverage = ['Happy', 'Nomal', 'PoorCondition', 'Ill'].map((m) => ({
    m,
    n: petAnims.filter((a) => a.mode === m && a.frames.length).length,
  }));

  return (
    <div>
      {/* 统计 */}
      <div className="grid grid-4" style={{ marginBottom: 16 }}>
        {[
          ['🎬', petAnims.filter((a) => a.frames.length).length, `个动作(${pet.i18nName || '当前宠物'})`, `全模组 ${p.animations.filter((a) => a.frames.length).length} 个`],
          ['🖼️', frameCount(p), '帧素材在用', `素材库 ${p.assets.length} 张`],
          ['🐱', p.pets.length, '只宠物', '左侧顶部可切换/添加'],
          ['🍰', p.foods.length, '件食物物品', `${p.texts.low.length + p.texts.click.length + p.texts.select.length} 条文本`],
        ].map(([ic, n, k, sub], i) => (
          <div className="stat" key={i}>
            <div className="v">{n as number}<span style={{ fontSize: 13, color: 'var(--text2)', marginLeft: 4, WebkitTextFillColor: 'initial' }}>{sub as string}</span></div>
            <div className="k">{ic} {k as string}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-2">
        {/* 制作清单 */}
        <div className="card">
          <div className="card-title">📋 制作清单 <span className="tag pink">{progress}%</span>
            {p.pets.length > 1 && <span className="tag">当前: {pet.i18nName}</span>}
          </div>
          <div className="card-desc">按顺序完成即可导出一个可运行的桌宠模组; 带 * 为游戏运行必备项</div>
          <div style={{ height: 8, background: 'var(--bg3)', borderRadius: 99, overflow: 'hidden', marginBottom: 14 }}>
            <div style={{ width: `${progress}%`, height: '100%', background: 'var(--accent-grad)', transition: 'width .3s' }} />
          </div>
          {checks.map((c, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 4px', borderBottom: '1px solid var(--divider)', cursor: c.link ? 'pointer' : 'default' }}
              onClick={() => c.link && s.setView(c.link as any)}>
              <span style={{ color: c.done ? '#0e9f6e' : 'var(--text2)' }}>{c.done ? '✓' : '○'}</span>
              <span style={{ flex: 1, color: c.done ? 'var(--text1)' : 'var(--text0)', fontSize: 13 }}>{c.label}</span>
              {c.ai && (
                <button className="btn sm" style={{ padding: '3px 10px', fontSize: 11.5 }}
                  title="携带项目上下文跳转 AI 生成"
                  onClick={(e) => { e.stopPropagation(); s.setAiTask(c.ai as any); s.setView('ai'); }}>✨ AI</button>
              )}
              {c.link && <span className="muted small">去处理 →</span>}
            </div>
          ))}
        </div>

        <div>
          {/* AI 快捷入口 */}
          <div className="card" style={{
            background: aiCount ? 'linear-gradient(120deg,var(--hover-soft),var(--tab-active-bg))' : 'linear-gradient(120deg,#fff8f2,#fff2f8)',
          }}>
            <div className="card-title">✨ AI 生成 {aiCount ? <span className="tag green">已配置 {aiCount} 家服务商</span> : <span className="tag amber">未配置</span>}</div>
            <div className="card-desc">
              {aiCount
                ? '在 AI 生成页用 9 个提示词模板生成桌宠素材、撰写介绍与台词并一键回填; 服务商管理在 设置 → AI 服务商'
                : '先在 设置 → AI 服务商 配置一个 OpenAI 兼容服务, 即可用 AI 生成素材图与文案'}
            </div>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              {aiCount > 0 && <button className="btn primary" onClick={() => s.setView('ai')}>🪄 去 AI 生成</button>}
              <button className="btn" onClick={() => s.setView('settings')}>⚙️ {aiCount ? '管理服务商(设置)' : '去设置 → AI 服务商'}</button>
            </div>
          </div>

          {/* 校验状态 */}
          <div className="card">
            <div className="card-title">{v.ok && !v.warnings.length ? '✅ 模组状态良好' : v.ok ? '⚠️ 可以导出, 但有建议项' : '❌ 存在必须修复的问题'}</div>
            {!v.ok && v.errors.map((e, i) => <div key={i} className="tag red" style={{ display: 'block', marginBottom: 6, padding: '5px 10px' }}>✕ {e}</div>)}
            {v.warnings.slice(0, 5).map((w, i) => <div key={i} className="tag amber" style={{ display: 'block', marginBottom: 6, padding: '5px 10px' }}>! {w}</div>)}
            {!!v.warnings.length && <button className="btn sm" style={{ marginTop: 4 }} onClick={() => s.setView('export')}>查看完整校验报告 →</button>}
          </div>

          {/* 状态覆盖 */}
          <div className="card">
            <div className="card-title">🎯 四状态动画覆盖 · {pet.i18nName || '当前宠物'}</div>
            <div className="card-desc">同一动作可为桌宠的四种身体状态分别配置动画(开心/普通/不佳/生病), 未配置的状态会回落到「普通」</div>
            {modeCoverage.map(({ m, n }) => (
              <div key={m} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 9 }}>
                <span style={{ width: 64, fontSize: 12.5, color: 'var(--text1)' }}>{{ Happy: '开心', Nomal: '普通', PoorCondition: '状态不佳', Ill: '生病' }[m]}</span>
                <div style={{ flex: 1, height: 8, background: 'var(--bg3)', borderRadius: 99, overflow: 'hidden' }}>
                  <div style={{ width: `${Math.min(100, n * 8)}%`, height: '100%', background: 'linear-gradient(90deg,#ff8fb8,#a78bfa)' }} />
                </div>
                <span className="muted small" style={{ width: 52, textAlign: 'right' }}>{n} 个</span>
              </div>
            ))}
            <div className="small muted" style={{ marginTop: 8 }}>已覆盖动作类型: {new Set(petAnims.filter((a) => a.frames.length).map((a) => a.graphType)).size} / {GRAPHS.length} · 未使用的素材 {unusedAssets(p).length} 张</div>
          </div>
        </div>
      </div>

      {/* 流程指引 */}
      <div className="card">
        <div className="card-title">🧭 素材生成流程(核心工作流)</div>
        <div className="card-desc">从图片素材到游戏内动画的完整链路 —— 每一步都有对应的可视化工具, 无需手写任何配置文件</div>
        <div className="flow">
          {[
            ['① 获取素材', '素材库上传原始图片, 或在 AI 中心用文生图直接生成', 'assets'],
            ['② 切片/整理', '精灵图按行列网格切片预览, 帧序列排序·镜像(左右方向复用)·批量帧时长', 'assets'],
            ['③ 绑定动作', '帧序列绑定到 宠物 × 动作类型 × 身体状态 × 段落, 实时预览播放效果', 'anime'],
            ['④ 内容配置', '宠物资料判定区·食物数值·对话文本·工作与移动配置', 'pet'],
            ['⑤ 导出上线', '自动生成 info.lps / pet / lang / food / text 全套目录, 打包 zip 放入 mod/', 'export'],
          ].map(([t, d, link], i) => (
            <div className="flow-step" key={i} style={{ cursor: 'pointer' }} onClick={() => s.setView((link as any))}>
              <div className="no">{i + 1}</div>
              <h4>{t}</h4><p>{d}</p>
              <p style={{ color: 'var(--pink-deep)', marginTop: 6 }}>进入 →</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
