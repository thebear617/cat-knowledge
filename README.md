# 猫猫手册

西电猫猫公开信息展示站，记录校园猫咪档案、物资、行动和科普。

🏠 在线地址：https://thebear617.github.io/cat-knowledge/

## 技术架构

本站是 Astro 静态站点：结构化运营数据位于 `js/`，页面与组件位于 `src/`，图片位于 `public/images/`，科普文章使用 `src/content/science/` 下的 Markdown 内容集合。侧边栏的「猫猫知识」会在原有单页壳中切换至文章筛选、三种浏览方式与文内阅读视图。

仓库是唯一事实源，不与 Obsidian 建立同步或双写关系。

## 本地开发与部署

```bash
npm install
npm run dev
npm run build
```

推送 `main` 后，GitHub Actions 构建并部署至 GitHub Pages。
