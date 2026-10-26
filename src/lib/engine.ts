// ============ 模组导出引擎 ============
// 将 StudioProject 编译为 VPet 模组文件映射 (路径 -> 文本 | dataUrl)
// 产出结构 100% 对齐 VPet.ModMaker 的保存逻辑

import type { StudioProject, Asset } from './types';
import { MODES } from './graphMeta';
import { graphMeta, animRelDir } from './graphMeta';
import { line, doc, verToInt } from './lps';

export type FileMap = Map<string, { kind: 'text'; content: string } | { kind: 'asset'; assetId: string }>;

export interface Validation {
  errors: string[];
  warnings: string[];
  ok: boolean;
}

const modeFlag = { Happy: 1, Nomal: 2, PoorCondition: 4, Ill: 8 } as const;
const dayTimeFlag = { Morning: 1, Afternoon: 2, Night: 4, Midnight: 8 } as const;

export function validate(p: StudioProject): Validation {
  const errors: string[] = [];
  const warnings: string[] = [];
  if (!p.meta.name) errors.push('模组名称为空');
  if (!p.meta.author) warnings.push('未填写作者名');
  if (!p.meta.iconAssetId) warnings.push('未设置模组图标 icon.png(建议 500×500 以内)');
  if (!p.pets.length) return { errors: [...errors, '缺少宠物配置'], warnings, ok: false };
  let anyDefault = false;
  for (const pet of p.pets) {
    const tag = p.pets.length > 1 ? `「${pet.i18nName}」` : '';
    if (!pet.i18nName?.trim()) errors.push(`${tag}宠物名称为空`);
    const petAnims = p.animations.filter((a) => a.petId === pet.id);
    if (petAnims.some((a) => a.graphType === 'Default' && a.frames.length)) anyDefault = true;
    else warnings.push(`${tag}缺少「呼吸/待机(Default)」动画 —— 桌宠运行必备`.replace(' —— ', ' —— '));
    if (!petAnims.some((a) => a.graphType === 'StartUP' && a.frames.length)) warnings.push(`${tag}建议补充「开机(StartUP)」动画`);
    for (const g of ['Sleep', 'Say', 'Raised_Static', 'Raised_Dynamic'])
      if (!petAnims.some((a) => a.graphType === g && a.frames.length))
        warnings.push(`${tag}建议补充「${graphMeta(g)?.label}(${g})」动画(游戏标注为常用必备)`);
    for (const g of ['Touch_Head', 'Touch_Body'])
      if (!petAnims.some((a) => a.graphType === g && a.frames.length))
        warnings.push(`${tag}建议补充「${graphMeta(g)?.label}」动画, 否则点击互动无反馈`);
  }
  if (!anyDefault) errors.push('至少一只宠物需要「呼吸/待机(Default)」动画');
  for (const a of p.animations) {
    if (!a.frames.length) warnings.push(`动画「${a.name}(${a.graphType})」没有帧`);
    if (!/^[\w\u4e00-\u9fa5-]+$/.test(a.name)) warnings.push(`动画名「${a.name}」含特殊字符, 建议只用中英文/数字/下划线`);
  }
  for (const f of p.foods) {
    if (!f.id || !/^[\w-]+$/.test(f.id)) errors.push(`食物 ID「${f.id}」无效(仅限英文数字下划线)`);
    if (!f.imageAssetId) warnings.push(`食物「${f.name}」未设置图片`);
  }
  return { errors, warnings, ok: errors.length === 0 };
}

