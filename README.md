# 猫协档案展示网站

这是一个纯静态网页项目，只负责展示猫协档案：校园猫状态、疫苗进度、绝育信息、领养去向和备注。

当前部署仓库：

```text
https://github.com/thebear617/cat-knowledge
```

本地维护目录：

```text
/Users/mokaiche/Documents/cats
```

## 项目结构

```text
.
├── index.html
├── css/
│   └── style.css
└── js/
    ├── app.js
    └── cats.js
```

## 数据从哪里来

网页读取的数据文件是：

```text
js/cats.js
```

这个文件定义 `catProfiles`，每只猫一条记录。当前字段包括：

```text
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
```

`js/app.js` 负责读取 `catProfiles`，渲染统计总览、搜索、筛选、猫咪卡片和详情抽屉。

## 事实源头

`js/cats.js` 只是前端展示用的结构化副本，不是最终事实源头。猫协档案的事实源头仍然在 Obsidian vault：

```text
/Users/mokaiche/Documents/notes/01-Projects/猫协/猫只档案与疫苗绝育.md
```

维护猫只状态、疫苗、绝育、领养和离世信息时，优先更新这份 Obsidian 档案。

## 当前更新流程

当前版本还没有自动导出脚本。更新猫协档案网页时按这个流程：

1. 先更新 Obsidian 事实源头：

   ```text
   /Users/mokaiche/Documents/notes/01-Projects/猫协/猫只档案与疫苗绝育.md
   ```

2. 再同步更新本仓库里的结构化数据：

   ```text
   /Users/mokaiche/Documents/cats/js/cats.js
   ```

3. 本地打开 `index.html` 检查页面是否正常。

4. 提交并推送本仓库：

   ```bash
   git status
   git add .
   git commit -m "Update cat archive"
   git push origin main
   ```

网站已通过 GitHub Pages 部署，推送到 `main` 后 GitHub 会自动重新构建部署。

在线地址：https://thebear617.github.io/cat-knowledge/

## 维护规则

- 不要把网站代码提交到 Obsidian vault 的 `thebear617/notes` 仓库。
- 网站代码的正式仓库是 `/Users/mokaiche/Documents/cats`。
- 猫协真实档案仍然维护在 Obsidian vault，不要把 `js/cats.js` 当成唯一事实源。
- 更新猫咪状态时，`status` 建议只使用固定枚举：`在校`、`预计领养`、`已领养`、`已离世`、`失踪`。
- 日期尽量使用 `YYYY-MM-DD`；如果原始记录只有窗口期，可以保留 `6.21~6.28` 这类原文。
- 不确定的信息写 `待补充` 或 `未知`，不要编造。

## 后续推荐改造

下一步建议增加一个导出脚本，把 Obsidian Markdown 自动转换为 `js/cats.js`：

```text
猫只档案与疫苗绝育.md
        ↓
导出脚本
        ↓
js/cats.js
```

这样以后只需要维护 Obsidian 档案，网站数据可以自动生成，避免手工同步两份数据。
