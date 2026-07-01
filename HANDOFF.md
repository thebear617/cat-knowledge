# Handoff：修复微信内置浏览器侧边栏渲染问题

## 问题描述

`/Users/mkc/Documents/htmls/cat` 是一个纯 HTML/CSS/JS 猫猫手册网站。在 Chrome（桌面+移动端）正常，但在**微信内置浏览器（X5/WebView 内核）**中，移动端侧边栏折叠展开功能失效。

## 根因分析

### 原因 1（主要）：`body { overflow: hidden }` + `position: fixed` 的 X5 兼容性 bug

`css/style.css` 第 41 行：

```css
body {
  overflow: hidden;
}
```

X5 内核在 `body` 有 `overflow: hidden` 时，对 `position: fixed` 子元素会错误地按 `position: absolute` 处理，导致固定定位失效。

**修复方式：** 将 `overflow: hidden` 改为仅在侧边栏或 drawer 打开时通过 JS 动态添加（和已有的 `body.sidebar-open` / `body.drawer-open` 配合）。

### 原因 2（次要）：`transform` 动画未创建 GPU 合成层

`css/style.css` 第 1254-1263 行，移动端 sidebar：

```css
.sidebar {
  position: fixed;
  top: 0; left: 0; bottom: 0;
  z-index: 25;
  transform: translateX(-100%);
  transition: transform .25s ease;
}
```

X5 对 `transform` + `transition` 的动画需要显式触发 GPU 合成层，否则可能跳过重绘，侧边栏始终停留在 `translateX(-100%)` 位置。

**修复方式：** 给 `.sidebar`（在 `@media (max-width: 719px)` 内的那个）添加：

```css
-webkit-backface-visibility: hidden;
will-change: transform;
```

## 具体修改

### 文件：`css/style.css`

1. **第 41 行**：删除 `body` 上的 `overflow: hidden;`

2. **在 `@media (max-width: 719px)` 块内的 `.sidebar` 规则（约第 1254 行）**中新增两行：

```css
-webkit-backface-visibility: hidden;
will-change: transform;
```

3. **确认 `body { height: 100% }` 保留**（第 32 行，已存在，不需要改）

### 文件：`js/app.js`

4. **`openSidebar()` 函数（约第 871 行）**中追加一行锁定 body 滚动：

```javascript
function openSidebar() {
  document.body.classList.add('sidebar-open');
  document.body.style.overflow = 'hidden';
}
```

5. **`closeSidebar()` 函数（约第 870 行）**中追加一行恢复滚动：

```javascript
function closeSidebar() {
  document.body.classList.remove('sidebar-open');
  document.body.style.overflow = '';
}
```

6. **`openDrawer()` 函数（约第 308-310 行）**中已有 `document.body.classList.add('drawer-open')`，确认 `css/style.css` 第 762 行的 `body.drawer-open { overflow: hidden; }` 已覆盖此场景（已存在，不需要改）。

## 验证

- 桌面 Chrome（`>=720px`）：侧边栏始终可见，布局不变
- 移动端 Chrome（`<720px`）：点击 hamburger 菜单展开侧边栏，动画流畅，点击 backdrop 或关闭按钮收起
- **微信内置浏览器**：同上，侧边栏能正常滑入滑出
