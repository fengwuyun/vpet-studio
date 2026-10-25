// ============ 外观主题 ============
// 应用级偏好(存 localStorage), html[data-theme] 驱动 CSS 变量切换

export interface ThemeDef {
  id: string;
  name: string;
  desc: string;
  dots: string[]; // 色板预览
}

export const THEMES: ThemeDef[] = [
  { id: 'sakura', name: '樱花粉', desc: '默认 · 软萌糖果', dots: ['#ff8fb8', '#ff6fa5', '#a78bfa'] },
  { id: 'blue', name: '海空蓝', desc: '清爽通透', dots: ['#8ec5fc', '#3b8ff0', '#7c8ff5'] },
  { id: 'green', name: '薄荷绿', desc: '清新自然', dots: ['#7edcc0', '#18b088', '#4ade80'] },
  { id: 'yellow', name: '暖阳黄', desc: '温暖琥珀', dots: ['#f7c66d', '#efa53b', '#f08a4b'] },
  { id: 'dark', name: '暗夜', desc: '深色护眼', dots: ['#2a3347', '#ec6fa8', '#a78bfa'] },
];

const KEY = 'vpet-theme';

export function currentTheme(): string {
  return localStorage.getItem(KEY) || 'sakura';
}

export function applyTheme(id: string) {
  localStorage.setItem(KEY, id);
  document.documentElement.dataset.theme = id;
}
