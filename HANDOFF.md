# Handoff：修复微信内置浏览器侧边栏渲染问题

## 问题描述

`/Users/mkc/Documents/htmls/cat` 是纯 HTML/CSS/JS 猫猫手册。Chrome（桌面+移动）正常，**微信内置浏览器（腾讯 X5 内核）**中移动端侧边栏展开/收起不可用。

## 根因分析（基于 web 搜索的第三方来源）

### 原因 1：`overflow: hidden` 导致 `position: fixed` 被 WebKit 错误裁剪

`css/style.css` 第 41 行：

```css
body {
  overflow: hidden;
}
```

**来源**: [miketaylr.com — W3C 规范 vs 实际浏览器渲染分歧](https://miketaylr.com/posts/2015/06/position-fixed-overflow-hidden.html)。W3C 规范说 `position: fixed` 的 containing block 是 viewport，父元素 `overflow: hidden` 应被忽略。但 **Safari（WebKit）和 Android Chrome（Chromium）**在父元素同时存在 `position: relative` + `z-index` 时，会把 `fixed` 当 `absolute` 处理，导致子元素被父级 `overflow: hidden` 裁剪隐藏。X5 基于 Chromium 旧版 WebKit，继承了此 bug。

### 原因 2：X5 内核主动停止滚动期间的 CSS 动画

**来源**: [QQ浏览器X5内核问题汇总 (腾讯 X5 团队官方)](https://www.zhoulujun.cn/html/webfront/browser/x5/2016_0201_465.html) 第 9 条：

> 页面滑动过程中动画不会被触发，页面滑动过程中动画会被停止。这个是 X5 内核为了做滚动优化而做的限制。

用户点击 hamburger 菜单时，如果页面还有惯性滚动未结束，或被 X5 判定处于"滚动态"，`.sidebar` 的 `transition: transform .25s ease` 将被 X5 直接终止。

### 原因 3：`transform` + `transition` 动画在 X5 中不可靠

**来源**: [ipipp.com (2026)](https://www.ipipp.com/html/20260508/2833.html) & [sundawu.cn (2026)](https://www.sundawu.cn/post-225509.html) — 多家开发者报告微信 WebView 中 `transform: translate3d` / `translateX` + `transition` 出现动画卡死、跳过、元素位置错乱等问题。解决方案包括：
- 加 `-webkit-backface-visibility: hidden` + `will-change: transform`
- 补齐 `-webkit-transform` 前缀
- 极端情况**放弃 transform，改用 `left` 属性做动画**

**来源**: [haobala.com (2022)](http://www.haobala.com/answer/2411.html) — 一个与你的场景一模一样的案例：微信侧滑菜单 `transition` 动画中，折叠的侧边栏文字不换行、元素位置错乱。社区回答："这就是腾讯 X5 内核的问题，对一些 css3 的解析不符合标准。"

### 原因 4：微信 `position: fixed` 抖动问题的公认解法

**来源**: [Programmersought](https://www.programmersought.com/article/2326223280/)（引用了张鑫旭 blog《Fixed under the WeChat BUG》）— 微信环境下 `position: fixed` 失效/抖动的标准方案是：**不让 body 做 overflow 容器**，改为由内层容器承载滚动。

---

## 修改方案

### 方案 A（推荐，改动最小，先试这个）

**核心思路**：删除 `body { overflow: hidden }`，给移动端 sidebar 加 GPU 合成层提示。滚动由 `.main-area` 自己承载（它已有 `overflow-y: auto`）。

#### css/style.css

**1. 第 41 行**：删除 `overflow: hidden;`，只保留 `height: 100%;`

```css
body {
  background: var(--bg);
  color: var(--text);
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "Noto Sans SC", sans-serif;
  line-height: 1.6;
  -webkit-font-smoothing: antialiased;
  height: 100%;
}
```

**2. `@media (max-width: 719px)` 中的 `.sidebar` 规则（约 1254 行）**，新增 3 行：

```css
.sidebar {
  position: fixed;
  top: 0;
  left: 0;
  bottom: 0;
  z-index: 25;
  -webkit-backface-visibility: hidden;
  -webkit-transform: translateX(-100%);
  transform: translateX(-100%);
  will-change: transform;
  transition: transform .25s ease;
  width: var(--sidebar-w);
}
```

**3. 同个 `@media` 块中的 `body.sidebar-open .sidebar`（约 1265 行）**也要补前缀：

```css
body.sidebar-open .sidebar {
  -webkit-transform: translateX(0);
  transform: translateX(0);
}
```

**4. 移动端 `.sidebar-toggle`（约 1219 行）**也加 `will-change`：

```css
.sidebar-toggle {
  display: flex;
  /* ... 原有属性保留 ... */
  -webkit-backface-visibility: hidden;
}
```

#### js/app.js — sidebar 打开时动态锁定 body 滚动

```javascript
function openSidebar() {
  document.body.classList.add('sidebar-open');
  document.body.style.overflow = 'hidden';
}

function closeSidebar() {
  document.body.classList.remove('sidebar-open');
  document.body.style.overflow = '';
}
```

---

### 方案 B（如果 A 不奏效，更高可靠性）

**核心思路**：放弃 `transform` 做侧边栏滑出动画，改用 `left` 属性。`left` 会触发 layout 而非 composite，性能差于 transform，但在 X5 中最稳定（sundawu.cn 的终极建议）。

只改 `css/style.css` 的 `@media (max-width: 719px)` 中的 `.sidebar` 和 `body.sidebar-open .sidebar`：

```css
.sidebar {
  position: fixed;
  top: 0;
  bottom: 0;
  z-index: 25;
  left: calc(-1 * var(--sidebar-w));
  transition: left .25s ease;
  width: var(--sidebar-w);
}

body.sidebar-open .sidebar {
  left: 0;
}
```

删除原来的 `transform: translateX(...)` 和对应的 `-webkit-transform`。

---

### 方案 C（终极兜底，方案 B 还不行再用）

用 JS `requestAnimationFrame` 手写动画，完全绕过 CSS transition。参考 [sundawu.cn 方案](https://www.sundawu.cn/post-225509.html) 中的 `requestAnimationFrame` 示例，用 JS 逐帧更新 `left` 值，手动缓动。

---

## 验证

- 桌面 Chrome（`>=720px`）：侧边栏始终可见，布局不变
- 移动端 Chrome（`<720px`）：hamburger 菜单展开/收起正常
- **微信内置浏览器**：同上，动画正常触发
- 如果方案 A/B 仍不奏效，在微信中打开 `debugx5.qq.com` 查看 X5 内核版本号，反馈回来以便进一步排查
