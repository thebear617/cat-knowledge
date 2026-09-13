import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(SCRIPT_DIR, '..');
const DEFAULT_SOURCE = '/Users/mokaiche/Downloads/05-猫猫素材/scripts/类型二-自身请求体/腾讯文档/out/公账收支表.csv';
const sourcePath = process.env.CATS_FINANCE_SOURCE || DEFAULT_SOURCE;
const sourceName = path.basename(sourcePath);
const outputPath = path.join(ROOT_DIR, 'src/data/finance-snapshot.js');
const auditPath = path.join(ROOT_DIR, 'data/finance-audit.json');

const ALIASES = {
  渣男: '赫兹',
};

function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];
    if (quoted) {
      if (char === '"' && next === '"') {
        field += '"';
        index += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        field += char;
      }
    } else if (char === '"') {
      quoted = true;
    } else if (char === ',') {
      row.push(field);
      field = '';
    } else if (char === '\n') {
      row.push(field.replace(/\r$/, ''));
      rows.push(row);
      row = [];
      field = '';
    } else {
      field += char;
    }
  }

  if (field.length || row.length) {
    row.push(field.replace(/\r$/, ''));
    rows.push(row);
  }

  return rows;
}

function clean(value) {
  return String(value ?? '').replace(/^\uFEFF/, '').trim();
}

function parseMoney(value) {
  const text = clean(value).replace(/[¥￥,\s]/g, '');
  if (!text) return null;
  const number = Number(text.replace(/[+]/g, ''));
  if (!Number.isFinite(number)) return null;
  return Math.round(number * 100);
}

function parseDate(value) {
  const match = clean(value).match(/^(\d{4})年(\d{1,2})月(\d{1,2})日$/);
  if (!match) return null;
  const [, year, month, day] = match;
  return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
}

function parseCats(value) {
  return clean(value)
    .split(/[、，,;；/／]+/)
    .map(item => item.trim())
    .filter(item => item && !['—', '-', '无'].includes(item));
}

function moneyNumber(cents) {
  return cents == null ? null : cents / 100;
}

function sortByDateThenSource(a, b) {
  return a.date.localeCompare(b.date) || a.source.row - b.source.row;
}

function buildRecord(raw, row, knownCats) {
  const incomeCents = parseMoney(raw['收入']);
  const expenseCents = parseMoney(raw['支出']);
  const description = clean(raw['事项']);
  const category = clean(raw['类别']);
  const date = parseDate(raw['日期']);
  const relatedCatsRaw = parseCats(raw['相关猫猫']);
  const relatedCatStatus = relatedCatsRaw.map(rawName => {
    const resolvedName = ALIASES[rawName] || rawName;
    const status = ALIASES[rawName]
      ? 'alias'
      : knownCats.has(resolvedName) ? 'known' : 'unmapped';
    return { rawName, name: resolvedName, status };
  });
  const hasIncome = incomeCents != null && incomeCents > 0;
  const hasExpense = expenseCents != null && expenseCents > 0;
  const isInKind = !hasIncome && !hasExpense && category === '捐赠收入' && Boolean(description);
  const isPlaceholder = !hasIncome && !hasExpense && !category && !description && !clean(raw['备注']);
  const direction = hasIncome && !hasExpense ? 'income' : hasExpense && !hasIncome ? 'expense' : 'neutral';
  const recordType = isInKind ? 'in_kind' : isPlaceholder ? 'placeholder' : 'cash';
  const amountCents = hasIncome ? incomeCents : hasExpense ? expenseCents : null;
  const note = clean(raw['备注']);
  const evidenceUrl = clean(raw['备注图片']);
  const reviewStatus = isPlaceholder || relatedCatStatus.some(item => item.status === 'unmapped')
    ? 'needs_review'
    : 'verified';

  return {
    id: `ledger-${String(row).padStart(3, '0')}`,
    date,
    month: date ? date.slice(0, 7) : null,
    recordType,
    direction,
    amount: moneyNumber(amountCents),
    category: category || null,
    description: description || null,
    relatedCats: relatedCatStatus.map(item => item.name),
    relatedCatsRaw: relatedCatsRaw.length ? relatedCatsRaw : [],
    relatedCatStatus,
    note: note || null,
    evidence: evidenceUrl.startsWith('http') ? { type: 'image', url: evidenceUrl } : null,
    source: { table: '公账收支表', row },
    visibility: 'public',
    reviewStatus,
    _amountCents: amountCents,
    _reportedBalanceCents: parseMoney(raw['余额']),
  };
}

function stripPrivateFields(record) {
  const { _amountCents, _reportedBalanceCents, ...publicRecord } = record;
  return publicRecord;
}

