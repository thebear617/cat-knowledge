# Handoff：修复微信内置浏览器侧边栏渲染问题

## 问题

Chrome（桌面+移动）正常，微信内置浏览器（腾讯 X5 内核）中移动端侧边栏展开/收起不可用。

## 方案 A（推荐，先试这个）

删除 `body { overflow: hidden }`，给移动端 sidebar 加 GPU 合成层提示。滚动由 `.main-area` 自己承载。

**css/style.css：**

1. 第 41 行：删除 `overflow: hidden;`，只保留 `height: 100%;`

2. `@media (max-width: 719px)` 中的 `.sidebar`，新增 3 行：

```css
.sidebar {
  position: fixed;
  top: 0; left: 0; bottom: 0;
  z-index: 25;
  -webkit-backface-visibility: hidden;
  -webkit-transform: translateX(-100%);
  transform: translateX(-100%);
  will-change: transform;
  transition: transform .25s ease;
  width: var(--sidebar-w);
}
```

3. 同 `@media` 块中 `body.sidebar-open .sidebar` 补前缀：

```css
body.sidebar-open .sidebar {
  -webkit-transform: translateX(0);
  transform: translateX(0);
}
```

4. 移动端 `.sidebar-toggle` 加 `-webkit-backface-visibility: hidden;`

**js/app.js — 打开时动态锁定 body 滚动：**

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

## 方案 B（如果 A 不奏效）

放弃 `transform`，改用 `left` 属性做动画。`left` 触发 layout，性能差于 transform，但在 X5 中最稳定。

改 `@media (max-width: 719px)` 中的 `.sidebar` 和 `body.sidebar-open .sidebar`，删除所有 `transform` / `-webkit-transform`：

```css
.sidebar {
  position: fixed;
  top: 0; bottom: 0;
  z-index: 25;
  left: calc(-1 * var(--sidebar-w));
  transition: left .25s ease;
  width: var(--sidebar-w);
}

body.sidebar-open .sidebar {
  left: 0;
}
```

## 方案 C（终极兜底）

用 JS `requestAnimationFrame` 手写动画，逐帧更新 `left` 值 + 手动缓动，完全绕过 CSS transition。

## 验证

- 桌面 Chrome（`>=720px`）：侧边栏始终可见
- 移动端 Chrome（`<720px`）：hamburger 展开/收起正常
- 微信内置浏览器：动画正常触发
- 如果方案 A/B 仍不奏效，在微信中打开 `debugx5.qq.com` 查看 X5 内核版本号

---

## 2026-07-01 猫咪状态更新

- **大头、漂亮橘**：`预计领养` → `在校`（对方反悔不退养，暂归在校管理）
- **二橙、二柑、橙留香、裤裤、深情哥**：→ `已领养`

