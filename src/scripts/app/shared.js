export function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

export function normalize(value) {
  return String(value ?? '').toLowerCase();
}

export function isEmptyValue(value) {
  return !value || ['—', '-', '未知', '待补充', '❌ 未知', '❌未知'].includes(String(value).trim());
}

export function focusWithoutScrolling(element) {
  try {
    element.focus({ preventScroll: true });
  } catch {
    element.focus();
  }
}