export function buildExport(p: StudioProject): FileMap {
  const files: FileMap = new Map();
  const m = p.meta;
  const pet = p.pets[0];
  const descKey = `${m.id}_Description`;

  // ---- info.lps ----
  const infoLines: string[] = [
    line('vupmod', m.id, [['author', m.author], ['gamever', verToInt(m.gameVersion)], ['ver', verToInt(m.version)]]),
    line('intro', descKey),
    line('authorid', 0),
    line('itemid', 0),
    line('cachedate', new Date().toISOString().slice(0, 19)),
  ];
  const cultures = Object.keys(p.i18n);
  for (const c of cultures) {
    const d = p.i18n[c] || {};
    infoLines.push(line('cultureDatas', c, [
      [m.id, d[m.id] ?? (c.startsWith('zh') ? m.name : '')],
      [descKey, d[descKey] ?? ''],
    ]));
  }
  files.set('info.lps', { kind: 'text', content: doc(infoLines) });
  // Studio 导出标记: 安装时用于区分"自己的产物可覆盖"与"用户手工目录需备份"
  files.set('.vpetstudio', { kind: 'text', content: 'made by VPet Studio' });

  // ---- icon.png ----
  if (m.iconAssetId) files.set('icon.png', { kind: 'asset', assetId: m.iconAssetId });

  // ---- lang/<culture>/<culture>.lps ----
  // 汇总所有 i18n key: 模组名/描述 + 全部宠物 + 食物 + 工作
  const i18nData: Record<Culture0, Record<string, string>> = JSON.parse(JSON.stringify(p.i18n));
  const zh = i18nData['zh-CN'] = i18nData['zh-CN'] || {};
  for (const pet of p.pets) {
    zh[`${pet.id}_PetName`] = zh[`${pet.id}_PetName`] || pet.i18nName;
    zh[`${pet.id}_Description`] = zh[`${pet.id}_Description`] ?? pet.i18nIntro;
  }
  for (const f of p.foods) {
    zh[f.id] = zh[f.id] || f.name;
    zh[`${f.id}_Describe`] = zh[`${f.id}_Describe`] || f.desc;
  }
  for (const w of p.works) zh[w.id] = zh[w.id] || w.name;
  for (const c of Object.keys(i18nData)) {
    files.set(`lang/${c}/${c}.lps`, {
      kind: 'text',
      content: doc(Object.entries(i18nData[c]).filter(([, v]) => v !== '').map(([k, v]) => line(k, v))),
    });
  }

  for (const pet of p.pets) {
    const petAnims = p.animations.filter((a) => a.petId === pet.id);
    // ---- pet/<id>/<id>.lps ----
    const petLines: string[] = [
      line('pet', pet.id, [['path', pet.id], ['petname', `${pet.id}_PetName`], ['intor', `${pet.id}_Description`]]),
      line('touchhead', '', [['px', pet.touchHead.x], ['py', pet.touchHead.y], ['sw', pet.touchHead.w], ['sh', pet.touchHead.h]]),
      line('touchbody', '', [['px', pet.touchBody.x], ['py', pet.touchBody.y], ['sw', pet.touchBody.w], ['sh', pet.touchBody.h]]),
    ];
    const trSubs: any[] = [];
    for (const { id: mode } of MODES) {
      const key = mode.toLowerCase();
      const r = pet.touchRaised[mode];
      trSubs.push([`${key}_px`, r.x], [`${key}_py`, r.y], [`${key}_sw`, r.w], [`${key}_sh`, r.h]);
    }
    petLines.push(line('touchraised', '', trSubs));
    const rpSubs: any[] = [];
    for (const { id: mode } of MODES) {
      const key = mode.toLowerCase();
      const pt = pet.raisePoint[mode];
      rpSubs.push([`${key}_x`, pt.x], [`${key}_y`, pt.y]);
    }
    petLines.push(line('raisepoint', '', rpSubs));
    if (p.meta.tags.trim()) petLines.push(line('tag', p.meta.tags.trim()));

    // 工作/学习配置
    for (const w of p.works) {
      petLines.push(line('work', w.id, [
        ['type', w.type], ['name', w.id], ['graph', w.graphName],
        ['moneybase', w.moneyBase], ['strengthfood', w.strengthFood], ['strengthdrink', w.strengthDrink],
        ['feeling', w.feeling], ['levellimit', w.levelLimit], ['time', w.time], ['finishbonus', w.finishBonus],
      ]));
    }
    // 移动配置
    for (const mv of p.moves) {
      const modeVal = mv.modes.reduce((s, x) => s + (modeFlag as any)[x], 0);
      petLines.push(line('move', '', [
        ['graph', mv.graphName], ['locatetype', mv.locateType], ['interval', mv.interval],
        ['checktype', mv.checkType], ['modetype', modeVal || 30],
      ]));
    }
    files.set(`pet/${pet.id}/${pet.id}.lps`, { kind: 'text', content: doc(petLines) });

    // ---- 动画帧目录 ----
    for (const a of petAnims) {
      const g = graphMeta(a.graphType);
      if (!g || !a.frames.length) continue;
      const rel = animRelDir(g, a);
      a.frames.forEach((f, i) => {
        files.set(`pet/${pet.id}/${rel}/${a.name}_${String(i).padStart(3, '0')}_${f.duration}.png`, { kind: 'asset', assetId: f.assetId });
      });
    }
  }

  // ---- food/<Type>.lps + image/food/<id>.png ----
  const groups = new Map<string, string[]>();
  for (const f of p.foods) {
    const foodLine = line('food', f.id, [
      ['type', f.type], ['image', f.id], ['price', f.price],
      ['strength', f.strength], ['strengthfood', f.strengthFood], ['strengthdrink', f.strengthDrink],
      ['feeling', f.feeling], ['health', f.health], ['likability', f.likability], ['exp', f.exp],
    ]);
    const arr = groups.get(f.type) || [];
    arr.push(foodLine);
    groups.set(f.type, arr);
    if (f.imageAssetId) files.set(`image/food/${f.id}.png`, { kind: 'asset', assetId: f.imageAssetId });
  }
  for (const [type, lines] of groups) files.set(`food/${type}.lps`, { kind: 'text', content: doc(lines) });

  // ---- text/*.lps ----
  if (p.texts.low.length)
    files.set('text/lowText.lps', {
      kind: 'text',
      content: doc(p.texts.low.map((t) => line('lowfoodtext', t.id, [['mode', t.mode], ['strength', t.strength], ['like', t.like], ['text', t.text]]))),
    });
  if (p.texts.click.length)
    files.set('text/clickText.lps', {
      kind: 'text',
      content: doc(p.texts.click.map((t) => line('clicktext', t.id, [
        ['text', t.text],
        ['mode', t.modes.reduce((s, x) => s + (modeFlag as any)[x], 0) || 15],
        ['daytime', t.dayTimes.reduce((s, x) => s + (dayTimeFlag as any)[x], 0) || 15],
        ...(t.likeMin != null ? [['likemin', t.likeMin]] : []), ...(t.likeMax != null ? [['likemax', t.likeMax]] : []),
        ...(t.healthMin != null ? [['healthmin', t.healthMin]] : []), ...(t.healthMax != null ? [['healthmax', t.healthMax]] : []),
      ]))),
    });
  if (p.texts.select.length)
    files.set('text/selectText.lps', {
      kind: 'text',
      content: doc(p.texts.select.map((t) => line('selecttext', t.id, [
        ['text', t.text], ['choose', t.choose],
        ['mode', t.modes.reduce((s, x) => s + (modeFlag as any)[x], 0) || 15],
        ['money', t.money], ['exp', t.exp], ['strength', t.strength],
        ['strengthfood', t.strengthFood], ['strengthdrink', t.strengthDrink],
        ['feeling', t.feeling], ['health', t.health], ['likability', t.likability],
      ]))),
    });

  return files;
}

