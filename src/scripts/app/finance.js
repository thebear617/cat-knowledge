import { financeSnapshot } from '../../data/finance-snapshot.js';
import { renderProcurementTab } from './procurement.js';
import { state } from './state.js';
import { escapeHtml, normalize } from './shared.js';

const FINANCE_TYPE_OPTIONS = [
  { value: 'all', label: '全部' },
  { value: 'income', label: '收入' },
  { value: 'expense', label: '支出' },
  { value: 'in_kind', label: '实物' },
  { value: 'placeholder', label: '待核对' },
];
const FINANCE_SORT_OPTIONS = [
  { value: 'latest', label: '最新优先' },
  { value: 'oldest', label: '最早优先' },
];

function financeRecords() {
  return Array.isArray(financeSnapshot.records) ? financeSnapshot.records : [];
}

function financeLatestMonth() {
  return financeRecords().reduce((latest, record) => record.month > latest ? record.month : latest, '');
}

function financeMonthLabel(month) {
  if (!month) return '全部月份';
  const [year, value] = month.split('-');
  return `${year} 年 ${Number(value)} 月`;
}

function financeShortDate(date) {
  if (!date) return '—';
  const [, month, day] = date.split('-');
  return `${month}-${day}`;
}

function financeMoney(value) {
  return `¥ ${Number(value || 0).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function financeTypeLabel(record) {
  if (record.recordType === 'in_kind') return '实物捐赠';
  if (record.recordType === 'placeholder') return '待核对';
  return record.direction === 'income' ? '收入' : '支出';
}

function financeTypeClass(record) {
  if (record.recordType === 'in_kind') return 'is-in-kind';
  if (record.recordType === 'placeholder') return 'is-placeholder';
  return record.direction === 'income' ? 'is-income' : 'is-expense';
}

function financeAmountLabel(record) {
  if (record.recordType === 'in_kind') return '不计入现金收支';
  if (record.recordType === 'placeholder') return '待核对';
  const sign = record.direction === 'income' ? '+' : '-';
  return `${sign} ${financeMoney(record.amount)}`;
}

function financeCategoryOptions() {
  return [...new Set(financeRecords().map(record => record.category).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b, 'zh-CN'));
}

function financeMonthOptions() {
  return [...new Set(financeRecords().map(record => record.month).filter(Boolean))]
    .sort((a, b) => b.localeCompare(a));
}

function getFinanceFiltered() {
  const query = normalize(state.financeQuery.trim());
  const latestMonth = financeLatestMonth();
  const month = state.financeMonth === 'latest'
    ? latestMonth
    : state.financeMonth === 'all' ? '' : state.financeMonth;
  const records = financeRecords().filter(record => {
    const haystack = normalize([
      record.description,
      record.category,
      record.note,
      ...record.relatedCats,
      ...record.relatedCatsRaw
    ].join(' '));
    const typeMatches = state.financeType === 'all'
      || (state.financeType === 'income' && record.direction === 'income' && record.recordType === 'cash')
      || (state.financeType === 'expense' && record.direction === 'expense' && record.recordType === 'cash')
      || state.financeType === record.recordType;
    return (!query || haystack.includes(query))
      && typeMatches
      && (state.financeCategory === '全部' || record.category === state.financeCategory)
      && (!month || record.month === month);
  });

  return records.sort((a, b) => {
    const dateOrder = a.date.localeCompare(b.date);
    const sourceOrder = a.source.row - b.source.row;
    return state.financeSort === 'oldest'
      ? dateOrder || sourceOrder
      : -dateOrder || -sourceOrder;
  });
}

function groupFinanceRecords(records) {
  const groups = new Map();
  records.forEach(record => {
    if (!groups.has(record.month)) groups.set(record.month, []);
    groups.get(record.month).push(record);
  });
  return [...groups.entries()];
}

function financeIcon(kind) {
  const common = 'fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"';
  const icons = {
    income: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7.5h13.5a2 2 0 0 1 2 2V18a2 2 0 0 1-2 2H5.5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h10" ${common}/><path d="M16 12h4M16.5 12a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3Z" ${common}/></svg>`,
    expense: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7.5h13.5a2 2 0 0 1 2 2V18a2 2 0 0 1-2 2H5.5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h10" ${common}/><path d="m15 12 3 3-3 3M18 15h-7" ${common}/></svg>`,
    net: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3.5a8.5 8.5 0 1 1-6 2.5" ${common}/><path d="M12 7v5l3 2M4 4v5h5" ${common}/></svg>`,
    record: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 3.5h9l3 3V20a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4.5a1 1 0 0 1 1-1Z" ${common}/><path d="M14.5 3.5V7H18M8 11h8M8 14.5h8M8 18h4" ${common}/></svg>`,
  };
  return icons[kind] || icons.record;
}

