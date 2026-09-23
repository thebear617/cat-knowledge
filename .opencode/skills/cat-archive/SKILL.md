---
name: cat-archive
description: Use when updating cat association archive website. Covers Astro page structure, structured data, images, content collections, and deploy flow.
---

# 猫协档案站（cats）维护规则

> 本文件与 CodeBuddy 技能副本 `~/.codebuddy/skills/cat-archive/SKILL.md` 内容保持一致，改动请同步两处。

## 仓库与站点

- 仓库：`/Users/mokaiche/Documents/htmls/cats`（独立 git 仓库，远端 `github.com/thebear617/cat-knowledge`，分支 `main`）
- 在线地址：https://thebear617.github.io/cat-knowledge/
- 技术栈：Astro 静态站（当前 v0.17.2），产物 `dist/`；正式构建带 `SITE_BASE=/cat-knowledge/`；根目录另有 `vercel.json`（`/cat-knowledge/:path*` 重写）与 `_headers`（响应头与缓存策略）
- 本地起站：`npm run dev`（端口 4327）

## 目录结构（2026-09-23 核对）

```
js/                       结构化运营数据（唯一事实源，直接改）
  cats.js                 猫只档案 catProfiles
  supplies.js             物资与协作
  roles.js                猫协分工
  timeline.js             猫猫编年史
src/pages/index.astro     主壳页（Tab：首页 / 物资与协作 / 猫猫编年史 / 知识科普 / 财务公示）
src/pages/admin.astro     dev-only CMS（入口 /admin/）
src/scripts/legacy-app.js 渲染逻辑：首页照片墙、猫只卡片、详情抽屉、关系派生
src/content/science/*.md  科普文章（内容集合 science）
css/style.css             主样式表
src/styles/finance.css    财务公示样式
src/styles/knowledge.css  知识科普样式
public/images/{猫名}/     猫咪照片，缩略图在 thumb/ 子目录
add-photo.sh              照片一键处理（sips + 调 scripts/append-cat-photo.mjs 写数据）
scripts/append-cat-photo.mjs  改 cats.js 的 images / photoUpdatedAt
docs/                     规范与阶段记录（猫咪详情悬浮框重构规范、财务公示阶段文档等）
```

## 猫只字段与口径

`catProfiles` 共 18 个键，另有 2 个可选：

```
name / status / vaccine / sterilized / notes / area / gender
images / personality / description
relationships / relationshipHints / updates / aliases
sourceId / sourceImages
可选：photoUpdatedAt（驱动「最近更新」排序）、cover（不写则取 images[0]）
```

口径：

- `status` 三值枚举：`就读中` / `已毕业` / `喵星或失踪`（CSS 胶囊与首页统计都按这三个值）
- `gender`：`公` / `母`（其它值显示中性「·」徽章）
- `vaccine`：靠正则 `一针/二针/三针 202X`（或 ✅）分档；`sterilized` 含「未」字即判未绝育
- `isEmptyValue` 把 `— - 未知 待补充 ❌ 未知/❌未知` 与空值都视为空
- 不确定的信息写 `待补充`，不编造；领养记录只写领养人群名（不写地点等信息），猫名不带括号别名
- `description` 为空时「故事档案」卡片**仍会渲染**并显示「待补充」（与「关系」空态同款灰字）
- 抽屉大图为 1:1 方格（长边变量 `--drawer-photo-long-edge` = 435px），缩略图条满列宽

关系：

- 词表：好友 / 朋友 / 兄弟姐妹 / 兄弟 / 姐妹 / 妈妈 / 母亲 / 爸爸 / 父亲 / 孩子 / 儿子 / 女儿 / 夫妻 / 情侣 / 同事 / 宿敌 / 家族 / 同胎 / 前夫 / 独苗苗
- 对称关系（`SYMMETRIC_RELATIONS`：好友、兄弟姐妹、同事、情侣、宿敌、夫妻）在运行时**双向自动派生**（`derived: true`）；妈妈/爸爸/儿子/女儿 按对方 `gender` 反推 —— 所以**只写一侧即可**，不要两边都写
- 关系对象的 `source` 只有两种：`screenshot-staging`（历史抓取）与 `manual-confirmation`（手录确认，手录一律用后者），手录配 `confidence: "confirmed"`、`evidence: null`