type Culture0 = string;

/** 生成目录树预览 */
export function buildTree(files: FileMap): string {
  const root: any = {};
  for (const path of files.keys()) {
    let node = root;
    const parts = path.split('/');
    parts.forEach((part, i) => {
      if (i === parts.length - 1) node.__files = [...(node.__files || []), part];
      else node = node[part] = node[part] || {};
    });
  }
  const lines: string[] = [`${p0(root)}`];
  walk(root, 0, lines);
  return lines.join('\n');
  function p0(node: any) { return Object.keys(node).filter((k) => k !== '__files').length + (node.__files?.length || 0); }
  function walk(node: any, depth: number, out: string[]) {
    const pad = '  '.repeat(depth + 1);
    const branch = '├─ ';
    for (const dir of Object.keys(node).filter((k) => k !== '__files').sort()) {
      out.push(`${pad}${branch}${dir}/ (${p0(node[dir])} 项)`);
      walk(node[dir], depth + 1, out);
    }
    for (const f of (node.__files || []).sort()) out.push(`${pad}${branch}${f}`);
  }
}

export function assetCount(p: StudioProject): number { return p.assets.length; }
export function frameCount(p: StudioProject): number { return p.animations.reduce((s, a) => s + a.frames.length, 0); }
export function unusedAssets(p: StudioProject): Asset[] {
  const used = new Set<string>();
  if (p.meta.iconAssetId) used.add(p.meta.iconAssetId);
  for (const a of p.animations) a.frames.forEach((f) => used.add(f.assetId));
  for (const f of p.foods) f.imageAssetId && used.add(f.imageAssetId);
  return p.assets.filter((a) => !used.has(a.id));
}

/** 首页项目级完成度(项目级宽化: 任一宠物满足即可) 与 可启动判定 */
export function projectProgress(p: StudioProject): { pct: number; ready: boolean; errors: number; warnings: number } {
  const v = validate(p);
  const has = (g: string) => p.animations.some((a) => a.graphType === g && a.frames.length);
  const checks = [
    !!p.pets[0]?.i18nName && !!p.pets[0]?.i18nIntro,
    !!p.meta.iconAssetId,
    p.assets.length > 0,
    has('Default'),
    has('StartUP'),
    ['Sleep', 'Say', 'Raised_Static', 'Raised_Dynamic'].every(has),
    ['Touch_Head', 'Touch_Body'].every(has),
    has('Move'),
  ];
  const pct = Math.round((checks.filter(Boolean).length / checks.length) * 100);
  return { pct, ready: v.ok, errors: v.errors.length, warnings: v.warnings.length };
}

/** 组装导出/安装载荷: 桌面版只传文件名引用, 浏览器演示传 dataURL */
export function buildPayload(p: StudioProject, opts: { isDesktop: boolean; assetUrl: (id: string) => string | undefined }): { path: string; kind: 'text' | 'asset'; content: string; fileName?: string; assetId?: string }[] {
  const files = buildExport(p);
  const assetMap = new Map(p.assets.map((a) => [a.id, a] as const));
  const out: { path: string; kind: 'text' | 'asset'; content: string; fileName?: string; assetId?: string }[] = [];
  for (const [fpath, f] of files) {
    if (f.kind === 'text') out.push({ path: fpath, kind: 'text', content: f.content });
    else {
      const asset = assetMap.get(f.assetId);
      out.push({
        path: fpath, kind: 'asset',
        fileName: asset?.fileName, assetId: f.assetId,
        content: opts.isDesktop ? '' : opts.assetUrl(f.assetId) || '',
      });
    }
  }
  return out;
}