function renderFinanceTypeTag(record) {
  const review = record.reviewStatus === 'needs_review' && record.recordType !== 'placeholder'
    ? '<span class="finance-review-dot" title="有字段待核对" aria-label="有字段待核对">·</span>'
    : '';
  return `<span class="finance-type-tag ${financeTypeClass(record)}">${escapeHtml(financeTypeLabel(record))}${review}</span>`;
}

function renderFinanceAmount(record) {
  if (record.recordType !== 'cash') return `<span class="finance-amount finance-amount--muted">${escapeHtml(financeAmountLabel(record))}</span>`;
  return `<span class="finance-amount ${record.direction === 'income' ? 'finance-amount--income' : 'finance-amount--expense'}">${escapeHtml(financeAmountLabel(record))}</span>`;
}

function renderFinanceRow(record) {
  const selected = state.selectedFinanceId === record.id;
  const relatedCats = record.relatedCats.length ? record.relatedCats.join('、') : '—';
  const note = record.note || (record.recordType === 'in_kind' ? '实物捐赠，不计入现金收支' : '');
  return `<button class="finance-ledger-row${selected ? ' is-selected' : ''}" type="button" data-finance-record="${escapeHtml(record.id)}" aria-pressed="${selected}" aria-label="查看 ${escapeHtml(record.description || financeTypeLabel(record))} 的账目详情">
    <span class="finance-date-cell"><time datetime="${escapeHtml(record.date)}">${escapeHtml(financeShortDate(record.date))}</time></span>
    <span>${renderFinanceTypeTag(record)}</span>
    <span class="finance-item-cell"><strong>${escapeHtml(record.description || '未填写事项')}</strong>${note ? `<small>${escapeHtml(note)}</small>` : ''}</span>
    <span class="finance-category-cell">${escapeHtml(record.category || '待分类')}</span>
    <span class="finance-cats-cell">${escapeHtml(relatedCats)}</span>
    <span>${renderFinanceAmount(record)}</span>
    <span class="finance-evidence-cell">${record.evidence ? '<span class="finance-evidence-link">查看</span>' : '—'}</span>
  </button>`;
}

function renderFinanceDetail(record) {
  if (!record) {
    return `<aside class="finance-detail-card finance-detail-card--empty" aria-label="账目详情"><div class="finance-detail-empty-icon">${financeIcon('record')}</div><h2>选择一条账目</h2><p>点击左侧记录，查看完整的公开字段和凭证信息。</p></aside>`;
  }
  const catStatus = record.relatedCatStatus || [];
  const hasUnmappedCat = catStatus.some(item => item.status === 'unmapped');
  const cats = record.relatedCats.length ? record.relatedCats.map(name => `<span>${escapeHtml(name)}</span>`).join('') : '<span>—</span>';
  const evidence = record.evidence ? `<figure class="finance-evidence"><a href="${escapeHtml(record.evidence.url)}" target="_blank" rel="noopener noreferrer"><img src="${escapeHtml(record.evidence.url)}" alt="${escapeHtml(record.description || '账目凭证')}" loading="lazy"><span>在新窗口查看原始凭证 ↗</span></a></figure>` : '<div class="finance-no-evidence">暂无公开凭证</div>';
  return `<aside class="finance-detail-card" aria-label="账目详情">
    <header class="finance-detail-header"><div><span class="finance-detail-kicker">账目详情</span><h2>${escapeHtml(record.description || '未填写事项')}</h2></div><span class="finance-detail-source">#${escapeHtml(record.source.row)}</span></header>
    <dl class="finance-detail-facts">
      <div><dt>日期</dt><dd>${escapeHtml(record.date)}</dd></div>
      <div><dt>类型</dt><dd>${renderFinanceTypeTag(record)}</dd></div>
      <div><dt>类别</dt><dd>${escapeHtml(record.category || '待分类')}</dd></div>
      <div><dt>金额</dt><dd class="finance-detail-amount">${renderFinanceAmount(record)}</dd></div>
    </dl>
    <dl class="finance-detail-facts finance-detail-facts--secondary">
      <div><dt>事项</dt><dd>${escapeHtml(record.description || '—')}</dd></div>
      <div><dt>关联猫咪</dt><dd class="finance-cat-pills">${cats}${hasUnmappedCat ? '<small>名称待核对</small>' : ''}</dd></div>
      <div><dt>公开备注</dt><dd>${escapeHtml(record.note || (record.recordType === 'in_kind' ? '实物捐赠，不计入现金收支。' : '—'))}</dd></div>
    </dl>
    <section class="finance-detail-evidence"><h3>公开凭证</h3>${evidence}</section>
    <footer class="finance-detail-footer">来源：${escapeHtml(record.source.table)} · 第 ${escapeHtml(record.source.row)} 行</footer>
  </aside>`;
}

