// ============ VPet GraphType 元数据 ============
// 来源: VPet-Simulator.Core/Graph/GraphInfo.cs + VPet.ModMaker AnimeTypeModel/NativeExtensions
// 目录规则与 ModMaker 的保存逻辑一一对应

import type { ModeId, AnimatId } from './types';

export const MODES: { id: ModeId; label: string; color: string }[] = [
  { id: 'Happy', label: '开心', color: '#f6c445' },
  { id: 'Nomal', label: '普通', color: '#5eead4' },
  { id: 'PoorCondition', label: '状态不佳', color: '#fb923c' },
  { id: 'Ill', label: '生病', color: '#f87171' },
];

export const ANIMATS: { id: AnimatId; short: string; label: string; desc: string }[] = [
  { id: 'A_Start', short: 'A', label: '开始', desc: '动作进入的起手帧' },
  { id: 'B_Loop', short: 'B', label: '循环', desc: '持续循环的中间帧' },
  { id: 'C_End', short: 'C', label: '结束', desc: '动作收尾帧' },
  { id: 'Single', short: 'S', label: '单段', desc: '一段式动画, 无起止拆分' },
];

export type AnimLayout = 'named' | 'multi' | 'single' | 'switch' | 'raiseStatic' | 'raiseDynamic' | 'state' | 'common';

export interface GraphMeta {
  id: string;
  label: string;
  category: string;
  layout: AnimLayout;
  required?: boolean;
  desc: string;
}

/** 与 ModMaker AnimeTypeModel.Save 的分发逻辑一致 */
export const GRAPHS: GraphMeta[] = [
  // ---- 基础 ----
  { id: 'Default', label: '呼吸/待机', category: '基础动作', layout: 'single', required: true, desc: '站立呼吸的循环动画, 桌宠的默认状态, 必备' },
  { id: 'StartUP', label: '开机', category: '基础动作', layout: 'single', required: true, desc: '软件启动时播放一次' },
  { id: 'Shutdown', label: '关机', category: '基础动作', layout: 'single', desc: '软件退出时播放' },
  { id: 'Say', label: '说话', category: '基础动作', layout: 'named', required: true, desc: '气泡说话时使用, A/B/C 三段' },
  { id: 'Sleep', label: '睡觉', category: '基础动作', layout: 'multi', required: true, desc: '睡觉动画, A/B/C 三段' },
  // ---- 互动 ----
  { id: 'Touch_Head', label: '摸头', category: '互动动作', layout: 'multi', desc: '点击头部判定区触发, A/B/C 三段' },
  { id: 'Touch_Body', label: '摸身体', category: '互动动作', layout: 'multi', desc: '点击身体判定区触发, A/B/C 三段' },
  { id: 'Raised_Static', label: '提起·静态', category: '互动动作', layout: 'raiseStatic', required: true, desc: '被鼠标提起待机, A/B/C 三段' },
  { id: 'Raised_Dynamic', label: '提起·动态', category: '互动动作', layout: 'raiseDynamic', required: true, desc: '被鼠标甩动时' },
  // ---- 待机/随机 ----
  { id: 'Common', label: '通用随机动作', category: '待机与随机', layout: 'common', desc: '自定义随机小动作, 可建多个(名字区分)' },
  { id: 'Idel', label: '空闲动作', category: '待机与随机', layout: 'named', desc: '空闲时随机播放(下蹲/无聊等)' },
  { id: 'StateONE', label: '待机模式 1', category: '待机与随机', layout: 'state', desc: '第一种待机场景, A/B/C 三段' },
  { id: 'StateTWO', label: '待机模式 2', category: '待机与随机', layout: 'state', desc: '第二种待机场景, A/B/C 三段' },
  // ---- 移动/工作 ----
  { id: 'Move', label: '移动', category: '移动与工作', layout: 'named', desc: '行走/爬行/攀爬等, 以动画名区分方向(Walk_Left 等)' },
  { id: 'Work', label: '工作', category: '移动与工作', layout: 'named', desc: '工作/学习动画, 与「工作配置」联动, 名如 Work_Read' },
  // ---- 状态切换 ----
  { id: 'Switch_Up', label: '切换状态·上', category: '状态切换', layout: 'switch', desc: '状态等级上升过场' },
  { id: 'Switch_Down', label: '切换状态·下', category: '状态切换', layout: 'switch', desc: '状态等级下降过场' },
  { id: 'Switch_Thirsty', label: '口渴切换', category: '状态切换', layout: 'switch', desc: '进入口渴状态' },
  { id: 'Switch_Hunger', label: '饥饿切换', category: '状态切换', layout: 'switch', desc: '进入饥饿状态' },
  // ---- 侧边躲藏 ----
  { id: 'SideHide_Left_Main', label: '贴左边缘', category: '侧边贴靠', layout: 'single', desc: '贴住屏幕左侧' },
  { id: 'SideHide_Left_Rise', label: '左侧贴靠起身', category: '侧边贴靠', layout: 'single', desc: '从左侧贴靠状态恢复' },
  { id: 'SideHide_Right_Main', label: '贴右边缘', category: '侧边贴靠', layout: 'single', desc: '贴住屏幕右侧' },
  { id: 'SideHide_Right_Rise', label: '右侧贴靠起身', category: '侧边贴靠', layout: 'single', desc: '从右侧贴靠状态恢复' },
];

