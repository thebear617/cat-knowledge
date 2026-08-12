const SERIES_RULES = [
  { brand: '诚实一口', pattern: /P40/i, series: 'P40 系列' },
  { brand: '网易严选', pattern: /全价鲜肉/, series: '全价鲜肉系列' },
  { brand: '江小傲', pattern: /鸡牛配方/, series: '鸡牛配方系列' },
  { brand: '蓝氏', pattern: /猎鸟乳鸽/, series: '猎鸟乳鸽系列' },
  { brand: '卫仕', pattern: /山海盛宴/, series: '山海盛宴系列' },
  { brand: '麦富迪', pattern: /原生鲜肉/, series: '原生鲜肉系列' },
  { brand: '麦富迪', pattern: /鲜肉双拼/, series: '鲜肉双拼系列' },
  { brand: '麦富迪', pattern: /冻干双拼/, series: '冻干双拼系列' },
  { brand: '网易严选', pattern: /豆腐猫砂/, series: '豆腐猫砂系列' },
  { brand: '高爷家', pattern: /全价主食罐/, series: '全价主食罐系列' },
];

const PRODUCT_RULES = [
  { pattern: /鸡肉金枪鱼配方/, product: '鸡肉金枪鱼配方' },
  { pattern: /鲜鸡肉牛肉/, product: '鲜鸡肉牛肉配方' },
  { pattern: /温和低敏|低敏呵护/, product: '鸡肉味 · 低敏款' },
  { pattern: /鸡牛配方/, product: '鸡牛配方' },
  { pattern: /鸽肉味/, product: '鸽肉味' },
  { pattern: /鹅肝/, product: '鹅肝配方' },
  { pattern: /鸡肉味/, product: '鸡肉味' },
  { pattern: /豆腐猫砂/, product: '豆腐猫砂' },
  { pattern: /全价主食罐/, product: '主食罐头' },
];

function normalizeSourceTitle(value) {
  return String(value || '').replace(/[【】\[\]]/g, '').replace(/\s+/g, ' ').trim();
}

function normalizeProcurementItem(item) {
  const sourceTitle = normalizeSourceTitle(item.sourceTitle || item.product);
  const seriesRule = SERIES_RULES.find(rule =>
    (!rule.brand || rule.brand === item.brand) && rule.pattern.test(sourceTitle)
  );
  const productRule = PRODUCT_RULES.find(rule => rule.pattern.test(sourceTitle));
  const fallbackProduct = ['猫砂', '猫砂 / 清洁护理'].includes(item.category)
    ? '猫砂'
    : ['罐头', '罐头 / 湿粮'].includes(item.category)
      ? '主食罐头'
      : '全价猫粮';

  return {
    ...item,
    sourceTitle,
    series: seriesRule?.series || item.series || '待归类系列',
    product: productRule?.product || item.product || fallbackProduct,
  };
}

