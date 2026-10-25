# 🐾 VPet Studio · 桌宠模组可视化工坊

[![Release](https://img.shields.io/badge/release-v1.0.0-ff6fa5?style=flat-square)](https://github.com/fengwuyun/vpet-studio/releases) [![License](https://img.shields.io/badge/license-MIT-a78bfa?style=flat-square)](LICENSE) [![Platform](https://img.shields.io/badge/platform-Windows%20x64-34d3a6?style=flat-square)](https://github.com/fengwuyun/vpet-studio/releases)

**下载桌面版**：[Releases](https://github.com/fengwuyun/vpet-studio/releases) 提供 `VPet-Studio-Setup-1.0.0.exe`（安装版）与 `VPet-Studio-Portable-1.0.0.exe`（免安装便携版）。

基于 [VPet 虚拟桌宠模拟器](https://github.com/LorisYounger/VPet) 的模组格式（与官方 VPet.ModMaker 输出结构 100% 对齐），采用明亮萌系 UI 的**桌面端可视化配置软件**：不用手写任何 `.lps` 配置文件，即可完成宠物资料、动作动画、食物物品、对话文本的全套配置，并通过「素材生成流水线」把图片素材变成游戏里能跑的桌宠。

## ✨ 功能总览

| 模块 | 说明 |
|---|---|
| 🏠 **工作台** | 制作清单进度、四状态动画覆盖度、校验状态、AI 快捷卡片、素材流程指引 |
| 🐱 **宠物资料**（多宠物） | 左上角**桌宠切换器**可切换/添加/删除宠物（一个模组多只桌宠，玩家游戏内可切换）；名称/介绍/判定区/多语言按宠物独立配置 |
| 🎨 **素材工坊** | **素材库（第一入口）**：原始素材上传/分类筛选（原始素材·动画帧·图标·AI 生成）/搜索/重命名/镜像/设为图标/**去切片**；**生成向导**：精灵图网格切片→帧整理→绑定动作 |
| 🎬 **动画工坊** | 23 种官方动作类型树 × 4 种身体状态 × A/B/C 三段（按当前宠物过滤），帧编排 + Canvas 实时预览播放器(变速/逐帧) |
| 🍰 **食物物品** | 8 种类型、饱腹/口渴/体力/心情/健康/好感/经验数值配置、图标上传 |
| 💬 **对话文本** | 低状态文本、点击文本(状态/时段/好感条件)、选项文本(属性增减)，支持 `{name}` 等变量 |
| ✨ **AI 管理与生成** | 入口：顶栏常驻按钮（含配置状态灯）+ 工作台卡片 + 侧栏；服务商管理(OpenAI 兼容: 官方/智谱/中转站，测试连通)、AI 生图直入素材库、AI 文案(介绍/台词/起名)一键回填、调用日志 |
| 📦 **导出模组** | 完整性校验(错误/建议分级，多宠物逐一检查)、目录树预览（每只宠物独立 pet/ 目录）、导出模组文件夹 + zip，直接放入游戏 `mod/` |

## 🚀 运行

```bash
# 国内镜像已写入 .npmrc, 首次安装依赖:
npm install

# ▶ 桌面版(构建 + 启动 Electron):
npm run desktop

# 开发调试(浏览器打开, 走 localStorage 演示后端):
npm run dev
```

> 桌面版项目数据保存在 `文档\VPetStudioProjects\<模组ID>\`（project.json + assets 素材图），AI 配置保存在 `userData/ai-config.json`。

## 🧭 素材生成流程(核心工作流)

**上传/获取素材 → 切片/整理 → 绑定动作（选定桌宠）→ 内容配置 → 导出上线**，详见 [docs/素材生成流程.md](docs/素材生成流程.md)。

- **素材库是所有素材的中转站**：原始素材上传后按「原始素材 / 动画帧 / 图标 / AI 生成」分类管理，选中即可「去切片 / 镜像 / 绑定为动画帧 / 设为模组图标 / 重命名 / 删除」。
- 三条素材来源通道全部保留入口：**手动上传**（素材库/向导/动画工坊/食物图标/模组图标）、**AI 生成**（AI 管理与生成）、**素材库复用**。
- **多桌宠**：侧栏顶部切换器添加多只宠物，动画/资料按宠物独立配置，导出时每只宠物生成独立 `pet/<ID>/` 目录。

## 📁 导出的模组结构（官方规范）

```
<模组ID>/
├── info.lps                  # 模组元信息(vupmod/intro/cultureDatas)
├── icon.png                  # 模组图标
├── lang/zh-CN/zh-CN.lps      # 多语言文案
├── pet/<宠物ID>/
│   ├── <宠物ID>.lps          # pet/touchhead/touchbody/touchraised/raisepoint/work/move
│   ├── Default/Nomal/0/动画名_000_125.png    # 呼吸待机(一段式)
│   ├── Touch_Head/Nomal/A/0/…               # 摸头(三段式 A/B/C)
│   ├── Move/Walk_Left/Nomal/B/0/…           # 移动(具名动画)
│   └── …(23 种动作类型)
├── food/Meal.lps             # food#ID:|type#:|price#…
├── image/food/<ID>.png       # 食物图标
└── text/{lowText,clickText,selectText}.lps  # 对话文本
```

## 🤖 AI 配置与管理入口

- **AI 中心 → 服务商管理**：添加/编辑/删除/测试连通 OpenAI 兼容接口（内置 OpenAI、智谱 GLM 预设与自定义中转），密钥仅存本机
- **AI 中心 → AI 生成**：`/images/generations` 生图（生成的图一键入库素材库接续切片流水线）；`/chat/completions` 文案（宠物介绍 / 低状态台词 / 起名，生成后一键回填到对应配置）
- **AI 中心 → 调用日志**：连通测试 / 对话 / 生图的成败、耗时、模型记录

## 🔍 与官方格式的一致性

导出逻辑逐行对照 `VPet.ModMaker`（官方模组制作器）与 `VPet-Simulator.Core` 源码实现：

- LPS 行格式与转义规则（`#`、`:|`、`/!` 等）与 LinePutScript 库一致
- 动画目录规则：一段式 `<类型>/<状态>/<序号>`、三段式 `<状态>/<A|B|C>/<序号>`、具名式 `<类型>/<动画名>/…`、Switch/State/Raise 特殊目录
- 帧命名 `动画名_三位序号_毫秒时长.png`
- 宠物 4 状态键名（Happy/Nomal/PoorCondition/Ill，`Nomal` 为游戏源码原始拼写）

## 📄 License

MIT