function renderFinanceSummaryCard(kind, label, amount, count, hint) {
  return `<article class="finance-summary-card finance-summary-card--${kind}"><span class="finance-summary-icon">${financeIcon(kind === 'net' ? 'net' : kind)}</span><div><span class="finance-summary-label">${label}</span><strong>${escapeHtml(amount)}</strong><small>${escapeHtml(count)}</small>${hint ? `<em>${escapeHtml(hint)}</em>` : ''}</div></article>`;
}

function renderFinanceLedgerView() {
  const filtered = getFinanceFiltered();
  if (!state.selectedFinanceId || !filtered.some(record => record.id === state.selectedFinanceId)) {
    state.selectedFinanceId = filtered[0]?.id || null;
  }
  const selected = filtered.find(record => record.id === state.selectedFinanceId) || null;
  const groups = groupFinanceRecords(filtered);
  const latestMonth = financeLatestMonth();
  const categories = financeCategoryOptions();
  const months = financeMonthOptions();
  const incomeCount = financeRecords().filter(record => record.recordType === 'cash' && record.direction === 'income').length;
  const expenseCount = financeRecords().filter(record => record.recordType === 'cash' && record.direction === 'expense').length;
  const income = financeSnapshot.meta.cashIncomeCents / 100;
  const expense = financeSnapshot.meta.cashExpenseCents / 100;
  const net = financeSnapshot.meta.recordNetCents / 100;
  const monthValue = state.financeMonth === 'latest' ? latestMonth : state.financeMonth;
  const monthLabel = monthValue === 'all' ? '全部月份' : financeMonthLabel(monthValue);
  const monthOptions = [`<option value="all"${state.financeMonth === 'all' ? ' selected' : ''}>全部月份</option>`].concat(months.map(month => `<option value="${escapeHtml(month)}"${state.financeMonth === month ? ' selected' : ''}>${escapeHtml(financeMonthLabel(month))}</option>`)).join('');
  const categoryOptions = [`<option value="全部"${state.financeCategory === '全部' ? ' selected' : ''}>全部类别</option>`].concat(categories.map(category => `<option value="${escapeHtml(category)}"${state.financeCategory === category ? ' selected' : ''}>${escapeHtml(category)}</option>`)).join('');
  const sortOptions = FINANCE_SORT_OPTIONS.map(option => `<option value="${option.value}"${state.financeSort === option.value ? ' selected' : ''}>${option.label}</option>`).join('');
  const typeButtons = FINANCE_TYPE_OPTIONS.slice(0, 4).map(option => `<button type="button" class="finance-filter-chip${state.financeType === option.value ? ' is-active' : ''}" data-finance-type="${option.value}" aria-pressed="${state.financeType === option.value}">${option.label}</button>`).join('');
  const listBody = groups.length ? groups.map(([month, records]) => `<section class="finance-month-group"><header><h2>${escapeHtml(financeMonthLabel(month))}</h2><span>${records.length} 条记录</span></header><div class="finance-ledger-table"><div class="finance-ledger-head" aria-hidden="true"><span>日期</span><span>类型</span><span>事项</span><span>类别</span><span>关联猫咪</span><span>金额</span><span>凭证</span></div>${records.map(renderFinanceRow).join('')}</div></section>`).join('') : `<div class="finance-empty-state"><div>⌕</div><h2>没有匹配的账目</h2><p>试试清空搜索，或放宽筛选条件。</p><button type="button" data-finance-reset>清除筛选</button></div>`;
  return `<div class="finance-ledger-view">
    <section class="finance-summary-grid" aria-label="账目汇总">
      ${renderFinanceSummaryCard('income', '现金收入', financeMoney(income), `${incomeCount} 笔记录`, '')}
      ${renderFinanceSummaryCard('expense', '现金支出', financeMoney(expense), `${expenseCount} 笔记录`, '')}
      ${renderFinanceSummaryCard('net', '记录净额', financeMoney(net), '不代表账户余额', '')}
    </section>
    <div class="finance-content-grid">
      <section class="finance-ledger-card" aria-label="账目列表">
        <div class="finance-toolbar">
          <div class="finance-search"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M11 4.5a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13Zm7.5 14-3-3" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg><input id="financeSearchInput" type="search" placeholder="搜索事项 / 猫咪 / 类别" value="${escapeHtml(state.financeQuery)}" aria-label="搜索事项、猫咪或类别"><button type="button" id="financeSearchButton" aria-label="搜索">搜索</button></div>
          <div class="finance-filter-chips" role="group" aria-label="按类型筛选">${typeButtons}</div>
          <label class="finance-select-wrap"><span class="sr-only">类别</span><select id="financeCategorySelect" aria-label="按类别筛选">${categoryOptions}</select></label>
          <label class="finance-select-wrap"><span class="sr-only">月份</span><select id="financeMonthSelect" aria-label="按月份筛选"><option value="latest"${state.financeMonth === 'latest' ? ' selected' : ''}>最新月份</option>${monthOptions}</select></label>
          <label class="finance-select-wrap finance-sort-select"><span class="sr-only">排序</span><select id="financeSortSelect" aria-label="排序">${sortOptions}</select></label>
        </div>
        <div class="finance-list-heading"><div><span>公开账目</span><strong>${escapeHtml(monthLabel)}</strong></div><span>${filtered.length} 条匹配记录</span></div>
        <div class="finance-list-body">${listBody}</div>
        <footer class="finance-ledger-footer"><span>共 ${filtered.length} 条记录</span><span>数据截至 ${escapeHtml(financeSnapshot.meta.cutoffDate)}</span></footer>
      </section>
      ${renderFinanceDetail(selected)}
    </div>
  </div>`;
}

