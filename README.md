# 猫猫手册

西电猫猫公开信息展示站，记录校园猫咪档案、物资、行动、财务和科普。

在线地址：[cat.xdubear.cn](https://cat.xdubear.cn)

## 页面

本站是 Astro 静态多页面站点，每个主视图都有独立 URL：

| 页面 | 路径 | 内容 |
| --- | --- | --- |
| 首页 | `/` | 精选猫咪、猫咪档案目录、筛选、分页和档案抽屉 |
| 猫猫编年史 | `/timeline/` | 救助、疫苗、绝育和送养事件时间线 |
| 物资与协作 | `/supplies/` | 物资库存、行动协作和工作流程 |
| 财务公示 | `/finance/` | 公账收支和价格参考 |
| 猫猫知识 | `/knowledge/` | 救助与运营知识文章、分类筛选和文章详情 |

部分页面视图通过查询参数直达：

- `/finance/?view=price`：打开价格参考视图
- `/knowledge/?article=cats-behavior-science`：打开指定知识文章

## 代码结构

- `src/layouts/CatSiteLayout.astro`：所有公开页面共用的站点壳层
- `src/pages/`：各个独立 Astro 页面入口
- `src/scripts/page-entry.js`：当前页面的客户端启动和渲染调度
- `src/scripts/app/`：目录、财务、采购、运营、知识库、导航和公共状态模块
- `js/cats.js`、`js/supplies.js`、`js/timeline.js`：猫咪、物资和编年史数据
- `src/data/finance-snapshot.js`、`src/data/price-snapshot.js`：财务和价格快照
- `src/pages/admin.astro`：本地开发用内容管理页面，生产构建时会移除

## 本地开发

```bash
npm install
npm run dev
```

开发服务器默认运行在 `http://localhost:4327/`。

常用检查：

```bash
npm run build
npm run finance:validate
```

生产部署由 GitHub Actions 完成。GitHub Pages 构建时使用 `SITE_BASE=/cat-knowledge/`，自定义域名由站点配置提供。
