# Debug 笔记

## CDN 图片中文路径不显示

**现象**：本地 `index.html` 图片加载正常，部署到 GitHub Pages 后在线地址显示裂图。

**根因**：`cdnUrl()` 拼接 jsDelivr URL 时，中文路径文件名没有做 URL 编码。部分浏览器/环境下 jsDelivr 不认裸中文 URL。

**修复**：

```js
// Before
function cdnUrl(path) {
  return path.startsWith('http') ? path : CDN_BASE + '/' + path;
}

// After
function cdnUrl(path) {
  if (!path) return path;
  if (path.startsWith('http')) return path;
  const parts = path.split('/').map(encodeURIComponent).join('/');
  return CDN_BASE + '/' + parts;
}
```

中文文件名 `二柑1.jpg` → `%E4%BA%8C%E6%9F%911.jpg`，英文文件名不变。

**验证方法**：

```bash
curl -sI "https://cdn.jsdelivr.net/gh/thebear617/cat-knowledge@main/images/%E4%BA%8C%E6%9F%91/%E4%BA%8C%E6%9F%911.jpg" | head -5
# 应返回 HTTP/2 200
```
