import { financeSnapshot } from '../src/data/finance-snapshot.js';

const allowedTypes = new Set(['cash', 'in_kind', 'placeholder']);
const allowedDirections = new Set(['income', 'expense', 'neutral']);
const issues = [];
const records = financeSnapshot.records;
const ids = new Set();

function fail(message) {
  issues.push(message);
}

for (const record of records) {
  if (ids.has(record.id)) fail(`重复 id：${record.id}`);
  ids.add(record.id);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(record.date || '')) fail(`${record.id} 日期格式错误：${record.date}`);
  if (!/^\d{4}-\d{2}$/.test(record.month || '')) fail(`${record.id} 月份格式错误：${record.month}`);
  if (!allowedTypes.has(record.recordType)) fail(`${record.id} recordType 不在枚举中：${record.recordType}`);
  if (!allowedDirections.has(record.direction)) fail(`${record.id} direction 不在枚举中：${record.direction}`);
  if (record.recordType === 'cash' && (!Number.isFinite(record.amount) || record.amount <= 0)) fail(`${record.id} 现金记录金额无效`);
  if (record.recordType !== 'cash' && record.amount !== null) fail(`${record.id} 非现金记录不应有现金金额`);
  if (record.recordType === 'in_kind' && record.direction !== 'neutral') fail(`${record.id} 实物捐赠方向应为 neutral`);
  if (record.recordType === 'placeholder' && record.reviewStatus !== 'needs_review') fail(`${record.id} 占位记录未标记 needs_review`);
  if (!record.source || record.source.table !== '公账收支表' || !Number.isInteger(record.source.row)) fail(`${record.id} 缺少来源追溯信息`);
  if (!Array.isArray(record.relatedCats) || !Array.isArray(record.relatedCatStatus)) fail(`${record.id} 猫咪字段不是数组`);
  if (record.evidence && (!/^https?:\/\//.test(record.evidence.url) || record.evidence.type !== 'image')) fail(`${record.id} 凭证格式错误`);
}

const cashIncome = records.filter(record => record.recordType === 'cash' && record.direction === 'income');
const cashExpense = records.filter(record => record.recordType === 'cash' && record.direction === 'expense');
const incomeCents = cashIncome.reduce((sum, record) => sum + Math.round(record.amount * 100), 0);
const expenseCents = cashExpense.reduce((sum, record) => sum + Math.round(record.amount * 100), 0);

if (financeSnapshot.meta.generatedFromRows !== records.length) fail('meta.generatedFromRows 与记录数不一致');
if (financeSnapshot.meta.cashIncomeCents !== incomeCents) fail('现金收入汇总不一致');
if (financeSnapshot.meta.cashExpenseCents !== expenseCents) fail('现金支出汇总不一致');
if (financeSnapshot.meta.recordNetCents !== incomeCents - expenseCents) fail('记录净额汇总不一致');

if (issues.length) {
  console.error(`Finance validation failed (${issues.length})`);
  issues.forEach(issue => console.error(`- ${issue}`));
  process.exitCode = 1;
} else {
  console.log(`Finance validation passed: ${records.length} records, income ¥${(incomeCents / 100).toFixed(2)}, expense ¥${(expenseCents / 100).toFixed(2)}, net ¥${((incomeCents - expenseCents) / 100).toFixed(2)}`);
}