const rawItems = [
  { category: '主粮', subcategory: '全期粮', brand: '诚实一口', sourceTitle: 'P40 全价猫粮', spec: '1.5kg', price: 66.34, note: '', url: 'https://item.jd.com/100249267171.html' },
  { category: '主粮', subcategory: '全期粮', brand: '网易严选', sourceTitle: '全价鲜肉猫粮', spec: '1.8kg', price: 54.4, note: '', url: 'https://item.jd.com/100002977536.html' },
  { category: '主粮', subcategory: '成猫粮', brand: '江小傲', sourceTitle: '鸡牛配方全价猫粮', spec: '2kg', price: 57.1, note: '', url: 'https://item.jd.com/10047707486581.html' },
  { category: '主粮', subcategory: '全期粮', brand: '蓝氏', sourceTitle: '猎鸟乳鸽全价猫粮', spec: '250g', price: 9.9, note: '', url: 'https://search.jd.com/Search?keyword=%E8%93%9D%E6%B0%8F%20%E7%8C%8E%E9%B8%9F%E4%B9%B3%E9%B8%BD%20250g' },
  { category: '主粮', subcategory: '成猫粮', brand: '卫仕', sourceTitle: '山海盛宴鹅肝全价猫粮', spec: '1.5kg', price: 65.55, note: '', url: 'https://item.jd.com/100021518453.html' },
  { category: '主粮', subcategory: '全期粮', brand: '麦富迪', sourceTitle: '原生鲜肉猫粮 真鲜肉干爽不油高蛋白全价成幼猫粮 鸡肉味', spec: '1.5kg', price: 49.0, note: '', url: 'https://item.jd.com/100266064092.html' },
  { category: '主粮', subcategory: '全期粮', brand: '麦富迪', sourceTitle: '原生鲜肉粮高蛋白全价成幼猫粮 鸽肉味', spec: '7.2kg', price: 189.0, note: '', url: 'https://item.jd.com/100279060106.html' },
  { category: '主粮', subcategory: '全期粮', brand: '麦富迪', sourceTitle: '原生鲜肉粮高蛋白成幼猫粮 温和低敏呵护肠胃 鸡肉味', spec: '7.2kg', price: 189.0, note: '', url: 'https://item.jd.com/100279060110.html' },
  { category: '主粮', subcategory: '幼猫粮', brand: '麦富迪', sourceTitle: '鲜肉双拼全价天然粮 鸡肉金枪鱼配方', spec: '1.5kg', price: 49.9, note: '', url: 'https://item.jd.com/70073673207.html' },
  { category: '主粮', subcategory: '全期粮', brand: '麦富迪', sourceTitle: '全价冻干双拼鲜粮 成幼猫通用 鲜鸡肉牛肉', spec: '1.8kg', price: 69.9, note: '', url: 'https://item.jd.com/10086619686486.html' },
  { category: '猫砂 / 清洁护理', subcategory: '猫砂', brand: '网易严选', sourceTitle: '豆腐猫砂', spec: '2.5kg', price: 19.9, note: '', url: 'https://search.jd.com/Search?keyword=%E7%BD%91%E6%98%93%E4%B8%A5%E9%80%89%20%E8%B1%86%E8%85%90%E7%8C%AB%E7%A0%82%202.5kg' },
  { category: '罐头 / 湿粮', subcategory: '主食罐', brand: '高爷家', sourceTitle: '全价主食罐头', spec: '85g', price: 8.5, note: '', url: 'https://search.jd.com/Search?keyword=%E9%AB%98%E7%88%B7%E5%AE%B6%20%E5%85%A8%E4%BB%B7%E4%B8%BB%E9%A3%9F%E7%BD%90%E5%A4%B4%2085g' },

  // 健康护理：先以京东常见规格建立可比较的价格参考快照。
  { category: '驱虫 / 药品', subcategory: '外驱', brand: '博来恩', series: '体内外驱虫系列', product: '猫用体内外驱虫', sourceTitle: '博来恩猫用体内外驱虫滴剂 2.5kg以下 3支/盒', spec: '2.5kg以下 · 3支', price: 129.0, priceUnit: '盒', note: '', url: 'https://item.jd.com/10075162708936.html' },
  { category: '驱虫 / 药品', subcategory: '外驱', brand: '大宠爱', series: '体内外驱虫系列', product: '猫用体内外驱虫', sourceTitle: '大宠爱猫用体内外驱虫滴剂 2.5kg以下 单支装', spec: '2.5kg以下 · 1支', price: 49.9, priceUnit: '支', note: '', url: 'https://item.jd.com/10036137812967.html' },
  { category: '驱虫 / 药品', subcategory: '内驱', brand: '可立奥', series: '内驱片系列', product: '猫用内驱片', sourceTitle: '可立奥猫用驱虫药 0.5-2kg 3粒/盒', spec: '0.5–2kg · 3粒', price: 39.9, priceUnit: '盒', note: '', url: 'https://item.jd.com/10166846248313.html' },
  { category: '驱虫 / 药品', subcategory: '内驱', brand: '可立奥', series: '内驱片系列', product: '猫用内驱片', sourceTitle: '可立奥猫用驱虫药 2-8kg 3粒/盒', spec: '2–8kg · 3粒', price: 69.9, priceUnit: '盒', note: '', url: 'https://item.jd.com/100312847432.html' },
  { category: '驱虫 / 药品', subcategory: '内驱', brand: '维克', series: '米普罗系列', product: '猫用内驱片', sourceTitle: '维克米普罗猫用驱虫药 幼猫用 2片/盒', spec: '幼猫 · 2片', price: 39.9, priceUnit: '盒', note: '', url: 'https://item.jd.com/10056146945055.html' },
  { category: '驱虫 / 药品', subcategory: '外驱', brand: '爱沃克', series: '猫用滴剂系列', product: '猫用体内外驱虫', sourceTitle: '爱沃克猫用体内外驱虫滴剂 3支/盒', spec: '猫用 · 3支', price: 159.0, priceUnit: '盒', note: '', url: 'https://item.jd.com/10061540070733.html' },
  { category: '驱虫 / 药品', subcategory: '外驱', brand: '福来恩', series: '猫用滴剂系列', product: '猫用体外驱虫', sourceTitle: '福来恩猫用体外驱虫滴剂 3支/盒', spec: '猫用 · 3支', price: 119.0, priceUnit: '盒', note: '', url: 'https://item.jd.com/70625327837.html' },
  { category: '驱虫 / 药品', subcategory: '内驱', brand: '海乐妙', series: '猫用内驱系列', product: '猫用内驱片', sourceTitle: '海乐妙猫用体内驱虫药 2片/盒', spec: '猫用 · 2片', price: 59.9, priceUnit: '盒', note: '', url: 'https://item.jd.com/10226486341406.html' },
  { category: '驱虫 / 药品', subcategory: '内驱', brand: '拜宠清', series: '猫用内驱系列', product: '猫用内驱片', sourceTitle: '拜宠清猫用体内驱虫药 2片/盒', spec: '猫用 · 2片', price: 39.9, priceUnit: '盒', note: '', url: 'https://item.jd.com/66317512049.html' },
  { category: '驱虫 / 药品', subcategory: '外驱', brand: '普安特', series: '猫用滴剂系列', product: '猫用体外驱虫', sourceTitle: '普安特猫用体外驱虫滴剂 3支/盒', spec: '猫用 · 3支', price: 29.9, priceUnit: '盒', note: '', url: 'https://item.jd.com/10060651041193.html' },

  { category: '猫砂 / 清洁护理', subcategory: '清洁护理', brand: '杜邦', series: '卫可清洁系列', product: '环境消毒剂', sourceTitle: '杜邦卫可宠物环境消毒剂 泡腾片 120片/桶', spec: '120片', price: 59.9, priceUnit: '桶', note: '', url: 'https://item.jd.com/10075326456235.html' },
  { category: '猫砂 / 清洁护理', subcategory: '清洁护理', brand: '维倍思', series: '环境清洁系列', product: '环境消毒喷剂', sourceTitle: '维倍思绿十字宠物环境喷剂 500ml×2', spec: '500ml×2', price: 89.0, priceUnit: '组', note: '', url: 'https://item.jd.com/10029667345593.html' },
  { category: '猫砂 / 清洁护理', subcategory: '清洁护理', brand: 'votesil', series: '环境清洁系列', product: '环境消毒剂', sourceTitle: 'votesil宠物环境消毒剂 500ml×3', spec: '500ml×3', price: 89.0, priceUnit: '组', note: '', url: 'https://item.jd.com/100022335543.html' },
  { category: '猫砂 / 清洁护理', subcategory: '清洁护理', brand: '狮王', series: '艾宠清洁系列', product: '宠物除臭剂', sourceTitle: '狮王艾宠宠物除臭剂 薄荷香 400ml', spec: '400ml', price: 49.9, priceUnit: '瓶', note: '', url: 'https://item.jd.com/10080380126314.html' },
  { category: '猫砂 / 清洁护理', subcategory: '清洁护理', brand: '霏凛九州', series: '环境清洁系列', product: '宠物除菌液', sourceTitle: '霏凛九州宠物除菌液 280ml', spec: '280ml', price: 29.9, priceUnit: '瓶', note: '', url: 'https://item.jd.com/10164081058654.html' },
  { category: '猫砂 / 清洁护理', subcategory: '清洁护理', brand: 'NIKORO', series: '日常清洁系列', product: '免洗清洁手套', sourceTitle: 'NIKORO宠物免洗清洁手套 4片装', spec: '4片', price: 19.9, priceUnit: '包', note: '', url: 'https://item.jd.com/10064627329791.html' },
  { category: '猫砂 / 清洁护理', subcategory: '清洁护理', brand: '清度', series: '烘干护理系列', product: '宠物烘干箱', sourceTitle: '清度宠物烘干箱 IH-A1500', spec: '1500W', price: 1299.0, priceUnit: '台', note: '', url: 'https://item.jd.com/10055873688152.html' },
  { category: '猫砂 / 清洁护理', subcategory: '清洁护理', brand: '宠物医生', series: '耳部护理系列', product: '猫咪洗耳液', sourceTitle: '宠物医生猫咪洗耳液 120ml', spec: '120ml', price: 29.9, priceUnit: '瓶', note: '', url: 'https://search.jd.com/Search?keyword=%E5%AE%A0%E7%89%A9%E5%8C%BB%E7%94%9F%20%E7%8C%AB%E5%92%AA%E6%B4%97%E8%80%B3%E6%B6%B2%20120ml' },
  { category: '猫砂 / 清洁护理', subcategory: '清洁护理', brand: '尾巴生活', series: '日常清洁系列', product: '猫咪湿巾', sourceTitle: '尾巴生活猫咪湿巾 80抽', spec: '80抽', price: 19.9, priceUnit: '包', note: '', url: 'https://search.jd.com/Search?keyword=%E5%B0%BE%E5%B7%B4%E7%94%9F%E6%B4%BB%20%E7%8C%AB%E5%92%AA%E6%B9%BF%E5%B7%BE%2080%E6%8A%BD' },
  { category: '猫砂 / 清洁护理', subcategory: '清洁护理', brand: '小佩', series: '环境清洁系列', product: '猫砂盆清洁泡沫', sourceTitle: '小佩宠物猫砂盆清洁泡沫 500ml', spec: '500ml', price: 39.9, priceUnit: '瓶', note: '', url: 'https://search.jd.com/Search?keyword=%E5%B0%8F%E4%BD%A9%20%E7%8C%AB%E7%A0%82%E7%9B%86%20%E6%B8%85%E6%B4%81%E6%B3%A1%E6%B2%AB%20500ml' },

  { category: '航空箱 / 猫包', subcategory: '猫包', brand: '憨憨宠', series: '猫包系列', product: '双肩猫包', sourceTitle: '憨憨宠猫咪双肩背包 39×26×33cm', spec: '39×26×33cm', price: 38.6, priceUnit: '个', note: '', url: 'https://item.jd.com/10228707023985.html' },
  { category: '航空箱 / 猫包', subcategory: '航空箱', brand: '田田宠', series: '航空箱系列', product: '便携航空箱', sourceTitle: '田田宠猫咪航空箱 48×32×30cm', spec: '48×32×30cm', price: 36.92, priceUnit: '个', note: '', url: 'https://item.jd.com/100113144074.html' },
  { category: '航空箱 / 猫包', subcategory: '航空箱', brand: '无品牌', series: '航空箱系列', product: '便携航空箱', sourceTitle: '猫咪便携航空箱 灰色 45×28×28cm', spec: '45×28×28cm', price: 25.9, priceUnit: '个', note: '', url: 'https://item.jd.com/10126118177271.html' },
  { category: '航空箱 / 猫包', subcategory: '猫包', brand: '来客思', series: '猫包系列', product: '透气猫包', sourceTitle: '来客思猫咪双肩包 透气款 42×30×35cm', spec: '42×30×35cm', price: 43.97, priceUnit: '个', note: '', url: 'https://item.jd.com/100045381419.html' },
  { category: '航空箱 / 猫包', subcategory: '航空箱', brand: '憨憨宠', series: '航空箱系列', product: '折叠航空箱', sourceTitle: '憨憨宠猫咪折叠航空箱 50×34×32cm', spec: '50×34×32cm', price: 32.31, priceUnit: '个', note: '', url: 'https://item.jd.com/52999103662.html' },
  { category: '航空箱 / 猫包', subcategory: '猫包', brand: '憨憨宠', series: '猫包系列', product: '太空舱猫包', sourceTitle: '憨憨宠猫咪太空舱背包 43×32×33cm', spec: '43×32×33cm', price: 36.8, priceUnit: '个', note: '', url: 'https://item.jd.com/10086629990755.html' },
  { category: '航空箱 / 猫包', subcategory: '航空箱', brand: '妙鲜生', series: '航空箱系列', product: '航空箱', sourceTitle: '妙鲜生猫咪航空箱 55×37×35cm', spec: '55×37×35cm', price: 62.0, priceUnit: '个', note: '', url: 'https://item.jd.com/10122160362846.html' },
  { category: '航空箱 / 猫包', subcategory: '猫包', brand: '憨憨宠', series: '猫包系列', product: '透气双肩猫包', sourceTitle: '憨憨宠猫咪透气双肩包 40×28×35cm', spec: '40×28×35cm', price: 33.2, priceUnit: '个', note: '', url: 'https://item.jd.com/10167271079557.html' },
  { category: '航空箱 / 猫包', subcategory: '航空箱', brand: 'KIMPETS', series: '航空箱系列', product: '航空箱', sourceTitle: 'KIMPETS猫咪航空箱 52×35×35cm', spec: '52×35×35cm', price: 54.7, priceUnit: '个', note: '', url: 'https://item.jd.com/10172207293085.html' },
  { category: '航空箱 / 猫包', subcategory: '航空箱', brand: '妙鲜生', series: '航空箱系列', product: '便携航空箱', sourceTitle: '妙鲜生猫咪便携航空箱 48×32×32cm', spec: '48×32×32cm', price: 39.87, priceUnit: '个', note: '', url: 'https://item.jd.com/10068029408335.html' },

  { category: '猫窝 / 保暖', subcategory: '', brand: '柒哦', series: '加热猫窝系列', product: '加热猫窝', sourceTitle: '柒哦猫咪加热窝 带加热垫 40×35×35cm', spec: '40×35×35cm', price: 129.0, priceUnit: '个', note: '', url: 'https://item.jd.com/10200228772985.html' },
  { category: '猫窝 / 保暖', subcategory: '', brand: 'POPOCOLA', series: '保暖毯系列', product: '宠物保暖毯', sourceTitle: 'POPOCOLA猫咪宠物保暖毯 60×40cm', spec: '60×40cm', price: 39.9, priceUnit: '条', note: '', url: 'https://item.jd.com/10196844958940.html' },
  { category: '猫窝 / 保暖', subcategory: '', brand: 'COCS', series: '猫窝系列', product: '三层猫窝', sourceTitle: 'COCS猫咪三层别墅猫窝 39×39×64cm', spec: '39×39×64cm', price: 199.0, priceUnit: '个', note: '', url: 'https://item.jd.com/10117409650107.html' },
  { category: '猫窝 / 保暖', subcategory: '', brand: '疯狂的主人', series: '猫窝系列', product: '猫抓板窝', sourceTitle: '疯狂的主人猫咪猫抓板窝', spec: '猫用', price: 69.9, priceUnit: '个', note: '', url: 'https://item.jd.com/100123019331.html' },
  { category: '猫窝 / 保暖', subcategory: '', brand: '瑷霂', series: '猫窝系列', product: '立式猫抓窝', sourceTitle: '瑷霂猫咪立式猫抓板窝', spec: '猫用', price: 59.9, priceUnit: '个', note: '', url: 'https://item.jd.com/10097033160585.html' },
  { category: '猫窝 / 保暖', subcategory: '', brand: '无品牌', series: '流浪猫保暖系列', product: '户外保暖窝', sourceTitle: '户外流浪猫保暖窝 泡沫隔热板款', spec: '户外用', price: 89.0, priceUnit: '个', note: '', url: 'https://item.jd.com/10175909317584.html' },
  { category: '猫窝 / 保暖', subcategory: '', brand: '唐米吉吉', series: '猫爬架系列', product: '猫爬架猫窝', sourceTitle: '唐米吉吉猫咪猫爬架 带猫窝款', spec: '猫用', price: 299.0, priceUnit: '个', note: '', url: 'https://item.jd.com/10100881498724.html' },
  { category: '猫窝 / 保暖', subcategory: '', brand: '兽牌', series: '猫爬架系列', product: '猫爬架猫窝', sourceTitle: '兽牌猫咪猫爬架 带猫窝款', spec: '猫用', price: 399.0, priceUnit: '个', note: '', url: 'https://item.jd.com/10121978215956.html' },
  { category: '猫窝 / 保暖', subcategory: '', brand: 'HELLOLEIBOO', series: '保暖猫窝系列', product: '保暖猫窝', sourceTitle: 'HELLOLEIBOO猫咪保暖窝 冬季款', spec: '猫用', price: 99.0, priceUnit: '个', note: '', url: 'https://item.jd.com/10180942933968.html' },
  { category: '猫窝 / 保暖', subcategory: '', brand: '无品牌', series: '流浪猫保暖系列', product: '户外木质猫窝', sourceTitle: '户外流浪猫木质保暖窝 防雨款', spec: '户外用', price: 259.0, priceUnit: '个', note: '', url: 'https://item.jd.com/10167936388243.html' },
];

export const priceSnapshot = {
  meta: {
    fetchedAt: '2026-08-12',
  },
  items: rawItems.map(normalizeProcurementItem),
};
