import { renderProcurementTab } from './procurement.js';
import { renderSuppliesTab, renderTimelineTab, renderTimelineListView, buildChronicleSearch } from './operations.js';
import { renderScienceTab } from './knowledge.js';
import { state } from './state.js';

function renderMiscTab() {
  const isDiaryList = state.miscView === 'diary-list';
  const isDiaryCalendar = state.miscView === 'diary-calendar';
  const isPrice = state.miscView === 'price';
  const isKnowledge = state.miscView === 'knowledge';
  const isSupplies = state.miscView === 'supplies';
  const view = isDiaryList ? renderTimelineListView() : isDiaryCalendar ? renderTimelineTab() : isPrice ? renderProcurementTab({ embedded: true }) : isKnowledge ? renderScienceTab() : isSupplies ? renderSuppliesTab({ embedded: true }) : renderTimelineListView();
  return `<section class="misc-shell">
    <header class="misc-page-header">
      <div>
        <p>备用视图</p>
        <h1>猫猫杂物</h1>
        <span>暂时不放在主页面，但保留以后可能还会用到的内容。</span>
      </div>
    </header>
    <nav class="misc-view-tabs" aria-label="猫猫杂物视图">
      <button type="button" class="${isDiaryList ? 'is-active' : ''}" data-misc-view="diary-list" aria-current="${isDiaryList ? 'page' : 'false'}">猫咪日记（一）</button>
      <button type="button" class="${isDiaryCalendar ? 'is-active' : ''}" data-misc-view="diary-calendar" aria-current="${isDiaryCalendar ? 'page' : 'false'}">猫咪日记（二）</button>
      <button type="button" class="${isPrice ? 'is-active' : ''}" data-misc-view="price" aria-current="${isPrice ? 'page' : 'false'}">价格参考</button>
      <button type="button" class="${isKnowledge ? 'is-active' : ''}" data-misc-view="knowledge" aria-current="${isKnowledge ? 'page' : 'false'}">猫猫知识</button>
      <button type="button" class="${isSupplies ? 'is-active' : ''}" data-misc-view="supplies" aria-current="${isSupplies ? 'page' : 'false'}">物资库存</button>
    </nav>
    <div class="misc-view-content">
      ${isDiaryList ? `<header class="misc-section-heading"><div><p>记录列表</p><h2>猫咪日记（一）</h2></div>${buildChronicleSearch()}</header>` : ''}
      ${view}
    </div>
  </section>`;
}

function bindMiscControls(renderApp) {
  document.querySelectorAll('[data-misc-view]').forEach(button => button.addEventListener('click', () => {
    const view = button.dataset.miscView;
    state.miscView = ['diary-list', 'diary-calendar', 'price', 'knowledge', 'supplies'].includes(view) ? view : 'diary-list';
    if (state.miscView === 'diary-calendar') state.timelineView = 'diary';
    renderApp();
  }));
}

export { renderMiscTab, bindMiscControls };
