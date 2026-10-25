// ============ VPet Studio 数据模型 ============
// 模组项目在内存中的完整描述, 持久化为 project.json

export type Culture = 'zh-CN' | 'en-US' | 'ja-JP' | 'ko-KR' | string;

export interface ProjectMeta {
  id: string;            // 模组ID(文件夹名), ascii
  name: string;          // 默认语言显示名(同时写入 zh-CN lang)
  author: string;
  version: string;       // x.y.z -> 游戏内 10000 进制
  gameVersion: string;
  tags: string;
  iconAssetId?: string;
  /** AI 生成用: 角色设定描述(所有提示词模板复用) */
  character?: string;
  /** AI 生成用: 默认画风 */
  artStyle?: string;
  createdAt: number;
  updatedAt: number;
}

export interface PetConfig {
  id: string;            // 宠物ID(文件夹名)
  i18nName: string;      // 显示名(默认文化)
  i18nIntro: string;     // 介绍
  /** 互动判定区(px): 摸头/摸身体/提起(4状态) */
  touchHead: Rect;
  touchBody: Rect;
  touchRaised: Record<ModeId, Rect>;
  raisePoint: Record<ModeId, Point>;
  /** 亲密度等阈值可后续扩展 */
}

export interface Rect { x: number; y: number; w: number; h: number }
export interface Point { x: number; y: number }

export type ModeId = 'Happy' | 'Nomal' | 'PoorCondition' | 'Ill';
export type AnimatId = 'Single' | 'A_Start' | 'B_Loop' | 'C_End';

/** 素材库条目: 一张图片(帧/图标/原图) */
export interface Asset {
  id: string;
  name: string;
  w: number;
  h: number;
  bytes: number;
  createdAt: number;
  source: 'upload' | 'split' | 'ai' | 'mirror';
  /** 素材分类: raw=原始素材(立绘/精灵图) frame=动画帧 icon=图标 ai=AI生成 */
  kind?: 'raw' | 'frame' | 'icon' | 'ai';
  /** 浏览器模式下直接存 dataURL; Electron 模式存文件名 */
  dataUrl?: string;
  fileName?: string;
}

/** 一条动画(一个变体): 有序帧序列 */
export interface AnimationEntry {
  id: string;
  name: string;          // 动画名(导出目录名)
  graphType: string;     // GraphType id
  mode: ModeId;
  animat: AnimatId;      // Single / A_Start / B_Loop / C_End
  variantIndex: number;  // 同一槽位下的变体序号 0..n
  frames: FrameRef[];
  petId?: string;        // 所属宠物(多宠物模组); 旧数据缺省归第一只
}
export interface FrameRef { assetId: string; duration: number }

export type FoodTypeId = 'Food' | 'Star' | 'Meal' | 'Snack' | 'Drink' | 'Functional' | 'Drug' | 'Gift';

export interface FoodItem {
  id: string;            // ascii ID (行 info + 图片名 + i18n key)
  name: string;          // 显示名
  desc: string;
  type: FoodTypeId;
  price: number;
  strength: number;      // 体力
  strengthFood: number;  // 饱腹度
  strengthDrink: number; // 口渴度
  feeling: number;       // 心情
  health: number;        // 健康
  likability: number;    // 好感度
  exp: number;
  imageAssetId?: string;
}

export interface LowTextItem {
  id: string; text: string;
  mode: 'H' | 'L';               // 心情高/低
  strength: 'L' | 'M' | 'S';     // 体力低/中/高
  like: 'N' | 'S' | 'M' | 'L';   // 好感无/低/中/高
}
export interface ClickTextItem {
  id: string; text: string;
  modes: ModeId[];               // 生效状态(多选)
  dayTimes: ('Morning' | 'Afternoon' | 'Night' | 'Midnight')[];
  likeMin?: number; likeMax?: number;
  healthMin?: number; healthMax?: number;
}
export interface SelectTextItem {
  id: string; text: string; choose: string;
  modes: ModeId[];
  money: number; exp: number;
  strength: number; strengthFood: number; strengthDrink: number;
  feeling: number; health: number; likability: number;
}

export interface WorkItem {
  id: string; name: string;
  type: 'Work' | 'Study' | 'Play';
  graphType: string;     // 关联动画类型(Work/Work_Read 等具名)
  graphName: string;     // 关联动画名
  moneyBase: number; strengthFood: number; strengthDrink: number;
  feeling: number; levelLimit: number; time: number; finishBonus: number;
}