## 照片归档 SOP（最常用）

**一条命令搞定**（脚本会自动编号、出图、写数据）：

```bash
./add-photo.sh <猫名> <照片路径> [更多路径...]
```

它依次做：自动编号 → sips 出原图（长边 1200）+ 缩略图（`thumb/`，长边 400）→ 调 `node scripts/append-cat-photo.mjs` 把相对路径追加进该猫 `images` 数组、并把 `photoUpdatedAt` 同步为当天 → 自检「数组项数 vs 磁盘文件数」并打印结果。

要点：

- 命名 `public/images/{猫名}/{猫名}N.jpg`，`N` = 该目录现有 .jpg 数 + 1。历史遗留拼音名（如 `datou11.jpg`）保持原样，不重命名。
- **不要追求体积区间**：一张图反复重压收益极小还掉画质（2026-09-21/23 的教训）。sips 一次到位即可，内容复杂的图 400KB+ 属正常，只作参考不作指标。
- 脚本只处理**已存在**的猫；**新猫**要先在 `js/cats.js` 手工建档（照抄同区域其它猫的字段结构），再跑脚本 —— 否则脚本会提示「找不到条目」并让你手工追加。
- 写数据由 `scripts/append-cat-photo.mjs` 负责：按 `"name": "<猫名>"` 精确锚定该猫条目，**不会**误命中别猫 relationships 里的 `"relatedCatName": "<猫名>"`；已存在的路径不会重复追加；`photoUpdatedAt` 缺失时会自动补一个。
- 手工兜底（脚本不可用时）：在 `js/cats.js` 里给该猫 `images` 数组**末尾追加**一项（多行数组，末项不加逗号），并改 `photoUpdatedAt` 为当天。
- `cover` **不要动**，除非用户明确要求换首图。
- 缓存坑：`_headers` 给 `/images/*`、`/css/*` 设了 `max-age=31536000, immutable`。**同名文件覆盖内容**线上不会刷新，要么换文件名，要么让用户强刷（Cmd+Shift+R）。
- 校验（脚本已自带大部分）：`node --check js/cats.js`；数组项数 = 原图数 = 缩略图数。

## 构建

- **本地构建用 `npm run build:local`**（= `CODEBUDDY_SAFE_DELETE_ENABLED=0 astro build`）。
- 原因：CodeBuddy 注入的 safe-delete 守卫会拦 astro 收尾清理 `dist/.prerender/`（约 500 个文件，正好贴着阈值 500），普通 `npm run build` 会时灵时不灵地报 `SAFE_DELETE_BULK_CONFIRM_REQUIRED` 并 exit 1 —— 这是**假失败**，静态路由其实已生成完毕。`build` 脚本保持原样给 CI 用，别改。

## 提交与部署

- 提交信息中文，格式 `type: 描述`。
- **加照片实际惯例用 `feat:`**（近 40 条提交里照片类基本是 `feat: xxx新增第N张照片`；`chore` 只出现在改图片处理规则这类事上 —— 早期「加照片统一用 chore」的说法与实际不符，已作废）。
- 版本号：只有较大功能才在标题带 `(vX.Y.Z)`；**不要擅自升 `package.json` 版本号**。
- 部署：`git push origin main` → GitHub Actions（`.github/workflows/deploy.yml`）执行 `npm run build`（`SITE_BASE=/cat-knowledge/`）并发布 `dist/`，通常很快生效。
- 提交前先 `git status` 确认范围：这个仓库常被多个会话同时使用，工作区里可能有**别人留下的未提交改动**，不要顺手带走。

## 参考资料

- `references/debug-notes.md` — 历史 debug 记录（含已废弃的 jsDelivr 时代内容）
- 仓库内 `docs/猫咪详情悬浮框重构规范.md`、`docs/财务公示*.md`
- CodeBuddy 技能副本：`~/.codebuddy/skills/cat-archive/`