export const GRAPH_CATEGORIES = ['基础动作', '互动动作', '待机与随机', '移动与工作', '状态切换', '侧边贴靠'];

export function graphMeta(id: string): GraphMeta | undefined {
  return GRAPHS.find((g) => g.id === id);
}

/** 该类型支持哪些 Animat 段 */
export function animatsFor(layout: AnimLayout): AnimatId[] {
  if (layout === 'single' || layout === 'raiseDynamic' || layout === 'switch') return ['Single'];
  return ['A_Start', 'B_Loop', 'C_End'];
}

/** 动画在模组包内的目录 (相对 pet/<petId>/) */
export function animRelDir(g: GraphMeta, a: { name: string; mode: ModeId; animat: AnimatId }): string {
  const seg = g.id.split('_');
  switch (g.layout) {
    case 'common':   // <动画名>/<状态>/[A|B|C]
      return `${a.name}/${a.mode}/${animatSeg(a.animat)}`;
    case 'named':    // <类型>/<动画名>/<状态>/[A|B|C]
      return `${g.id}/${a.name}/${a.mode}/${animatSeg(a.animat)}`;
    case 'multi':    // <类型>/<状态>/[A|B|C]
      return `${g.id}/${a.mode}/${animatSeg(a.animat)}`;
    case 'state':    // State/<类型>/<状态>/[A|B|C]
      return `State/${g.id}/${a.mode}/${animatSeg(a.animat)}`;
    case 'raiseStatic': // Raise/Raised_Static/<状态>/[A|B|C]
      return `Raise/Raised_Static/${a.mode}/${animatSeg(a.animat)}`;
    case 'raiseDynamic':
      return `Raise/Raised_Dynamic/${a.mode}`;
    case 'switch':   // Switch/<Up|Down|Thirsty|Hunger>/<状态>
      return `Switch/${seg[1]}/${a.mode}`;
    case 'single':
    default:
      return `${g.id}/${a.mode}`;
  }
}
function animatSeg(animat: AnimatId): string {
  if (animat === 'A_Start') return 'A';
  if (animat === 'B_Loop') return 'B';
  if (animat === 'C_End') return 'C';
  return 'S';
}

export const FOOD_TYPES: { id: string; label: string; desc: string }[] = [
  { id: 'Meal', label: '正餐', desc: '主食类, 恢复饱腹度为主' },
  { id: 'Snack', label: '零食', desc: '小吃, 心情加成' },
  { id: 'Drink', label: '饮料', desc: '恢复口渴度为主' },
  { id: 'Functional', label: '功能', desc: '功能性物品' },
  { id: 'Drug', label: '药品', desc: '恢复健康' },
  { id: 'Gift', label: '礼物', desc: '提升好感度' },
  { id: 'Food', label: '食物(通用)', desc: '通用分类' },
  { id: 'Star', label: '收藏', desc: '图鉴收藏品' },
];

export const CULTURES: { id: string; label: string }[] = [
  { id: 'zh-CN', label: '简体中文' },
  { id: 'zh-TW', label: '繁体中文' },
  { id: 'en-US', label: 'English' },
  { id: 'ja-JP', label: '日本語' },
  { id: 'ko-KR', label: '한국어' },
];
