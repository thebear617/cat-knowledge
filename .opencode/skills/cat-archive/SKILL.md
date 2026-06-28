---
name: cat-archive
description: Use when updating cat association archive website. Covers dual-write rule (Obsidian .md ←→ js/*.js), data source mapping, symlink _obsidian, deploy flow.
---

# 猫协档案双写规则

## 事实源与网站源

```
_obsidian/*.md          ← 事实源头（Obsidian，直接修改）
   ↕ 双向同步
js/*.js                 ← 网站数据（前端读取用）
   ↓ 部署
https://thebear617.github.io/cat-knowledge/
```

## 软链

`_obsidian/` 是指向 `/Users/mokaiche/Documents/notes/01-Projects/猫协/` 的软链接，**不要提交到 git**（已加入 .gitignore）。

## 项目结构

```
cats/
├── index.html              # 入口
├── _obsidian/              # Obsidian 源文件（软链）
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

| Obsidian 源 | 网站 JS | 说明 |
|------------|--------|------|
| `_obsidian/猫只档案与疫苗绝育.md` | `js/cats.js` | 猫只档案 tab 数据 |
| `_obsidian/物资管理.md` | `js/supplies.js` | 物资管理 tab 数据 |
| `_obsidian/近期计划.md` | `js/plans.js` | 近期计划 tab 数据 |
| `_obsidian/猫只档案与疫苗绝育.md`（SOP 章节） | `js/sop.js` | 标准 SOP tab 数据 |
| `_obsidian/行动记录与构思.md` | `js/timeline.js` | 猫猫编年史 tab 数据 |
| `_obsidian/猫协分工.md` | `js/roles.js` | 猫协分工 tab 数据 |

## 双写规则

每次修改数据时，必须同时更新两个源：

1. **先读 `_obsidian/` 下的 .md 文件**，以 Obsidian 内容为唯一事实
2. **更新 Obsidian .md** — 修改事实源
3. **更新 js/*.js** — 同步网站结构化数据
4. **提交 + push** — 部署到 GitHub Pages

## 猫只数据字段

`catProfiles` 数组中的字段：

```
name          猫名
status        在校 / 预计领养 / 已领养 / 已离世 / 失踪
friendliness  抓捕/亲人状态
vaccine       疫苗状态
nextWindow    下一针窗口
sterilized    绝育状态
adopter       领养人
destination   去向
notes         备注
source        来源表
images        照片路径数组（相对路径）
```

## 事实源头规则

- `js/cats.js` 只是前端展示用的结构化副本，不是最终事实源头
- 猫协档案的事实源头始终在 Obsidian vault：`猫只档案与疫苗绝育.md`
- 维护猫只状态、疫苗、绝育、领养和离世信息时，优先更新 Obsidian 档案

## 约束

- 领养记录：只写领养人群名，不写地点等额外信息
- 不记录本人受伤/医疗信息
- 猫名不含括号别名
- `status` 固定枚举：`在校`、`预计领养`、`已领养`、`已离世`、`失踪`
- 日期格式：YYYY-MM-DD；窗口期保留 `6.21~6.28` 格式
- 不确定信息写 `待补充` 或 `未知`，不编造
- 网站搜索：按 Enter 或点「搜索」按钮才触发

## Tab 结构

| Tab | id | 功能 |
|-----|----|------|
| 猫咪档案 | `cats` | 统计 + 搜索/筛选/排序 + 卡片/详情抽屉 |
| 物资管理 | `supplies` | 按类别分组表格 |
| 标准 SOP | `sop` | 可折叠 SOP 条目 |
| 近期计划 | `plans` | 按时间段折叠卡片，章节式内容 |
| 猫猫编年史 | `timeline` | 按月折叠时间线，月份渐变色头部 |
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

## 已知技术决策

- 搜索框使用 keydown Enter + 按钮触发（非 input 事件），避免中文输入法组词中断
- 图片网格使用 thumb 缩略图，点击大图时才加载原图
- CDN URL 必须对中文文件名做 `encodeURIComponent` 编码（见 `references/debug-notes.md`）
- 图片直接通过 GitHub Pages 相对路径加载，无需等待 CDN 缓存刷新

## 参考资料

- `references/debug-notes.md` — 历史 debug 记录
