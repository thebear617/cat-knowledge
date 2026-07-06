const catProfiles = [
  {
    name: '奶霜',
    status: '就读中',
    friendliness: '非常怕人',
    vaccine: '一针 2026-04-29；二针未接种；三针未接种',
    sterilized: '未绝育',
    notes: '原第二针窗口 5.20~5.27；因抓不到暂未接种，抓到后咨询医生补种方案。',
    source: '就读中猫咪名单',
    images: ['images/奶霜/奶霜1.jpg']
  },
  {
    name: '水手',
    status: '就读中',
    friendliness: '亲人',
    vaccine: '一针 2026-05-10；二针 2026-05-31；三针未接种',
    sterilized: '未绝育',
    notes: '第三针认捐人：蔚蓝future',
    source: '就读中猫咪名单',
    images: ['images/水手/水手1.jpg']
  },
  {
    name: '虎先锋',
    status: '就读中',
    friendliness: '非常怕人',
    vaccine: '一针 2026-05-11；二针未接种；三针未接种',
    sterilized: '未绝育',
    notes: '—',
    source: '就读中猫咪名单',
    images: ['images/虎先锋/虎先锋5.jpg', 'images/虎先锋/虎先锋4.jpg', 'images/虎先锋/虎先锋3.jpg', 'images/虎先锋/虎先锋2.jpg', 'images/虎先锋/虎先锋1.jpg']
  },
  {
    name: '警长',
    status: '就读中',
    friendliness: '怕人',
    vaccine: '一针 2025-11-01；二针未接种；三针未接种',
    sterilized: '未绝育',
    notes: '—',
    source: '就读中猫咪名单',
    images: ['images/警长/警长1.jpg']
  },
  {
    name: '银杏',
    status: '就读中',
    friendliness: '亲人',
    vaccine: '一针 2025-11-30；二针未接种；三针未接种',
    sterilized: '未绝育',
    notes: '第二/三针认捐人：毛橘妈',
    source: '就读中猫咪名单',
    images: ['images/银杏/银杏1.jpg', 'images/银杏/银杏2.jpg', 'images/银杏/银杏3.jpg', 'images/银杏/银杏4.jpg', 'images/银杏/银杏5.jpg']
  },
  {
    name: '黑小虎',
    status: '就读中',
    friendliness: '怕人',
    vaccine: '一针 2025-11-30；二针未接种；三针未接种',
    sterilized: '未绝育',
    notes: '第二/三针认捐人：长乐',
    source: '就读中猫咪名单',
    images: ['images/黑小虎/黑小虎1.jpg']
  },
  {
    name: '茶叶大蛋',
    status: '就读中',
    friendliness: '非常怕人',
    vaccine: '未接种',
    sterilized: '未绝育',
    notes: '第二/三针认捐人：毛橘妈',
    source: '就读中猫咪名单',
    images: ['images/茶叶大蛋/茶叶大蛋1.jpg']
  },
  {
    name: '黑哥',
    status: '就读中',
    friendliness: '怕人',
    vaccine: '未接种',
    sterilized: '未绝育',
    notes: '第二针认捐人：鲨人不wink',
    source: '就读中猫咪名单',
    images: ['images/黑哥/黑哥2.jpg', 'images/黑哥/黑哥1.jpg']
  },
  {
    name: '彪哥',
    status: '就读中',
    friendliness: '非常怕人',
    vaccine: '一针 2026-05-20；二针未接种；三针未接种',
    sterilized: '未绝育',
    notes: '斜眼狼儿子；第二针认捐人：鲨人不wink',
    source: '就读中猫咪名单',
    images: ['images/彪哥/彪哥4.jpg', 'images/彪哥/彪哥3.jpg', 'images/彪哥/彪哥2.jpg', 'images/彪哥/彪哥1.jpg']
  },
  {
    name: '豆介',
    status: '就读中',
    friendliness: '非常怕人',
    vaccine: '未接种',
    sterilized: '未绝育',
    notes: '第二针认捐人：刘岛；第三针认捐人：李介清',
    source: '就读中猫咪名单',
    images: ['images/豆介/豆介2.jpg', 'images/豆介/豆介1.jpg']
  },
  {
    name: '大面包',
    status: '就读中',
    friendliness: '亲人',
    vaccine: '一针 2025-08-01；二针 2025-09-01；三针 2026-04-29',
    sterilized: '未绝育',
    notes: '第三针由大面包car协助',
    source: '就读中猫咪名单',
    images: ['images/大面包/大面包2.jpg', 'images/大面包/大面包1.jpg']
  },
  {
    name: '芸豆',
    status: '就读中',
    friendliness: '亲人',
    vaccine: '一针 2025-11-01；二针 2026-04-01；三针 2026-05-18',
    sterilized: '未绝育',
    notes: '—',
    source: '就读中猫咪名单',
    images: ['images/芸豆/芸豆1.jpg']
  },
  {
    name: '二橙',
    status: '已毕业',
    friendliness: '亲人',
    vaccine: '一针 2026-03-01；二针 2026-03-01；三针 2026-04-01',
    sterilized: '未绝育',
    notes: '—',
    source: '已毕业猫咪名单',
    images: ['images/二橙/二橙3.jpg', 'images/二橙/二橙2.jpg', 'images/二橙/二橙1.jpg']
  },
  {
    name: '二柑',
    status: '已毕业',
    friendliness: '亲人',
    vaccine: '一针 2026-03-01；二针 2026-03-01；三针 2026-04-01',
    sterilized: '未绝育',
    notes: '—',
    source: '已毕业猫咪名单',
    images: ['images/二柑/二柑6.jpg', 'images/二柑/二柑5.jpg', 'images/二柑/二柑4.jpg', 'images/二柑/二柑3.jpg', 'images/二柑/二柑2.jpg', 'images/二柑/二柑1.jpg']
  },
  {
    name: '渣男',
    status: '就读中',
    friendliness: '亲人',
    vaccine: '未接种',
    sterilized: '未绝育',
    notes: '2026-05-31 诊断牙龈炎，治疗中。疫苗需等病后评估。',
    source: '就读中猫咪名单',
    images: ['images/渣男/渣男3.jpg', 'images/渣男/渣男2.jpg', 'images/渣男/渣男1.jpg']
  },
  {
    name: '豆腐脑',
    status: '就读中',
    friendliness: '怕人',
    vaccine: '未接种',
    sterilized: '2026-05-10 已绝育',
    notes: '—',
    source: '就读中猫咪名单',
    images: ['images/豆腐脑/豆腐脑1.jpg']
  },
  {
    name: '脏白',
    status: '就读中',
    friendliness: '怕人',
    vaccine: '未接种',
    sterilized: '未绝育',
    notes: '—',
    source: '就读中猫咪名单',
    images: ['images/脏白/脏白2.jpg', 'images/脏白/脏白1.jpg']
  },
  {
    name: '蓝豆',
    status: '就读中',
    friendliness: '怕人',
    vaccine: '未接种',
    sterilized: '未绝育',
    notes: '—',
    source: '就读中猫咪名单',
    images: ['images/蓝豆/蓝豆1.jpg']
  },
  {
    name: '天水',
    status: '就读中',
    friendliness: '怕人',
    vaccine: '未接种',
    sterilized: '未绝育',
    notes: '—',
    source: '就读中猫咪名单',
    images: ['images/天水/天水1.jpg']
  },
  {
    name: '来才',
    status: '就读中',
    friendliness: '怕人',
    vaccine: '未接种',
    sterilized: '未绝育',
    notes: '—',
    source: '就读中猫咪名单',
    images: ['images/来才/来才1.jpg']
  },
  {
    name: '焦炭馒头',
    status: '就读中',
    friendliness: '怕人',
    vaccine: '未接种',
    sterilized: '未绝育',
    notes: '—',
    source: '就读中猫咪名单',
    images: ['images/焦炭馒头/焦炭馒头1.jpg']
  },
  {
    name: '小小黑',
    status: '就读中',
    friendliness: '怕人',
    vaccine: '未接种',
    sterilized: '2026-05-17 已绝育',
    notes: '2026-05-17 在缘愈绝育/治疗，术后恢复待跟进。',
    source: '就读中猫咪名单',
    images: ['images/小小黑/小小黑2.jpg', 'images/小小黑/小小黑1.jpg']
  },
  {
    name: '麻薯',
    status: '已毕业',
    friendliness: '亲人',
    vaccine: '未接种（受伤期评估后未补种）',
    sterilized: '已绝育（日期待补充）',
    notes: '曾受伤，仍有猫传腹风险；领养时未补种疫苗。',
    source: '已毕业猫咪名单',
    images: ['images/麻薯/麻薯2.jpg', 'images/麻薯/麻薯1.jpg']
  },
  {
    name: '豆花',
    status: '已毕业',
    friendliness: '亲人',
    vaccine: '品牌待追溯·一针 2026-04-29（紫薇京和）；二针待追溯；三针约 2026-05-24',
    sterilized: '已绝育（日期待补充）',
    notes: '三针医院或品牌待追溯',
    source: '已毕业猫咪名单',
    images: ['images/豆花/豆花2.jpg', 'images/豆花/豆花1.jpg']
  },
  {
    name: '二头',
    status: '已毕业',
    friendliness: '亲人',
    vaccine: '妙三多·一针 2025-07-27；二针 2025-09-06；三针 2025-09-27（紫薇京和）',
    sterilized: '2023-03-02 已绝育',
    notes: '2026-06-01 领养前体检总体健康，轻微膀胱炎。',
    source: '已毕业猫咪名单',
    images: ['images/二头/二头3.jpg', 'images/二头/二头2.jpg', 'images/二头/二头1.jpg']
  },
  {
    name: '白介',
    status: '已毕业',
    friendliness: '亲人',
    vaccine: '品牌待追溯·一针待追溯；二针待追溯；三针窗口 5.26~6.2（紫薇京和）',
    sterilized: '已绝育（日期待补充）',
    notes: '预计 2026-06-15 领养',
    source: '已毕业猫咪名单',
    images: ['images/白介/白介2.jpg', 'images/白介/白介1.jpg']
  },
  {
    name: '小花',
    status: '已毕业',
    friendliness: '亲人',
    vaccine: '妙三多·三针已完成（具体日期待追溯）',
    sterilized: '已绝育（日期待补充）',
    notes: '预计 2026-06，具体日期待补充',
    source: '已毕业猫咪名单',
    images: ['images/小花/小花4.jpg', 'images/小花/小花3.jpg', 'images/小花/小花2.jpg', 'images/小花/小花1.jpg']
  },
  {
    name: '大头',
    status: '就读中',
    friendliness: '亲人',
    vaccine: '妙三多·一针 2025-07-27；二针 2025-09-09；三针 2025-10-07（紫薇京和）',
    sterilized: '已绝育（日期待补充）',
    notes: '—',
    source: '就读中猫咪名单',
    images: ['images/大头/datou9.jpg', 'images/大头/datou8.jpg', 'images/大头/datou7.jpg', 'images/大头/datou6.jpg', 'images/大头/datou5.jpg', 'images/大头/datou4.jpg', 'images/大头/datou1.jpg', 'images/大头/datou2.jpg', 'images/大头/datou3.jpg']
  },
  {
    name: '漂亮橘',
    status: '就读中',
    friendliness: '亲人',
    vaccine: '妙三多·一针 2026-05-10；二针 2026-05-31；三针待认领',
    sterilized: '已绝育（日期待补充）',
    notes: '—',
    source: '就读中猫咪名单',
    images: ['images/漂亮橘/漂亮橘4.jpg', 'images/漂亮橘/漂亮橘3.jpg', 'images/漂亮橘/漂亮橘2.jpg', 'images/漂亮橘/漂亮橘1.jpg']
  },
  {
    name: '橙留香',
    status: '已毕业',
    friendliness: '亲人',
    vaccine: '喵倍护·三针已完成（具体日期待追溯）',
    sterilized: '已绝育（日期待补充）',
    notes: '预计领养，具体日期待补充',
    source: '已毕业猫咪名单',
    images: ['images/橙留香/橙留香3.jpg', 'images/橙留香/橙留香2.jpg', 'images/橙留香/橙留香1.jpg']
  },
  {
    name: '裤裤',
    status: '已毕业',
    friendliness: '亲人',
    vaccine: '喵倍护·三针已完成（具体日期待追溯）',
    sterilized: '已绝育（日期待补充）',
    notes: '预计领养，具体日期待补充',
    source: '已毕业猫咪名单',
    images: ['images/裤裤/裤裤3.jpg', 'images/裤裤/裤裤2.jpg', 'images/裤裤/裤裤1.jpg']
  },
  {
    name: '深情哥',
    status: '已毕业',
    friendliness: '亲人',
    vaccine: '喵倍护·三针已完成（具体日期待追溯）；加强针 2026-05-11',
    sterilized: '已绝育（日期待补充）',
    notes: '预计领养，具体日期待补充',
    source: '已毕业猫咪名单',
    images: ['images/深情哥/深情哥2.jpg', 'images/深情哥/深情哥1.jpg']
  },
  {
    name: '咖啡',
    status: '已去喵星',
    friendliness: '亲人',
    vaccine: '—',
    sterilized: '未绝育',
    notes: '约 2026-04-30 因猫瘟去世，具体日期待补充。',
    source: '已离世或失踪猫咪名单',
    images: ['images/咖啡/咖啡2.jpg', 'images/咖啡/咖啡1.jpg']
  },
  {
    name: '胆小橘',
    status: '就读中',
    friendliness: '怕人',
    vaccine: '未接种',
    sterilized: '2026-07-04 已绝育',
    notes: '橘白双色，怕人，已绝育但疫苗未接种。',
    source: '就读中猫咪名单',
    images: ['images/胆小橘/胆小橘1.jpg']
  },
  {
    name: '金琥',
    status: '就读中',
    friendliness: '怕人',
    vaccine: '未接种',
    sterilized: '2026-06-28 已绝育',
    notes: '纯白短毛，怕人，已绝育但疫苗未接种。',
    source: '就读中猫咪名单',
    images: ['images/金琥/金琥2.jpg', 'images/金琥/金琥1.jpg']
  }
];