export interface MoveItem {
  id: string;
  graphType: string;     // 关联动画类型(Move)
  graphName: string;     // 关联动画名(Walk_Left 等)
  interval: number;
  locateType: number; checkType: number;
  modes: ModeId[];
}

// ---- AI ----
export interface AiProvider {
  id: string;
  name: string;
  baseUrl: string;       // OpenAI 兼容, 如 https://api.openai.com/v1
  apiKey: string;
  chatModel: string;
  imageModel: string;
  enabled: boolean;
}
export interface AiLogItem {
  time: number;
  provider: string;
  kind: 'test' | 'chat' | 'image';
  model: string;
  ok: boolean;
  message: string;
  costMs: number;
}
export interface AiConfig {
  providers: AiProvider[];
  activeProviderId?: string;
}

// ---- 项目根 ----
export interface StudioProject {
  formatVersion: 1;
  meta: ProjectMeta;
  i18n: Record<Culture, Record<string, string>>;
  pets: PetConfig[];
  /** 当前编辑中的宠物(界面切换用, 不影响导出) */
  activePetId?: string;
  assets: Asset[];
  animations: AnimationEntry[];
  foods: FoodItem[];
  texts: { low: LowTextItem[]; click: ClickTextItem[]; select: SelectTextItem[] };
  works: WorkItem[];
  moves: MoveItem[];
  aiLogs: AiLogItem[];
}

export interface ProjectSummary {
  id: string;
  name: string;
  author: string;
  updatedAt: number;
  dir?: string;
}

export function newId(prefix = 'a'): string {
  return prefix + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

/** 旧项目数据迁移: 补齐 petId / kind / activePetId */
export function migrateProject(p: StudioProject): StudioProject {
  const firstPetId = p.pets[0]?.id;
  if (firstPetId) {
    for (const a of p.animations) if (!a.petId || !p.pets.some((x) => x.id === a.petId)) a.petId = firstPetId;
  }
  for (const a of p.assets) {
    if (!a.kind) a.kind = a.source === 'ai' ? 'ai' : a.source === 'split' || a.source === 'mirror' ? 'frame' : 'raw';
  }
  if (!p.activePetId || !p.pets.some((x) => x.id === p.activePetId)) p.activePetId = firstPetId;
  return p;
}

export function newPet(name: string, index: number): PetConfig {
  const ascii = name.replace(/[^a-zA-Z0-9_-]/g, '');
  const id = (ascii || 'Pet') + (index > 1 ? String(index) : '');
  return {
    id, i18nName: name, i18nIntro: '',
    touchHead: { x: 0, y: 0, w: 500, h: 200 },
    touchBody: { x: 0, y: 400, w: 500, h: 250 },
    touchRaised: {
      Happy: { x: 0, y: 0, w: 500, h: 190 },
      Nomal: { x: 0, y: 0, w: 500, h: 190 },
      PoorCondition: { x: 0, y: 0, w: 500, h: 190 },
      Ill: { x: 0, y: 0, w: 500, h: 190 },
    },
    raisePoint: { Happy: { x: 225, y: 90 }, Nomal: { x: 225, y: 90 }, PoorCondition: { x: 225, y: 90 }, Ill: { x: 225, y: 90 } },
  };
}

export function emptyProject(name: string, author: string, id?: string): StudioProject {
  const pid = (id || name).replace(/[^a-zA-Z0-9_-]/g, '') || 'MyPetMod';
  const now = Date.now();
  return {
    formatVersion: 1,
    meta: {
      id: pid, name, author, version: '1.0.0', gameVersion: '1.10.0',
      tags: '', createdAt: now, updatedAt: now,
    },
    i18n: { 'zh-CN': { [pid]: name, [`${pid}_Description`]: '' } },
    pets: [{
      id: pid, i18nName: name, i18nIntro: '',
      touchHead: { x: 0, y: 0, w: 500, h: 200 },
      touchBody: { x: 0, y: 400, w: 500, h: 250 },
      touchRaised: {
        Happy: { x: 0, y: 0, w: 500, h: 190 },
        Nomal: { x: 0, y: 0, w: 500, h: 190 },
        PoorCondition: { x: 0, y: 0, w: 500, h: 190 },
        Ill: { x: 0, y: 0, w: 500, h: 190 },
      },
      raisePoint: { Happy: { x: 225, y: 90 }, Nomal: { x: 225, y: 90 }, PoorCondition: { x: 225, y: 90 }, Ill: { x: 225, y: 90 } },
    }],
    assets: [],
    animations: [],
    foods: [],
    texts: { low: [], click: [], select: [] },
    works: [],
    moves: [],
    aiLogs: [],
  };
}
