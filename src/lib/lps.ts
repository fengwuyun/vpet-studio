// ============ LPS (LinePutScript) 序列化 ============
// 格式:  名字#信息:|子项1#值1:|子项2#值2
// 转义规则与 LinePutScript 库一致(读写均按原字符处理)

export function lpsEscape(text: string): string {
  return String(text ?? '')
    .replace(/\//g, '/!')
    .replace(/:\|/g, '/stop')
    .replace(/\|/g, '/|')
    .replace(/#/g, '/id')
    .replace(/,/g, '/com')
    .replace(/\n/g, '/n')
    .replace(/\r/g, '/r')
    .replace(/\t/g, '/tab');
}

export type Sub = (string | number | undefined | null)[];

export function line(name: string, info: string | number = '', subs: Sub[] = []): string {
  let s = `${name}#${lpsEscape(String(info))}`;
  for (const sub of subs) {
    const [k, v] = sub as [string, any];
    if (v === undefined || v === null || v === '') continue;
    s += `:|${k}#${lpsEscape(String(v))}`;
  }
  return s;
}

export function doc(lines: string[]): string {
  return lines.filter(Boolean).join('\r\n') + '\r\n';
}

/** 版本 "1.10.3" -> 11003 (游戏内部为整数版本) */
export function verToInt(v: string): number {
  const parts = String(v || '1.0.0').split('.').map((x) => parseInt(x, 10) || 0);
  const [a = 1, b = 0, c = 0] = parts;
  return a * 10000 + b * 100 + c;
}