function renderFinanceTab() {
  const isLedger = state.financeView === 'ledger';
  return `<section class="finance-shell">
    <header class="finance-page-header"><div><p class="finance-eyebrow">XDU CAT · PUBLIC LEDGER</p><div class="finance-title-line"><h1>财务公示</h1><p>记录每一份善意的来处，也记录它最终去了哪里。</p></div></div><span class="finance-cutoff">▣ &nbsp;数据截至 ${escapeHtml(financeSnapshot.meta.cutoffDate)}</span></header>
    <nav class="finance-view-tabs" aria-label="财务公示视图"><button type="button" class="${isLedger ? 'is-active' : ''}" data-finance-view="ledger" aria-current="${isLedger ? 'page' : 'false'}"><span>▣</span>账目公示</button><button type="button" class="${!isLedger ? 'is-active' : ''}" data-finance-view="price" aria-current="${!isLedger ? 'page' : 'false'}"><span>◇</span>价格参考</button></nav>
    ${isLedger ? renderFinanceLedgerView() : `<div class="finance-price-view">${renderProcurementTab({ embedded: true })}</div>`}
    <footer class="finance-page-footer"><span>♣ &nbsp;每一笔收支，都用于帮助猫咪。感谢所有支持与信任。</span><span>让更多小生命被看见，让温暖持续发生。 ♡</span></footer>
  </section>`;
}

function bindFinanceControls(renderApp) {
  if (state.activeTab !== 'finance') return;

  document.querySelectorAll('[data-finance-view]').forEach(button => {
    button.addEventListener('click', () => {
      state.financeView = button.dataset.financeView === 'price' ? 'price' : 'ledger';
      renderApp();
    });
  });

  const searchInput = document.getElementById('financeSearchInput');
  const searchButton = document.getElementById('financeSearchButton');
  const doSearch = () => {
    const value = searchInput?.value.trim() || '';
    if (value === state.financeQuery) return;
    state.financeQuery = value;
    renderApp();
  };
  searchInput?.addEventListener('keydown', event => {
    if (event.key === 'Enter') {
      event.preventDefault();
      doSearch();
    }
  });
  searchButton?.addEventListener('click', doSearch);

  document.querySelectorAll('[data-finance-type]').forEach(button => {
    button.addEventListener('click', () => {
      state.financeType = button.dataset.financeType || 'all';
      renderApp();
    });
  });

  document.getElementById('financeCategorySelect')?.addEventListener('change', event => {
    state.financeCategory = event.target.value || '全部';
    renderApp();
  });
  document.getElementById('financeMonthSelect')?.addEventListener('change', event => {
    state.financeMonth = event.target.value || 'latest';
    renderApp();
  });
  document.getElementById('financeSortSelect')?.addEventListener('change', event => {
    state.financeSort = event.target.value === 'oldest' ? 'oldest' : 'latest';
    renderApp();
  });

  document.querySelectorAll('[data-finance-record]').forEach(button => {
    button.addEventListener('click', () => {
      state.selectedFinanceId = button.dataset.financeRecord;
      renderApp();
      document.querySelector('.finance-detail-card')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    });
  });

  document.querySelector('[data-finance-reset]')?.addEventListener('click', () => {
    state.financeQuery = '';
    state.financeType = 'all';
    state.financeCategory = '全部';
    state.financeMonth = 'latest';
    state.financeSort = 'latest';
    state.selectedFinanceId = null;
    renderApp();
  });
}

export { renderFinanceTab, bindFinanceControls };