function buildAudit(records, rawRows) {
  const publicRecords = records.map(stripPrivateFields);
  const dated = publicRecords.filter(record => record.date).sort(sortByDateThenSource);
  const cashRecords = publicRecords.filter(record => record.recordType === 'cash');
  const cashIncome = cashRecords.filter(record => record.direction === 'income');
  const cashExpense = cashRecords.filter(record => record.direction === 'expense');
  const categoryCounts = publicRecords.reduce((counts, record) => {
    const category = record.category || '<空>';
    counts[category] = (counts[category] || 0) + 1;
    return counts;
  }, {});
  const catIssues = publicRecords.flatMap(record => record.relatedCatStatus)
    .filter(item => item.status === 'unmapped')
    .reduce((counts, item) => {
      counts[item.name] = (counts[item.name] || 0) + 1;
      return counts;
    }, {});
  const aliasCounts = publicRecords.flatMap(record => record.relatedCatStatus)
    .filter(item => item.status === 'alias')
    .reduce((counts, item) => {
      counts[`${item.rawName} → ${item.name}`] = (counts[`${item.rawName} → ${item.name}`] || 0) + 1;
      return counts;
    }, {});

  let runningCents = 0;
  const runningRows = dated.map(record => {
    if (record.direction === 'income' && record.amount != null) runningCents += Math.round(record.amount * 100);
    if (record.direction === 'expense' && record.amount != null) runningCents -= Math.round(record.amount * 100);
    const original = records.find(item => item.id === record.id);
    return { record, original, runningCents };
  });
  const balanceRows = runningRows.filter(item => item.original._reportedBalanceCents != null);
  const balanceMatches = balanceRows.filter(item => item.original._reportedBalanceCents === item.runningCents).length;

  const duplicateGroups = Object.entries(publicRecords.reduce((groups, record) => {
    const key = [record.description || '', record.direction, record.amount ?? '', record.relatedCats.join('|')].join('¦');
    groups[key] ||= [];
    groups[key].push(record.source.row);
    return groups;
  }, {})).filter(([, rows]) => rows.length > 1).map(([key, rows]) => ({ key, rows }));

  return {
    source: sourceName,
    sourceRowCount: rawRows.length - 1,
    recordCount: publicRecords.length,
    dateRange: {
      from: dated[0]?.date || null,
      to: dated.at(-1)?.date || null,
    },
    categoryCounts,
    cashIncome: {
      count: cashIncome.length,
      cents: cashIncome.reduce((sum, record) => sum + Math.round(record.amount * 100), 0),
    },
    cashExpense: {
      count: cashExpense.length,
      cents: cashExpense.reduce((sum, record) => sum + Math.round(record.amount * 100), 0),
    },
    inKindCount: publicRecords.filter(record => record.recordType === 'in_kind').length,
    placeholderCount: publicRecords.filter(record => record.recordType === 'placeholder').length,
    evidenceCount: publicRecords.filter(record => record.evidence).length,
    balanceAudit: {
      populatedCount: balanceRows.length,
      matches: balanceMatches,
      mismatches: balanceRows.length - balanceMatches,
      note: '余额为来源字段核验结果，不作为公开账户余额。',
    },
    unmappedCatNames: catIssues,
    aliasCounts,
    duplicateGroups,
  };
}

const sourceText = fs.readFileSync(sourcePath, 'utf8');
const rawRows = parseCsv(sourceText);
if (rawRows.length < 2) throw new Error(`财务来源没有数据行：${sourcePath}`);

const headers = rawRows[0].map(clean);
const rawRecords = rawRows.slice(1)
  .filter(row => row.some(value => clean(value)))
  .map(row => headers.reduce((record, header, index) => {
    record[header] = row[index] ?? '';
    return record;
  }, {}));
const { catProfiles } = await import('../js/cats.js');
const knownCats = new Set(catProfiles.map(cat => cat.name));
const records = rawRecords.map((raw, index) => buildRecord(raw, index + 2, knownCats));
const audit = buildAudit(records, [headers, ...rawRecords.map(raw => headers.map(header => raw[header] || ''))]);
const publicRecords = records.map(stripPrivateFields);
const snapshot = {
  meta: {
    source: sourceName,
    cutoffDate: audit.dateRange.to,
    generatedFromRows: audit.sourceRowCount,
    cashIncomeCents: audit.cashIncome.cents,
    cashExpenseCents: audit.cashExpense.cents,
    recordNetCents: audit.cashIncome.cents - audit.cashExpense.cents,
  },
  records: publicRecords,
};

fs.writeFileSync(outputPath, `// Generated from ${sourceName}; edit the source data and rerun finance:generate.\nexport const financeSnapshot = ${JSON.stringify(snapshot, null, 2)};\n`);
fs.writeFileSync(auditPath, `${JSON.stringify(audit, null, 2)}\n`);
console.log(`Generated ${publicRecords.length} finance records → ${path.relative(ROOT_DIR, outputPath)}`);
console.log(`Audit: income ${audit.cashIncome.count} / expense ${audit.cashExpense.count} / in-kind ${audit.inKindCount} / placeholder ${audit.placeholderCount}`);
