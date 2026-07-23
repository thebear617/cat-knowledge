---
name: cat-archive
description: Use when updating cat association archive website. Covers editing rules (js/*.js as primary source), Obsidian sync, data mapping, symlink _obsidian, deploy flow.
---

# 猫协档案编辑规则

## 数据源与网站源

```
js/*.js                 ← 主事实源 + 编辑入口（直接修改）
   ↓ 手动同步（agent 执行）
_obsidian/*.md          ← Obsidian 副本（仅供浏览查阅）
   ↓ 部署
https://thebear617.github.io/cat-knowledge/
```

## 软链

`_obsidian/` 是指向 `/Users/mokaiche/Documents/notes/01-Projects/猫协/` 的软链接，**不要提交到 git**（已加入 .gitignore）。`.md` 文件为 Obsidian 副本，仅供浏览查阅，不作为编辑入口。

## 项目结构

```
cats/
├── index.html              # 入口
├── _obsidian/              # Obsidian 副本（软链，仅供查阅）
├── js/
│   ├── cats.js             # 猫只档案数据
│   ├── supplies.js         # 物资管理数据
│   ├── plans.js            # 近期计划数据
│   ├── sop.js              # 标准 SOP 数据
│   ├── timeline.js         # 猫猫编年史数据
│   ├── roles.js            # 猫协分工数据
│   └── app.js              # 主逻辑（渲染、搜索、事件）
├── css/style.css           # 样式
├── images/{猫名}/          # 猫咪照片
│   ├── thumb/              # ≤400px 缩略图
│   └── *.jpg               # ≤1200px 原图
├── add-photo.sh            # 照片一键处理脚本
└── README.md               # 浏览者说明
```

## 文件映射

日常编辑入口为 `js/*.js`。`_obsidian/*.md` 为 Obsidian 副本（agent 手动同步，非日常编辑入口）。

| 网站 JS（编辑入口） | Obsidian 副本 | 说明 |
|--------|------------|------|
| `js/cats.js` | `_obsidian/猫只档案与疫苗绝育.md` | 猫只档案 tab 数据 |
| `js/supplies.js` | `_obsidian/物资管理.md` | 物资管理 tab 数据 |
| `js/plans.js` | `_obsidian/近期计划.md` | 近期计划 tab 数据 |
| `js/sop.js` | `_obsidian/猫只档案与疫苗绝育.md`（SOP 章节） | 标准 SOP tab 数据 |
| `js/timeline.js` | `_obsidian/行动记录与构思.md` | 猫猫编年史 tab 数据 |
| `js/roles.js` | `_obsidian/猫协分工.md` | 猫协分工 tab 数据 |

## 编辑规则（JS 优先）

日常修改数据时，只编辑 `js/*.js`，**不需要**实时同步到 Obsidian `.md`。

1. **直接修改 `js/*.js`** — 这是唯一编辑入口
2. **必要时手动同步到 `.md`** — 由 agent 按指令执行，不作为日常要求
3. **提交 + push** — 部署到 GitHub Pages

如需将 JS 数据同步到 Obsidian `.md`，告知 agent 执行即可。

## 猫只数据字段

`catProfiles` 数组中的字段：

```
name          猫名
status        就读中 / 已毕业 / 喵星或失踪
friendliness  抓捕/亲人状态
vaccine       疫苗状态
sterilized    绝育状态
notes         备注（认捐人、健康问题等）
source        来源表
cover         可选·首图路径（首页照片墙 + 猫只卡片固定显示；不写则取 images[0]）
images        照片路径数组（相对路径 `images/{猫名}/`）
```

## 事实源头规则

- `js/cats.js` 是猫只档案的**唯一主事实源**
- `_obsidian/猫只档案与疫苗绝育.md` 是 Obsidian 副本，仅供浏览查阅，不作为编辑入口
- 维护猫只状态、疫苗、绝育、领养和离世信息时，直接编辑 `js/cats.js`
- agent 可按需将 JS 数据同步到 `.md`，但不作为日常要求

## 约束

- 领养记录：只写领养人群名，不写地点等额外信息
- 不记录本人受伤/医疗信息
- 猫名不含括号别名
- `status` 固定枚举：`就读中`、`已毕业`、`喵星或失踪`
- 日期格式：YYYY-MM-DD；窗口期保留 `6.21~6.28` 格式
- 不确定信息写 `待补充` 或 `未知`，不编造
- 网站搜索：按 Enter 或点「搜索」按钮才触发

## Tab 结构

| Tab | id | 功能 |
|-----|----|------|
| 首页 | `home` | Hero + 照片墙 + 可点击统计卡片（筛选后展示猫咪列表） |
| 物资管理 | `supplies` | 按类别分组表格 |
| 标准 SOP | `sop` | 可折叠 SOP 条目 |
| 猫猫编年史 | `timeline` | 垂直时间轴，月份折叠 |
| 猫协分工 | `roles` | 四组职责卡片，独立渐变色头部 |
| 猫猫科普 | `science` | 建设中 |

## 图片管理

- 照片放入 `images/{猫名}/` 目录
- 原图 ≤1200px，使用 `sips -Z 1200` 缩放
- 缩略图在 `thumb/` 子目录，≤400px
- 所有图片通过 GitHub Pages 相对路径直接加载（不再使用 jsDelivr CDN，因其在大陆不稳定）
- 添加照片推荐使用 `./add-photo.sh <猫名> <照片路径>`
- 同名图片更新内容但文件名不变时，GitHub Pages 缓存可能未及时刷新，强刷（Cmd+Shift+R）即可

## 部署

```bash
git add . && git commit -m "..." && git push origin main
```

GitHub Pages 部署后通常几秒内生效。

## Commit 规范

- 中文 `type: 描述`，type 限定：`feat` / `chore` / `fix` / `style` / `refactor` / `docs` / `v*`
- **加照片统一用 `chore`**（数据增补，无功能变化），例如 `chore: 增补大头照片（datou11）`
- 之前那条 `feat: add-photo.sh 增加 PIL 回退 + 新增漂亮橘/大头照片` 混了脚本改动，不算单纯加图

## 首图（cover）约定

- 渲染逻辑：`getCatCover(cat)` 优先用 `cat.cover`，否则取 `cat.images[0]`
- 作用于首页照片墙（`app.js` ~line 180）和猫只卡片（~line 265）
- 抽屉「照片」tab 仍展示 `images[]` 全集，不受 cover 影响
- `add-photo.sh` 新图改为 **append 到 images[] 末尾**，不再 prepend，避免覆盖 cover
- 想换首图：直接改 `cat.cover` 字段值即可，不用动 `images[]` 顺序

## 已知技术决策

- 搜索框使用 keydown Enter + 按钮触发（非 input 事件），避免中文输入法组词中断
- 图片网格使用 thumb 缩略图，点击大图时才加载原图
- CDN URL 必须对中文文件名做 `encodeURIComponent` 编码（见 `references/debug-notes.md`）
- 图片直接通过 GitHub Pages 相对路径加载，无需等待 CDN 缓存刷新

## 参考资料

- `references/debug-notes.md` — 历史 debug 记录
