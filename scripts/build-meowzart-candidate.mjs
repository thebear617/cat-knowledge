#!/usr/bin/env node

import fs from 'node:fs/promises';
import path from 'node:path';
import { catProfiles } from '../js/cats.js';

const ROOT = path.resolve(new URL('..', import.meta.url).pathname);
const INPUT = path.join(ROOT, 'data/meowzart-api-export.json');
const OUTPUT = path.join(ROOT, 'data/meowzart-cats-candidate.json');
const STAGING_INPUT = path.join(ROOT, 'data/meowzart-cats-staging.json');
const CHECK_OUTPUT = path.join(ROOT, 'data/meowzart-cats-alignment-check.json');
const IMAGE_MANIFEST_INPUT = path.join(ROOT, 'data/meowzart-local-image-manifest.json');

const STATUS_MAP = {
  school: '就读中',
  finish: '已毕业',
  die: '喵星或失踪',
  disappear: '喵星或失踪',
};

// 已由人工确认的身份、状态和关系决策。这里只影响候选生成，不改动 js/cats.js。
const CURRENT_NAME_RENAMES = {
  胆小橘: '邪恶橘白',
};

const CURRENT_STATUS_OVERRIDES = {
  邪恶橘白: '就读中',
};

const API_CURRENT_NAME_ALIASES = {
  丁香奶牛: '邪恶奶牛',
};

const API_STATUS_OVERRIDES = {
  二柑: '已毕业',
  焦炭馒头: '喵星或失踪',
};

const API_CANONICAL_NAMES = {
  '胖琥/琥珀': '胖琥',
  '毛柿子/枣糕': '毛柿子',
  '牛奶/中分头': '牛奶',
  '盼盼/小面包': '盼盼',
  '焦黄/教皇': '焦黄',
  '香香/郁金香': '香香',
  '小刀疤/小刀': '小刀',
  '牛牛/楼长': '楼长',
  '茶叶/咪咪': '茶叶',
};

const API_STERILIZATION_OVERRIDES = {
  粤利粤: '待补充',
  奶泡: '未绝育',
  三橘: '待补充',
  竹园小老大: '待补充',
  来财: '待补充',
  绿豆: '待补充',
  潇洒哥: '已绝育',
};

const API_GENDER_OVERRIDES = {
  三橘: null,
  潇洒哥: '公',
  奶咖: '公',
  丁香奶牛: '公',
};

const RELATIONSHIP_OVERRIDES = [
  { sourceName: '瓜皮头', relatedCatName: '麻薯', relation: '夫妻' },
  { sourceName: '斜眼狼', relatedCatName: '黑哥', relation: '夫妻' },
  { sourceName: '大头', relatedCatName: '一头', remove: true },
];

const CURRENT_FIELDS = [
  'name',
  'status',
  'vaccine',
  'sterilized',
  'notes',
  'area',
  'gender',
  'images',
];

const EXPANDED_FIELDS = [
  'personality',
  'description',
  'relationships',
  'relationshipHints',
  'updates',
  'aliases',
  'sourceId',
  'sourceImages',
];

const RELATION_TERMS = [
  ['兄弟姐妹', '兄弟姐妹'],
  ['好朋友', '好友'],
  ['好朋咪', '好友'],
  ['前夫', '前夫'],
  ['宿敌', '宿敌'],
  ['夫妻', '夫妻'],
  ['情侣', '情侣'],
  ['兄弟', '兄弟'],
  ['姐妹', '姐妹'],
  ['儿子', '儿子'],
  ['女儿', '女儿'],
  ['妈妈', '妈妈'],
  ['母亲', '母亲'],
  ['爸爸', '爸爸'],
  ['父亲', '父亲'],
  ['孩子', '孩子'],
  ['同胎', '同胎'],
  ['同窝', '同窝'],
  ['独苗苗', '独苗苗'],
  ['家族', '家族'],
  ['好友', '好友'],
  ['朋友', '朋友'],
].sort((a, b) => b[0].length - a[0].length);

function getDetail(pet) {
  return pet.detail?.body?.response ?? {};
}

function getInfo(pet) {
  return getDetail(pet).info ?? {};
}

function getContentItems(pet) {
  return pet.contents?.pages?.flatMap((page) => page.body?.response ?? []) ?? [];
}

function mapGender(value, apiName) {
  if (Object.hasOwn(API_GENDER_OVERRIDES, apiName)) return API_GENDER_OVERRIDES[apiName];
  if (value === 'male') return '公';
  if (value === 'female') return '母';
  return null;
}

