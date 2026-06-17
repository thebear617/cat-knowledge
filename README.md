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
├── js/
│   ├── app.js
│   └── cats.js
└── images/
    └── {猫名}/
        ├── thumb/       # 缩略图（≤400px，用于网格展示）
        │   ├── xxx.jpg
        │   └── ...
        ├── xxx.jpg      # 原图（≤1200px，用于点击查看大图）
        └── ...
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
images        照片路径数组（相对路径，如 ['images/大头/datou1.jpg']）
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

## 猫咪照片功能

每只猫咪的详情抽屉中有"档案"和"照片"两个 Tab，照片 Tab 展示该猫的照片画廊。

### 添加照片步骤

1. 将照片放入 `images/{猫名}/` 目录，例如 `images/大头/datou1.jpg`
2. 如照片分辨率超过 1200px，先用 `sips` 缩放：

   ```bash
   sips -Z 1200 -s format jpeg 原文件 --out images/大头/datou1.jpg
   ```

3. 生成缩略图（≤400px）用于网格快速加载：

   ```bash
   mkdir -p images/大头/thumb
   sips -Z 400 -s format jpeg images/大头/datou1.jpg --out images/大头/thumb/datou1.jpg
   ```

4. 在 `cats.js` 中对应猫咪的 `images` 数组里添加相对路径：

   ```js
   images: ['images/大头/datou1.jpg', 'images/大头/datou2.jpg', 'images/大头/datou3.jpg']
   ```

5. 提交并推送：

   ```bash
   git add . && git commit -m "feat: add photos for 大头" && git push origin main
   ```

### 图片加载策略

- 照片网格使用 `thumb/` 目录下的缩略图（≤400px，约 30~50KB）
- 点击照片查看大图时才加载原图（≤1200px，约 180~300KB）
- 所有图片通过 jsDelivr CDN 加速，国内访问速度显著优于 GitHub Pages 直连

### jsDelivr CDN 方案

图片和缩略图通过 jsDelivr CDN 分发，URL 格式：

```text
https://cdn.jsdelivr.net/gh/thebear617/cat-knowledge@main/images/{猫名}/{文件名}
```

- `cats.js` 中写相对路径即可，`app.js` 中的 `cdnUrl()` 函数会自动拼出完整 CDN URL
- 如果路径已是完整 URL（如外部图床链接），则不做转换
- jsDelivr 缓存约 1~5 分钟，push 后稍等即可看到更新
- **注意**：如果更新了同名图片的内容但文件名不变，jsDelivr 缓存可能未刷新。解决方法是在 git tag 上打版本号，将 `CDN_BASE` 中的 `@main` 改为 `@v1.1` 等具体版本，jsDelivr 会立即拉取新版本

## 维护规则

- 不要把网站代码提交到 Obsidian vault 的 `thebear617/notes` 仓库。
- 网站代码的正式仓库是 `/Users/mokaiche/Documents/cats`。
- 猫协真实档案仍然维护在 Obsidian vault，不要把 `js/cats.js` 当成唯一事实源。
- 更新猫咪状态时，`status` 建议只使用固定枚举：`在校`、`预计领养`、`已领养`、`已离世`、`失踪`。
- 日期尽量使用 `YYYY-MM-DD`；如果原始记录只有窗口期，可以保留 `6.21~6.28` 这类原文。
- 不确定的信息写 `待补充` 或 `未知`，不要编造。

## 后续推荐改造

- 增加导出脚本，把 Obsidian Markdown 自动转换为 `js/cats.js`：

  ```text
  猫只档案与疫苗绝育.md
          ↓
  导出脚本
          ↓
  js/cats.js
  ```

  这样以后只需要维护 Obsidian 档案，网站数据可以自动生成，避免手工同步两份数据。

- 照片管理自动化：写脚本一键完成原图缩放 + 缩略图生成 + `cats.js` 路径更新

- 如果图片量增大导致仓库膨胀，考虑迁移到阿里云 OSS / 腾讯 COS 等对象存储，`images` 字段改写完整 URL 即可