function inferArea(story) {
  if (!story) return null;
  const areaTerms = [
    ['竹园', '竹园'],
    ['丁香', '丁香'],
    ['海棠', '海棠'],
    ['教学区', '教学区'],
    ['教学楼', '教学区'],
  ];
  const matches = areaTerms
    .map(([term, area]) => ({ term, area, index: story.lastIndexOf(term) }))
    .filter((match) => match.index >= 0)
    .sort((a, b) => b.index - a.index);
  return matches[0]?.area ?? null;
}

function mapSterilized(detail, info, apiName) {
  if (Object.hasOwn(API_STERILIZATION_OVERRIDES, apiName)) return API_STERILIZATION_OVERRIDES[apiName];
  if (detail.jueyuStatus === 'yes') {
    return info.jueyuTime ? `已绝育（${info.jueyuTime}）` : '已绝育（日期待补充）';
  }
  if (detail.jueyuStatus === 'no') return '未绝育';
  return '待补充';
}

function getImageCandidates(pet) {
  const detail = getDetail(pet);
  const info = getInfo(pet);
  const photos = Array.isArray(info.photos) ? info.photos.filter((value) => typeof value === 'string') : [];
  return [...new Set([detail.avatar, ...photos].filter((value) => typeof value === 'string' && value))];
}

function collectImageUrls(value, key = '', output = new Set()) {
  if (typeof value === 'string') {
    const isUrl = /^https?:\/\//i.test(value);
    const imageKey = /image|img|cover|avatar|photo|picture|pic|thumb/i.test(key);
    const imageExtension = /\.(?:avif|gif|jpe?g|png|webp)(?:[?#].*)?$/i.test(value);
    if (isUrl && (imageKey || imageExtension)) output.add(value);
    return output;
  }
  if (Array.isArray(value)) {
    for (const child of value) collectImageUrls(child, key, output);
    return output;
  }
  if (value && typeof value === 'object') {
    for (const [childKey, child] of Object.entries(value)) collectImageUrls(child, childKey, output);
  }
  return output;
}

function buildNameResolver(pets, currentByName) {
  const resolver = new Map();
  for (const currentName of currentByName.keys()) resolver.set(currentName, currentName);
  for (const pet of pets) {
    const detail = getDetail(pet);
    const apiName = detail.name ?? pet.nameFromList ?? `未命名-${pet.id}`;
    const match = findMatch(apiName, currentByName);
    const displayName = match.currentName ?? API_CANONICAL_NAMES[apiName] ?? apiName;
    resolver.set(apiName, displayName);
    for (const part of apiName.split('/').map((value) => value.trim()).filter(Boolean)) {
      if (!resolver.has(part)) resolver.set(part, displayName);
    }
  }
  return resolver;
}

function resolveRelatedName(rawName, nameResolver) {
  if (!rawName) return rawName;
  if (nameResolver.has(rawName)) return nameResolver.get(rawName);
  const parts = rawName.split('/').map((value) => value.trim()).filter(Boolean);
  const matches = parts.map((part) => nameResolver.get(part)).filter(Boolean);
  return matches.length === 1 ? matches[0] : rawName;
}

function normalizeStagingRelationships(stagingRecord, nameResolver) {
  const rawRelationships = stagingRecord?.sourceFields?.relationships ?? [];
  return rawRelationships.map((relationship) => {
    const relatedName = relationship.catName ?? relationship.relatedCatName ?? null;
    const normalized = {
      relatedCatName: resolveRelatedName(relatedName, nameResolver),
      relation: relationship.relation ?? null,
      confidence: relationship.confirmed === false ? 'suspected' : 'confirmed',
      evidence: relationship.evidence ?? null,
      source: 'screenshot-staging',
    };
    if (Array.isArray(relationship.relationCandidates)) normalized.relationCandidates = relationship.relationCandidates;
    return normalized;
  });
}

function inferRelationshipsFromStory(story, selfName, nameResolver) {
  if (!story) return [];
  const relationships = new Map();
  const names = [...nameResolver.keys()]
    .filter((name) => name && name !== selfName && name.length >= 2)
    .sort((a, b) => b.length - a.length);
  for (const rawName of names) {
    let fromIndex = 0;
    while (fromIndex < story.length) {
      const index = story.indexOf(rawName, fromIndex);
      if (index < 0) break;
      const start = Math.max(0, index - 70);
      const end = Math.min(story.length, index + rawName.length + 70);
      const evidence = story.slice(start, end).replace(/\s+/g, ' ').trim();
      const terms = RELATION_TERMS.filter(([term]) => evidence.includes(term)).map(([, label]) => label);
      if (terms.length) {
        const relatedCatName = resolveRelatedName(rawName, nameResolver);
        if (relatedCatName !== selfName) {
          const existing = relationships.get(relatedCatName) ?? {
            relatedCatName,
            relation: null,
            relationCandidates: [],
            confidence: 'inferred',
            evidence: [],
            source: 'api-story-inference',
          };
          existing.relationCandidates = [...new Set([...existing.relationCandidates, ...terms])];
          existing.evidence = [...new Set([...existing.evidence, evidence])];
          relationships.set(relatedCatName, existing);
        }
      }
      fromIndex = index + rawName.length;
    }
  }
  return [...relationships.values()];
}

function mergeRelationships(explicitRelationships, inferredRelationships) {
  const merged = new Map();
  for (const relationship of [...explicitRelationships, ...inferredRelationships]) {
    const key = relationship.relatedCatName ?? relationship.rawName ?? 'unknown';
    const current = merged.get(key);
    if (!current) {
      merged.set(key, {
        ...relationship,
        relationCandidates: relationship.relationCandidates ? [...relationship.relationCandidates] : undefined,
        evidence: Array.isArray(relationship.evidence) ? [...relationship.evidence] : relationship.evidence,
      });
      continue;
    }
    const candidates = [...new Set([
      ...(current.relationCandidates ?? []),
      ...(relationship.relationCandidates ?? []),
      ...(current.relation ? [current.relation] : []),
      ...(relationship.relation ? [relationship.relation] : []),
    ])];
    if (!current.relation && relationship.relation) current.relation = relationship.relation;
    if (candidates.length) current.relationCandidates = candidates;
    const currentEvidence = Array.isArray(current.evidence) ? current.evidence : current.evidence ? [current.evidence] : [];
    const nextEvidence = Array.isArray(relationship.evidence) ? relationship.evidence : relationship.evidence ? [relationship.evidence] : [];
    if (currentEvidence.length || nextEvidence.length) current.evidence = [...new Set([...currentEvidence, ...nextEvidence])];
    if (current.confidence !== 'confirmed' && relationship.confidence === 'confirmed') current.confidence = 'confirmed';
    if (current.source !== relationship.source) current.source = 'multiple-sources';
  }
  return [...merged.values()].map((relationship) => {
    if (relationship.relationCandidates?.length === 1 && !relationship.relation) {
      relationship.relation = relationship.relationCandidates[0];
    }
    return relationship;
  });
}

function buildUpdates(pet) {
  return getContentItems(pet).map((item) => ({
    sourceId: item.contentId == null ? null : String(item.contentId),
    date: item.recordTime ?? item.time ?? item.createTime ?? null,
    type: item.contentType ?? item.type ?? null,
    title: item.title ?? null,
    content: item.content ?? item.typeContent ?? null,
    images: [...collectImageUrls(item)],
  }));
}

function buildStagingIndex(staging) {
  const index = new Map();
  for (const record of staging?.records ?? []) {
    if (record.sourceName) index.set(record.sourceName, record);
    if (record.canonicalName) index.set(record.canonicalName, record);
  }
  return index;
}

function normalizeCurrentProfiles(profiles) {
  const existingNames = new Set(profiles.map((profile) => profile.name));
  return profiles.map((profile) => {
    const renamedName = CURRENT_NAME_RENAMES[profile.name];
    const name = renamedName && !existingNames.has(renamedName) ? renamedName : profile.name;
    return {
      ...profile,
      name,
      status: CURRENT_STATUS_OVERRIDES[name] ?? profile.status,
    };
  });
}

function applyRelationshipOverrides(sourceName, relationships) {
  return relationships.flatMap((relationship) => {
    const override = RELATIONSHIP_OVERRIDES.find((item) => (
      item.sourceName === sourceName && item.relatedCatName === relationship.relatedCatName
    ));
    if (!override) return [relationship];
    if (override.remove) return [];
    return [{
      ...relationship,
      relation: override.relation,
      relationCandidates: [],
      confidence: 'confirmed',
      source: 'manual-confirmation',
    }];
  });
}

function buildRetainedWebsiteOnly(profiles, candidates) {
  const matchedCurrentNames = new Set(candidates.map((candidate) => candidate.canonicalName).filter(Boolean));
  return profiles
    .filter((profile) => !matchedCurrentNames.has(profile.name))
    .map((profile) => {
      const { friendliness: _friendliness, ...profileWithoutFriendliness } = profile;
      return {
      ...profileWithoutFriendliness,
      personality: [],
      description: null,
      relationships: [],
      relationshipHints: [],
      updates: [],
      aliases: [],
      sourceId: null,
      sourceImages: [],
      };
    });
}

function buildAlignmentChecks(candidates, catProfiles, currentByName) {
  const byCandidateName = new Map(candidates.map((candidate) => [candidate.cat.name, candidate]));
  const duplicateIds = [...candidates.reduce((counts, candidate) => {
    counts.set(candidate.sourceId, (counts.get(candidate.sourceId) ?? 0) + 1);
    return counts;
  }, new Map())].filter(([, count]) => count > 1).map(([sourceId, count]) => ({ sourceId, count }));
  const nameChecks = {
    exactMatches: candidates.filter((candidate) => candidate.matchStatus === 'exact').map((candidate) => ({ sourceId: candidate.sourceId, apiName: candidate.sourceName, currentName: candidate.canonicalName })),
    aliasMatches: candidates.filter((candidate) => candidate.matchStatus === 'alias').map((candidate) => ({ sourceId: candidate.sourceId, apiName: candidate.sourceName, currentName: candidate.canonicalName, aliases: candidate.cat.aliases })),
    newNames: candidates.filter((candidate) => candidate.matchStatus === 'new').map((candidate) => ({ sourceId: candidate.sourceId, apiName: candidate.sourceName, canonicalName: candidate.canonicalName, aliases: candidate.cat.aliases, compositeName: candidate.sourceName.includes('/'), manuallyResolved: Boolean(API_CANONICAL_NAMES[candidate.sourceName]) })),
    duplicateSourceIds: duplicateIds,
    legacyCurrentNamesNotInApi: catProfiles.map((cat) => cat.name).filter((name) => !candidates.some((candidate) => candidate.canonicalName === name)),
  };

  const statusConflicts = candidates.filter((candidate) => {
    const mappedStatus = candidate.cat.status;
    const hasManualStatusOverride = Object.hasOwn(API_STATUS_OVERRIDES, candidate.sourceName);
    return candidate.comparison.currentStatus && mappedStatus && candidate.comparison.currentStatus !== mappedStatus && !hasManualStatusOverride;
  }).map((candidate) => ({
    sourceId: candidate.sourceId,
    apiName: candidate.sourceName,
    currentName: candidate.comparison.currentName,
    currentStatus: candidate.comparison.currentStatus,
    apiAdoptionStatus: candidate.sourceMeta.adoptionStatus,
    mappedStatus: STATUS_MAP[candidate.sourceMeta.adoptionStatus],
  }));
  const statusChecks = {
    codeMapping: STATUS_MAP,
    overrides: API_STATUS_OVERRIDES,
    conflicts: statusConflicts,
  };

  const relationshipRows = candidates.flatMap((candidate) => candidate.cat.relationships.map((relationship) => ({
    sourceId: candidate.sourceId,
    sourceName: candidate.sourceName,
    relatedCatName: relationship.relatedCatName,
    relation: relationship.relation,
    relationCandidates: relationship.relationCandidates ?? [],
    confidence: relationship.confidence,
    source: relationship.source,
  })));
  const relationshipHintRows = candidates.flatMap((candidate) => candidate.cat.relationshipHints.map((relationship) => ({
    sourceId: candidate.sourceId,
    sourceName: candidate.sourceName,
    relatedCatName: relationship.relatedCatName,
    relationCandidates: relationship.relationCandidates ?? [],
    confidence: relationship.confidence,
    source: relationship.source,
  })));
  const relationshipPairs = new Map();
  for (const row of relationshipRows) {
    const relatedCandidate = byCandidateName.get(row.relatedCatName);
    const left = relatedCandidate?.sourceId ?? `name:${row.relatedCatName}`;
    const pairKey = [row.sourceId, left].sort().join('::');
    const existing = relationshipPairs.get(pairKey) ?? { pairKey, records: [], labels: new Set() };
    existing.records.push(row);
    for (const label of [row.relation, ...row.relationCandidates]) if (label) existing.labels.add(label);
    relationshipPairs.set(pairKey, existing);
  }
  const multiLabelPairs = [...relationshipPairs.values()]
    .filter((pair) => pair.labels.size > 1)
    .map((pair) => ({ pairKey: pair.pairKey, labels: [...pair.labels], records: pair.records }));
  const unresolvedRelatedNames = [...new Set(relationshipRows
    .map((row) => row.relatedCatName)
    .filter((name) => name && !byCandidateName.has(name)))];
  const relationshipChecks = {
    totalRelationships: relationshipRows.length,
    confirmedCount: relationshipRows.filter((row) => row.confidence === 'confirmed').length,
    suspectedCount: relationshipRows.filter((row) => row.confidence === 'suspected').length,
    inferredCount: relationshipRows.filter((row) => row.confidence === 'inferred').length,
    ambiguousCount: relationshipRows.filter((row) => row.relationCandidates.length > 1).length,
    unresolvedRelatedNames,
    multiLabelPairs,
    rows: relationshipRows,
    hintCount: relationshipHintRows.length,
    hintAmbiguousCount: relationshipHintRows.filter((row) => row.relationCandidates.length > 1).length,
    hints: relationshipHintRows,
  };

  return {
    nameChecks,
    statusChecks,
    relationshipChecks,
    summary: {
      nameConflictCount: nameChecks.newNames.filter((item) => item.compositeName && !item.manuallyResolved).length + nameChecks.legacyCurrentNamesNotInApi.length,
      confirmedAliasCount: nameChecks.aliasMatches.length,
      statusConflictCount: statusConflicts.length,
      relationshipReviewCount: relationshipRows.filter((row) => row.confidence !== 'confirmed' || row.relationCandidates.length > 1).length,
      relationshipMultiLabelPairCount: multiLabelPairs.length,
      unresolvedRelatedNameCount: unresolvedRelatedNames.length,
      relationshipHintCount: relationshipHintRows.length,
      relationshipHintAmbiguousCount: relationshipHintRows.filter((row) => row.relationCandidates.length > 1).length,
      duplicateSourceIdCount: duplicateIds.length,
    },
  };
}

function findMatch(apiName, currentByName) {
  if (currentByName.has(apiName)) {
    return { type: 'exact', currentName: apiName, aliasParts: [] };
  }
  if (Object.hasOwn(API_CURRENT_NAME_ALIASES, apiName) && currentByName.has(API_CURRENT_NAME_ALIASES[apiName])) {
    return { type: 'alias', currentName: API_CURRENT_NAME_ALIASES[apiName], aliasParts: [apiName] };
  }
  const aliasParts = apiName.split('/').map((part) => part.trim()).filter(Boolean);
  const matchingParts = aliasParts.filter((part) => currentByName.has(part));
  if (matchingParts.length === 1) {
    return { type: 'alias', currentName: matchingParts[0], aliasParts };
  }
  return { type: 'new', currentName: null, aliasParts };
}

function mapStatus(rawStatus, existing, apiName) {
  if (Object.hasOwn(API_STATUS_OVERRIDES, apiName)) return API_STATUS_OVERRIDES[apiName];
  if (STATUS_MAP[rawStatus]) return STATUS_MAP[rawStatus];
  if (rawStatus === 'wait') return existing?.status ?? null;
  return existing?.status ?? null;
}

function buildCatCandidate(pet, currentByName, nameResolver, stagingByName, imageManifest) {
  const detail = getDetail(pet);
  const info = getInfo(pet);
  const apiName = detail.name ?? pet.nameFromList ?? `未命名-${pet.id}`;
  const match = findMatch(apiName, currentByName);
  const existing = match.currentName ? currentByName.get(match.currentName) : null;
  const canonicalName = match.currentName ?? API_CANONICAL_NAMES[apiName] ?? apiName;
  const rawAdoptionStatus = detail.adoptionStatus ?? null;
  const rawGender = detail.gender ?? null;
  const rawNature = Array.isArray(info.nature) ? info.nature : [];
  const inferredArea = inferArea(info.story ?? '');
  const imageCandidates = getImageCandidates(pet);
  const contentItems = getContentItems(pet);
  const dynamicImageUrls = collectImageUrls(contentItems);
  const stagingRecord = stagingByName.get(apiName) ?? (match.currentName ? stagingByName.get(match.currentName) : null);
  const stagingRelationships = normalizeStagingRelationships(stagingRecord, nameResolver);
  const inferredRelationships = inferRelationshipsFromStory(info.story ?? '', match.currentName ?? apiName, nameResolver);
  const relationships = applyRelationshipOverrides(apiName, mergeRelationships(stagingRelationships, []));
  const updates = buildUpdates(pet);
  const aliases = apiName.split('/').map((value) => value.trim()).filter((value) => value && value !== canonicalName);
  const downloadedImages = imageManifest?.[String(pet.id)] ?? [];
  const localImages = existing?.images?.length ? [...existing.images] : [...downloadedImages];
  const reviewFlags = [];

  if (match.type === 'new') {
    reviewFlags.push('API 名称未与当前 cats.js 直接匹配，需确认是否为新增猫咪或旧档案改名。');
  }
  if (match.type === 'new' && apiName.includes('/') && !API_CANONICAL_NAMES[apiName]) {
    reviewFlags.push(`API 名称“${apiName}”包含斜杠复合名称，需确认正式名称，不能直接作为网站规范名。`);
  }
  const hasManualGenderOverride = Object.hasOwn(API_GENDER_OVERRIDES, apiName);
  if (rawGender === 'unknown' && !hasManualGenderOverride) reviewFlags.push('API 性别为 unknown，候选性别留空。');
  const mappedStatus = mapStatus(rawAdoptionStatus, existing, apiName);
  const hasManualStatusOverride = Object.hasOwn(API_STATUS_OVERRIDES, apiName);
  if (existing && mappedStatus && existing.status !== mappedStatus && !hasManualStatusOverride) {
    reviewFlags.push(`状态冲突：API ${rawAdoptionStatus} 映射为“${mappedStatus}”，当前网站为“${existing.status}”。`);
  }
  const mappedGender = mapGender(rawGender, apiName);
  if (existing && mappedGender && existing.gender !== mappedGender) {
    reviewFlags.push(`性别冲突：API 映射为“${mappedGender}”，当前网站为“${existing.gender}”。`);
  }
  if (!existing) {
    reviewFlags.push('新增记录的疫苗、备注和部分网站字段待补充；故事可明确推断的区域已预填。');
    if (imageCandidates.length && !downloadedImages.length) reviewFlags.push('API 图片已保存在 sourceImages，等待下载为本地 images。');
  }
  if (!imageCandidates.length) reviewFlags.push('详情接口未提供可识别的主图 URL。');

  const cat = {
    name: canonicalName,
    status: mappedStatus,
    vaccine: existing?.vaccine ?? '待补充',
    sterilized: mapSterilized(detail, info, apiName),
    notes: existing?.notes ?? '待补充',
    area: existing?.area ?? inferredArea ?? '待补充',
    gender: mappedGender,
    images: localImages,
    personality: [...rawNature],
    description: info.story ?? null,
    relationships,
    relationshipHints: inferredRelationships,
    updates,
    aliases,
    sourceId: pet.id,
    sourceImages: imageCandidates,
  };
  for (const optionalField of ['photoUpdatedAt', 'cover']) {
    if (existing && Object.hasOwn(existing, optionalField)) cat[optionalField] = existing[optionalField];
  }

  const fieldDecisions = {
    name: { value: cat.name, source: existing ? `cats.js:${existing.name}` : API_CANONICAL_NAMES[apiName] ? `manual-canonical-name:${apiName}` : 'api.response.name', mode: API_CANONICAL_NAMES[apiName] ? 'manual-confirmation' : match.type },
    status: { value: cat.status, source: hasManualStatusOverride ? `manual-override:${apiName}` : rawAdoptionStatus === 'wait' ? 'cats.js/current website status' : rawAdoptionStatus ? `api.response.adoptionStatus=${rawAdoptionStatus}` : 'unavailable', mode: hasManualStatusOverride ? 'manual-confirmation' : 'mapped-or-preserved' },
    vaccine: { value: cat.vaccine, source: existing ? `cats.js:${existing.name}` : 'manual-default', mode: existing ? 'preserved' : 'manual-default' },
    sterilized: { value: cat.sterilized, source: Object.hasOwn(API_STERILIZATION_OVERRIDES, apiName) ? `manual-override:${apiName}` : 'api.response.jueyuStatus + api.response.info.jueyuTime', mode: Object.hasOwn(API_STERILIZATION_OVERRIDES, apiName) ? 'manual-confirmation' : 'mapped' },
    notes: { value: cat.notes, source: existing ? `cats.js:${existing.name}` : 'manual-default', mode: existing ? 'preserved' : 'manual-default' },
    area: { value: cat.area, source: existing ? `cats.js:${existing.name}` : inferredArea ? 'api.response.info.story' : 'not-provided-by-api', mode: existing ? 'preserved' : inferredArea ? 'inferred' : 'unresolved' },
    gender: { value: cat.gender, source: hasManualGenderOverride ? `manual-override:${apiName}` : 'api.response.gender', mode: hasManualGenderOverride ? 'manual-confirmation' : rawGender === 'unknown' ? 'manual-review' : 'mapped' },
    images: { value: cat.images, source: existing ? `cats.js:${existing.name}` : downloadedImages.length ? 'local-image-manifest' : 'external URLs kept in sourceImages', mode: existing ? 'preserved' : downloadedImages.length ? 'downloaded' : 'pending-download' },
    personality: { value: cat.personality, source: 'api.response.info.nature', mode: 'mapped' },
    description: { value: cat.description, source: 'api.response.info.story', mode: 'mapped' },
    relationships: { value: cat.relationships, source: stagingRecord ? 'screenshot-staging' : 'api has no structured relationship field', mode: stagingRecord ? 'mapped' : 'empty-not-provided' },
    relationshipHints: { value: cat.relationshipHints, source: 'api.response.info.story', mode: cat.relationshipHints.length ? 'story-only' : 'empty' },
    updates: { value: cat.updates, source: 'api.response[] content', mode: 'mapped' },
    aliases: { value: cat.aliases, source: 'api.response.name', mode: cat.aliases.length ? 'manual-review' : 'empty' },
    sourceId: { value: cat.sourceId, source: 'api.response.petId', mode: 'mapped' },
    sourceImages: { value: cat.sourceImages, source: 'api.response.avatar + api.response.info.photos', mode: 'mapped' },
  };

  return {
    sourceId: pet.id,
    sourceName: apiName,
    canonicalName,
    matchStatus: match.type,
    currentRecordExists: Boolean(existing),
    comparison: {
      currentName: existing?.name ?? null,
      currentStatus: existing?.status ?? null,
      candidateStatus: cat.status,
      currentGender: existing?.gender ?? null,
      candidateGender: cat.gender,
    },
    cat,
    fieldDecisions,
    sourceMeta: {
      adoptionStatus: rawAdoptionStatus,
      gender: rawGender,
      sterilizationStatus: detail.jueyuStatus ?? null,
      sterilizationDate: info.jueyuTime || null,
      nature: rawNature,
      arriveday: detail.arriveday ?? null,
      birthday: detail.birthday ?? null,
      story: info.story ?? null,
      imageCandidates,
      dynamicCount: contentItems.length,
      dynamicImageUrlCount: dynamicImageUrls.size,
    },
    reviewFlags,
  };
}

async function main() {
  const raw = JSON.parse(await fs.readFile(INPUT, 'utf8'));
  const staging = JSON.parse(await fs.readFile(STAGING_INPUT, 'utf8'));
  let imageManifest = {};
  try {
    imageManifest = JSON.parse(await fs.readFile(IMAGE_MANIFEST_INPUT, 'utf8'));
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  const normalizedCurrentProfiles = normalizeCurrentProfiles(catProfiles);
  const currentByName = new Map(normalizedCurrentProfiles.map((cat) => [cat.name, cat]));
  const pets = raw.pets ?? [];
  const nameResolver = buildNameResolver(pets, currentByName);
  const stagingByName = buildStagingIndex(staging);
  const candidates = pets.map((pet) => buildCatCandidate(pet, currentByName, nameResolver, stagingByName, imageManifest));
  const legacyCurrentNamesNotInApi = normalizedCurrentProfiles.map((cat) => cat.name).filter((name) => !candidates.some((candidate) => candidate.canonicalName === name));
  const retainedWebsiteOnly = buildRetainedWebsiteOnly(normalizedCurrentProfiles, candidates);
  const countBy = (values) => Object.fromEntries([...values.reduce((counts, value) => counts.set(value ?? '<empty>', (counts.get(value ?? '<empty>') ?? 0) + 1), new Map())].sort());
  const checks = buildAlignmentChecks(candidates, normalizedCurrentProfiles, currentByName);

  const report = {
    schema: 'meowzart-cats-candidate',
    version: 1,
    generatedAt: new Date().toISOString(),
    input: 'data/meowzart-api-export.json',
    imageManifest: 'data/meowzart-local-image-manifest.json',
    target: {
      source: '小小喵扎特 API',
      societyId: raw.source?.societyId ?? 649,
      targetCount: candidates.length,
      retainedWebsiteOnlyCount: retainedWebsiteOnly.length,
      targetRule: '以 API 列表返回的 99 条记录为候选目标名单；不自动删除当前 cats.js 旧档案。',
    },
    currentWebsite: {
      count: catProfiles.length,
      fields: CURRENT_FIELDS,
      optionalFieldsObserved: ['photoUpdatedAt', 'cover'],
    },
    manualDecisions: {
      currentNameRenames: CURRENT_NAME_RENAMES,
      currentStatusOverrides: CURRENT_STATUS_OVERRIDES,
      apiCurrentNameAliases: API_CURRENT_NAME_ALIASES,
      apiStatusOverrides: API_STATUS_OVERRIDES,
      apiCanonicalNames: API_CANONICAL_NAMES,
      apiSterilizationOverrides: API_STERILIZATION_OVERRIDES,
      apiGenderOverrides: API_GENDER_OVERRIDES,
      aliasPolicy: '现有网站名为正式名；API 斜杠名称的其他部分作为 aliases。',
      relationshipOverrides: RELATIONSHIP_OVERRIDES,
      retainedWebsiteOnlyNames: retainedWebsiteOnly.map((profile) => profile.name),
    },
    expandedCandidateFields: EXPANDED_FIELDS,
    summary: {
      apiCount: candidates.length,
      exactMatchCount: candidates.filter((candidate) => candidate.matchStatus === 'exact').length,
      aliasMatchCount: candidates.filter((candidate) => candidate.matchStatus === 'alias').length,
      newCandidateCount: candidates.filter((candidate) => candidate.matchStatus === 'new').length,
      legacyCurrentNamesNotInApiCount: legacyCurrentNamesNotInApi.length,
      statusConflictCount: candidates.filter((candidate) => candidate.reviewFlags.some((flag) => flag.startsWith('状态冲突：'))).length,
      genderConflictCount: candidates.filter((candidate) => candidate.reviewFlags.some((flag) => flag.startsWith('性别冲突：'))).length,
      relationshipCount: checks.relationshipChecks.totalRelationships,
      relationshipReviewCount: checks.summary.relationshipReviewCount,
      relationshipMultiLabelPairCount: checks.summary.relationshipMultiLabelPairCount,
      apiAdoptionStatusCounts: countBy(candidates.map((candidate) => candidate.sourceMeta.adoptionStatus)),
      apiGenderCounts: countBy(candidates.map((candidate) => candidate.sourceMeta.gender)),
      apiSterilizationCounts: countBy(candidates.map((candidate) => candidate.sourceMeta.sterilizationStatus)),
      candidatesNeedingReviewCount: candidates.filter((candidate) => candidate.reviewFlags.length > 0).length,
    },
    legacyCurrentNamesNotInApi,
    retainedWebsiteOnly,
    policy: {
      status: 'school→就读中；finish→已毕业；die/disappear→喵星或失踪；已确认的二柑、焦炭馒头使用人工状态覆盖；wait 不作为正式网站状态，匹配记录沿用现有网站状态。',
      name: '现有网站名保持为正式名；API 斜杠名称的其他部分作为 aliases。',
      rename: '现有网站“胆小橘”改为“邪恶橘白”；API 的“胆小橘”作为另一只猫处理。',
      merge: 'API“丁香奶牛”与现有网站“邪恶奶牛”合并，保留“邪恶奶牛”为正式名，“丁香奶牛”为别名。',
      retainedWebsiteOnly: '保留当前网站中未匹配 API 99 条名单的记录，不自动删除。',
      gender: 'male→公；female→母；unknown 留空。',
      sterilized: '由 jueyuStatus 和 jueyuTime 映射。',
      unavailableFields: '新记录的 vaccine 和 notes 统一为待补充；area 优先从 story 推断，无法判断时为待补充。',
      images: '已有本地 images 原样保留；没有本地图片的记录由 image manifest 写入最多两张 API 图片的本地路径，原始 URL 仍保留在 sourceImages。',
      richFields: 'personality、description、updates 直接来自 API；relationships 只收录截图暂存中的明确关系；故事文本线索仅放在 relationshipHints，不作为正式关系。',
    },
  };

  const output = {
    ...report,
    checks,
    retainedWebsiteOnly,
    candidates,
  };
  await fs.writeFile(OUTPUT, `${JSON.stringify(output, null, 2)}\n`, 'utf8');
  await fs.writeFile(CHECK_OUTPUT, `${JSON.stringify({ ...report, checks }, null, 2)}\n`, 'utf8');
  console.log(`候选档案已生成：${OUTPUT}`);
  console.log(JSON.stringify(report.summary, null, 2));
  console.log(`对齐检查已生成：${CHECK_OUTPUT}`);
  console.log(JSON.stringify(checks.summary, null, 2));
  console.log(`当前 cats.js 中未出现在 API 名单的旧名称：${legacyCurrentNamesNotInApi.join('、')}`);
}

main().catch((error) => {
  console.error(`生成候选档案失败：${error.message}`);
  process.exitCode = 1;
});
