/**
 * Builds public/_locales/{en,zh_CN,zh_TW}/messages.json from one catalog.
 * Run: node scripts/generate-locales.mjs
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

/** @typedef {{ en: string, zh_CN: string, zh_TW: string }} Tri */

/** @type {Record<string, Tri>} */
const catalog = {
  extName: {
    en: 'Keyword Watch',
    zh_CN: 'Keyword Watch 关键词趋势监测',
    zh_TW: 'Keyword Watch 關鍵詞趨勢監測',
  },
  extDescription: {
    en: 'Subscribe to keywords and track Baidu Index and Google Trends locally. A badge alerts you when search interest changes significantly.',
    zh_CN: '订阅关键词，本地追踪百度指数与 Google Trends 趋势，热度显著变化时通过角标提醒。',
    zh_TW: '訂閱關鍵詞，本地追蹤百度指數與 Google Trends 趨勢，熱度顯著變化時透過角標提醒。',
  },

  requestFailed: { en: 'Request failed', zh_CN: '请求失败', zh_TW: '請求失敗' },
  letterFallback: { en: 'K', zh_CN: '词', zh_TW: '詞' },
  unnamedSubscription: { en: 'Untitled subscription', zh_CN: '未命名订阅', zh_TW: '未命名訂閱' },
  defaultSubName: { en: 'COVID-19 trend watch', zh_CN: '新冠趋势关注', zh_TW: '新冠趨勢關注' },

  errMaxSubscriptions: {
    en: 'You can create at most $1$ subscriptions',
    zh_CN: '最多创建 $1$ 个订阅',
    zh_TW: '最多建立 $1$ 個訂閱',
  },
  errNeedKeyword: {
    en: 'Add at least 1 keyword',
    zh_CN: '请至少添加 1 个关键词',
    zh_TW: '請至少新增 1 個關鍵詞',
  },
  errMaxKeywords: {
    en: 'Each subscription can have at most $1$ keywords',
    zh_CN: '每个订阅最多 $1$ 个关键词',
    zh_TW: '每個訂閱最多 $1$ 個關鍵詞',
  },
  errNeedSource: {
    en: 'Enable at least one data source',
    zh_CN: '请至少启用一个数据来源',
    zh_TW: '請至少啟用一個資料來源',
  },
  errInvalidImage: { en: 'Invalid image', zh_CN: '无效的图片', zh_TW: '無效的圖片' },
  errImageTooLarge: {
    en: 'Image is too large. Please choose a smaller one.',
    zh_CN: '图片过大，请选择更小的图片',
    zh_TW: '圖片過大，請選擇更小的圖片',
  },

  sourceBaidu: { en: 'Baidu Index', zh_CN: '百度指数', zh_TW: '百度指數' },
  sourceGoogle: { en: 'Google Trends', zh_CN: 'Google Trends', zh_TW: 'Google Trends' },
  sourceNone: { en: 'No source enabled', zh_CN: '未启用来源', zh_TW: '未啟用來源' },
  sourceFetchFailed: {
    en: '$1$ fetch failed',
    zh_CN: '$1$获取失败',
    zh_TW: '$1$取得失敗',
  },
  sourceFetchFailedWithDetail: {
    en: '$1$ fetch failed: $2$',
    zh_CN: '$1$获取失败: $2$',
    zh_TW: '$1$取得失敗：$2$',
  },
  baiduNotLoggedIn: {
    en: 'Not signed in to Baidu',
    zh_CN: '未登录百度账号',
    zh_TW: '未登入百度帳號',
  },

  alertVolatility: {
    en: '$1$: related keywords show clearly higher search-interest volatility',
    zh_CN: '$1$：关联关键词搜索热度波动明显加剧',
    zh_TW: '$1$：關聯關鍵詞搜尋熱度波動明顯加劇',
  },
  alertRise: {
    en: '$1$: related keywords show a significant recent rise in search interest',
    zh_CN: '$1$：关联关键词近期搜索热度显著上升',
    zh_TW: '$1$：關聯關鍵詞近期搜尋熱度顯著上升',
  },
  alertDrop: {
    en: '$1$: related keywords show a clear recent drop in search interest',
    zh_CN: '$1$：关联关键词近期搜索热度明显下降',
    zh_TW: '$1$：關聯關鍵詞近期搜尋熱度明顯下降',
  },

  baiduAntiBot: {
    en: 'Baidu Index returned a non-data page (possible security check)',
    zh_CN: '百度指数返回了非数据页面（疑似安全校验）',
    zh_TW: '百度指數回傳了非資料頁面（疑似安全驗證）',
  },
  baiduRateLimited: {
    en: 'Baidu Index is temporarily rate-limiting access. Will retry automatically.',
    zh_CN: '百度指数暂时限制访问，稍后自动重试',
    zh_TW: '百度指數暫時限制存取，稍後自動重試',
  },
  baiduRequestFailed: {
    en: 'Baidu Index request failed: $1$',
    zh_CN: '百度指数请求失败: $1$',
    zh_TW: '百度指數請求失敗：$1$',
  },
  baiduAuth: {
    en: 'Not signed in to Baidu, or no Baidu Index access',
    zh_CN: '未登录百度或没有百度指数权限',
    zh_TW: '未登入百度或沒有百度指數權限',
  },
  baiduParse: {
    en: 'Baidu Index response format changed',
    zh_CN: '百度指数响应结构变化',
    zh_TW: '百度指數回應結構改變',
  },
  baiduKeyFailed: {
    en: 'Failed to obtain Baidu Index decryption key',
    zh_CN: '百度指数密钥获取失败',
    zh_TW: '百度指數金鑰取得失敗',
  },
  baiduKeyRequestFailed: {
    en: 'Baidu Index key request failed: $1$',
    zh_CN: '百度指数密钥请求失败: $1$',
    zh_TW: '百度指數金鑰請求失敗：$1$',
  },
  baiduDecryptFailed: {
    en: 'Baidu Index decryption failed',
    zh_CN: '百度指数解密失败',
    zh_TW: '百度指數解密失敗',
  },
  googleRateLimited: {
    en: 'Google Trends is rate-limiting access. Will retry automatically.',
    zh_CN: 'Google Trends 访问受限，稍后自动重试',
    zh_TW: 'Google Trends 存取受限，稍後自動重試',
  },
  googleParse: {
    en: 'Google Trends response format changed',
    zh_CN: 'Google Trends 响应结构变化',
    zh_TW: 'Google Trends 回應結構改變',
  },
  googleRequestFailed: {
    en: 'Google Trends request failed: $1$',
    zh_CN: 'Google Trends 请求失败: $1$',
    zh_TW: 'Google Trends 請求失敗：$1$',
  },
  googleTimelineParse: {
    en: 'Google Trends timeline format changed',
    zh_CN: 'Google Trends 时间线结构变化',
    zh_TW: 'Google Trends 時間線結構改變',
  },
  googleDataRequestFailed: {
    en: 'Google Trends data request failed: $1$',
    zh_CN: 'Google Trends 数据请求失败: $1$',
    zh_TW: 'Google Trends 資料請求失敗：$1$',
  },

  range7d: { en: '7d', zh_CN: '7天', zh_TW: '7天' },
  range30d: { en: '30d', zh_CN: '30天', zh_TW: '30天' },
  range90d: { en: '90d', zh_CN: '90天', zh_TW: '90天' },
  range1y: { en: '1y', zh_CN: '1年', zh_TW: '1年' },

  noAlert: { en: 'No trend alerts yet', zh_CN: '暂无趋势提醒', zh_TW: '暫無趨勢提醒' },
  justNow: { en: 'just now', zh_CN: '刚刚', zh_TW: '剛剛' },
  hoursAgo: { en: '$1$h ago', zh_CN: '$1$小时前', zh_TW: '$1$小時前' },
  daysAgo: { en: '$1$d ago', zh_CN: '$1$天前', zh_TW: '$1$天前' },
  neverChecked: { en: 'Not checked yet', zh_CN: '尚未检查', zh_TW: '尚未檢查' },
  lastCheckToday: { en: 'Checked $1$', zh_CN: '上次检查 $1$', zh_TW: '上次檢查 $1$' },
  lastCheckDate: { en: 'Checked $1$', zh_CN: '上次检查 $1$', zh_TW: '上次檢查 $1$' },

  refreshManual: { en: 'Refresh now', zh_CN: '手动刷新', zh_TW: '手動重新整理' },
  manageSubscriptions: { en: 'Manage subscriptions', zh_CN: '管理订阅', zh_TW: '管理訂閱' },
  loading: { en: 'Loading…', zh_CN: '加载中…', zh_TW: '載入中…' },
  baiduLoginBanner: {
    en: 'Sign in to Baidu to fetch Baidu Index. Data updates automatically after login.',
    zh_CN: '登录百度账号后即可获取百度指数，登录后会自动更新。',
    zh_TW: '登入百度帳號後即可取得百度指數，登入後會自動更新。',
  },
  goLogin: { en: 'Sign in', zh_CN: '去登录', zh_TW: '去登入' },
  emptyTitle: { en: 'No subscriptions yet', zh_CN: '还没有订阅', zh_TW: '還沒有訂閱' },
  emptySub: {
    en: 'Create a keyword subscription to start tracking search interest.',
    zh_CN: '创建一个关键词订阅，开始追踪搜索热度。',
    zh_TW: '建立一個關鍵詞訂閱，開始追蹤搜尋熱度。',
  },
  createSubscription: { en: 'Create subscription', zh_CN: '创建订阅', zh_TW: '建立訂閱' },
  noSourceEnabled: { en: 'No data source enabled', zh_CN: '未启用数据来源', zh_TW: '未啟用資料來源' },

  waitingFirstData: { en: 'Waiting for first data', zh_CN: '等待首次数据', zh_TW: '等待首次資料' },
  dataUntil: { en: 'Data through $1$', zh_CN: '数据至 $1$', zh_TW: '資料至 $1$' },
  failHintLogin: {
    en: 'Will resume automatically after you sign in to Baidu',
    zh_CN: '登录百度账号后会自动恢复',
    zh_TW: '登入百度帳號後會自動恢復',
  },
  failHintRateLimited: {
    en: 'Access was a bit frequent. Will retry on the next check.',
    zh_CN: '访问有点频繁，下次检查时自动重试',
    zh_TW: '存取有點頻繁，下次檢查時自動重試',
  },
  failHintParse: {
    en: 'The website layout changed. Waiting for an extension update.',
    zh_CN: '网站页面有变化，等待扩展更新',
    zh_TW: '網站頁面有變化，等待擴充功能更新',
  },
  failHintNetwork: {
    en: 'Network is temporarily unavailable. Will retry on the next check.',
    zh_CN: '网络暂时不可用，下次检查时自动重试',
    zh_TW: '網路暫時無法使用，下次檢查時自動重試',
  },
  learning: {
    en: 'Learning the trend. Smart alerts start after more data accumulates.',
    zh_CN: '正在学习趋势，积累更多数据后开始智能提醒',
    zh_TW: '正在學習趨勢，累積更多資料後開始智慧提醒',
  },
  noData: { en: 'No data yet', zh_CN: '暂无数据', zh_TW: '暫無資料' },
  chartAria: { en: '$1$ trend chart', zh_CN: '$1$ 趋势图', zh_TW: '$1$ 趨勢圖' },
  baiduFetchFailedShort: {
    en: 'Baidu Index fetch failed',
    zh_CN: '百度指数获取失败',
    zh_TW: '百度指數取得失敗',
  },
  googleFetchFailedShort: {
    en: 'Google Trends fetch failed',
    zh_CN: 'Google Trends 获取失败',
    zh_TW: 'Google Trends 取得失敗',
  },

  optionsTitle: {
    en: 'Keyword Watch · Subscriptions',
    zh_CN: 'Keyword Watch · 订阅管理',
    zh_TW: 'Keyword Watch · 訂閱管理',
  },
  saved: { en: 'Saved', zh_CN: '已保存', zh_TW: '已儲存' },
  mySubscriptions: { en: 'My subscriptions', zh_CN: '我的订阅', zh_TW: '我的訂閱' },
  newSubscription: { en: 'New subscription', zh_CN: '新建订阅', zh_TW: '新建訂閱' },
  editSubscription: { en: 'Edit subscription', zh_CN: '编辑订阅', zh_TW: '編輯訂閱' },
  atLimit: {
    en: 'Limit reached ($1$ subscriptions).',
    zh_CN: '已达上限（$1$ 个订阅）。',
    zh_TW: '已達上限（$1$ 個訂閱）。',
  },
  emptyListHint: {
    en: 'No subscriptions yet. Click “New subscription” to track keywords you care about.',
    zh_CN: '还没有订阅。点击「新建订阅」，追踪你关心的关键词。',
    zh_TW: '還沒有訂閱。點「新建訂閱」，追蹤你關心的關鍵詞。',
  },
  listSep: { en: ', ', zh_CN: '、', zh_TW: '、' },
  metaLine: {
    en: '$1$ · $2$ · $3$ sensitivity',
    zh_CN: '$1$ · $2$ · $3$灵敏度',
    zh_TW: '$1$ · $2$ · $3$靈敏度',
  },
  disable: { en: 'Disable', zh_CN: '停用', zh_TW: '停用' },
  enable: { en: 'Enable', zh_CN: '启用', zh_TW: '啟用' },
  edit: { en: 'Edit', zh_CN: '编辑', zh_TW: '編輯' },
  delete: { en: 'Delete', zh_CN: '删除', zh_TW: '刪除' },
  confirmDelete: { en: 'Confirm delete?', zh_CN: '确认删除？', zh_TW: '確認刪除？' },
  cancel: { en: 'Cancel', zh_CN: '取消', zh_TW: '取消' },
  save: { en: 'Save', zh_CN: '保存', zh_TW: '儲存' },
  saving: { en: 'Saving…', zh_CN: '保存中…', zh_TW: '儲存中…' },

  keywordsLabel: {
    en: 'Which keywords do you want to watch? (up to $1$)',
    zh_CN: '想关注哪些关键词？（最多 $1$ 个）',
    zh_TW: '想關注哪些關鍵詞？（最多 $1$ 個）',
  },
  removeKeyword: { en: 'Remove $1$', zh_CN: '移除 $1$', zh_TW: '移除 $1$' },
  keywordsPlaceholder: {
    en: 'e.g. electric vehicles, BYD',
    zh_CN: '例如：新能源汽车，比亚迪',
    zh_TW: '例如：新能源汽車，比亞迪',
  },
  add: { en: 'Add', zh_CN: '添加', zh_TW: '新增' },
  keywordsHint: {
    en: 'You can paste multiple words separated by commas or spaces. Other settings have sensible defaults — just save.',
    zh_CN: '可以一次粘贴多个词，用逗号或空格分开。其余设置都有推荐默认值，直接保存即可。',
    zh_TW: '可以一次貼上多個詞，用逗號或空格分開。其餘設定都有建議預設值，直接儲存即可。',
  },
  nameIconLabel: {
    en: 'Name and icon (optional)',
    zh_CN: '名称与图标（可不填）',
    zh_TW: '名稱與圖示（可不填）',
  },
  changeIcon: { en: 'Change icon', zh_CN: '更换图标', zh_TW: '更換圖示' },
  clickChangeIcon: { en: 'Click to change icon', zh_CN: '点击更换图标', zh_TW: '點擊更換圖示' },
  namePlaceholder: {
    en: 'Leave blank to use the first keyword',
    zh_CN: '不填则自动使用第一个关键词',
    zh_TW: '不填則自動使用第一個關鍵詞',
  },
  useInitial: { en: 'Use initial letter', zh_CN: '用首字生成', zh_TW: '用首字產生' },
  uploadSquare: { en: 'Upload square image', zh_CN: '上传方形图片', zh_TW: '上傳方形圖片' },

  dataSources: { en: 'Data sources', zh_CN: '数据来源', zh_TW: '資料來源' },
  baiduNeedsLogin: {
    en: 'Requires a Baidu account sign-in',
    zh_CN: '需要登录百度账号',
    zh_TW: '需要登入百度帳號',
  },
  googleNoLogin: { en: 'No sign-in required', zh_CN: '无需登录', zh_TW: '無需登入' },

  alertTemplate: { en: 'Alert template', zh_CN: '告警模板', zh_TW: '警示範本' },
  templateSmart: { en: 'Smart monitor', zh_CN: '智能监测', zh_TW: '智慧監測' },
  templateSmartDesc: {
    en: 'Combines multiple change signals',
    zh_CN: '综合多种变化信号',
    zh_TW: '綜合多種變化訊號',
  },
  templateRapidRise: { en: 'Rapid rise', zh_CN: '快速升温', zh_TW: '快速升溫' },
  templateRapidRiseDesc: {
    en: 'Sudden short-term increase',
    zh_CN: '短期突然上涨',
    zh_TW: '短期突然上漲',
  },
  templateSustainedRise: { en: 'Sustained rise', zh_CN: '持续上升', zh_TW: '持續上升' },
  templateSustainedRiseDesc: {
    en: 'Rising for a stretch of days',
    zh_CN: '连续一段时间上涨',
    zh_TW: '連續一段時間上漲',
  },
  templateTrendReversal: { en: 'Trend reversal', zh_CN: '趋势反转', zh_TW: '趨勢反轉' },
  templateTrendReversalDesc: {
    en: 'Turns up from flat or declining',
    zh_CN: '从平稳或下降转为上涨',
    zh_TW: '從平穩或下降轉為上漲',
  },
  templateAbnormalDrop: { en: 'Abnormal drop', zh_CN: '异常下降', zh_TW: '異常下降' },
  templateAbnormalDropDesc: {
    en: 'Clear drop in search interest',
    zh_CN: '搜索热度明显下降',
    zh_TW: '搜尋熱度明顯下降',
  },
  templateVolatility: { en: 'High volatility', zh_CN: '剧烈波动', zh_TW: '劇烈波動' },
  templateVolatilityDesc: {
    en: 'Volatility well above usual levels',
    zh_CN: '波动显著高于通常水平',
    zh_TW: '波動顯著高於通常水準',
  },
  templateCustom: { en: 'Custom rules', zh_CN: '自定义规则', zh_TW: '自訂規則' },
  templateCustomDesc: {
    en: 'Configure direction, window, magnitude, and streak days',
    zh_CN: '配置方向、周期、幅度和连续天数',
    zh_TW: '設定方向、週期、幅度和連續天數',
  },

  direction: { en: 'Direction', zh_CN: '方向', zh_TW: '方向' },
  directionUp: { en: 'Up', zh_CN: '上升', zh_TW: '上升' },
  directionDown: { en: 'Down', zh_CN: '下降', zh_TW: '下降' },
  windowDays: { en: 'Window (days)', zh_CN: '观察周期（天）', zh_TW: '觀察週期（天）' },
  minChangePct: {
    en: 'Minimum change (%)',
    zh_CN: '最低变化幅度（%）',
    zh_TW: '最低變化幅度（%）',
  },
  streakDays: { en: 'Streak days', zh_CN: '连续天数', zh_TW: '連續天數' },

  moreOptions: {
    en: 'More options (region, sensitivity)',
    zh_CN: '更多选项（地区、灵敏度）',
    zh_TW: '更多選項（地區、靈敏度）',
  },
  baiduRegion: { en: 'Baidu Index region', zh_CN: '百度指数地区', zh_TW: '百度指數地區' },
  googleRegion: { en: 'Google Trends region', zh_CN: 'Google Trends 地区', zh_TW: 'Google Trends 地區' },
  sensitivity: { en: 'Sensitivity', zh_CN: '灵敏度', zh_TW: '靈敏度' },
  sensitivityHigh: { en: 'High', zh_CN: '高', zh_TW: '高' },
  sensitivityStandard: { en: 'Standard', zh_CN: '标准', zh_TW: '標準' },
  sensitivityLow: { en: 'Low', zh_CN: '低', zh_TW: '低' },
  advancedHint: {
    en: 'Higher sensitivity alerts earlier and may fire more often. Leave region blank for nationwide / worldwide.',
    zh_CN: '灵敏度越高，提醒越早，也可能更频繁。地区不选时使用全国 / 全球。',
    zh_TW: '靈敏度越高，提醒越早，也可能更頻繁。地區不選時使用全國 / 全球。',
  },

  groupDefault: { en: 'Default', zh_CN: '默认', zh_TW: '預設' },
  groupNationwide: { en: 'Nationwide', zh_CN: '全国', zh_TW: '全國' },
  groupProvince: { en: 'Province', zh_CN: '省份', zh_TW: '省份' },
  groupCity: { en: 'City', zh_CN: '城市', zh_TW: '城市' },
  groupCountry: { en: 'Country / region', zh_CN: '国家/地区', zh_TW: '國家/地區' },
  baiduDefaultNationwide: {
    en: 'Default (nationwide)',
    zh_CN: '默认（全国）',
    zh_TW: '預設（全國）',
  },
  baiduNationwide: { en: 'Nationwide', zh_CN: '全国', zh_TW: '全國' },
  googleDefaultWorldwide: {
    en: 'Default (worldwide)',
    zh_CN: '默认（全球）',
    zh_TW: '預設（全球）',
  },
  googleWorldwide: { en: 'Worldwide', zh_CN: '全球', zh_TW: '全球' },
}

/** @type {Array<[string, Tri]>} */
const baiduProvinces = [
  ['901', { en: 'Shandong', zh_CN: '山东', zh_TW: '山東' }],
  ['902', { en: 'Guizhou', zh_CN: '贵州', zh_TW: '貴州' }],
  ['903', { en: 'Jiangxi', zh_CN: '江西', zh_TW: '江西' }],
  ['904', { en: 'Chongqing', zh_CN: '重庆', zh_TW: '重慶' }],
  ['905', { en: 'Inner Mongolia', zh_CN: '内蒙古', zh_TW: '內蒙古' }],
  ['906', { en: 'Hubei', zh_CN: '湖北', zh_TW: '湖北' }],
  ['907', { en: 'Liaoning', zh_CN: '辽宁', zh_TW: '遼寧' }],
  ['908', { en: 'Hunan', zh_CN: '湖南', zh_TW: '湖南' }],
  ['909', { en: 'Fujian', zh_CN: '福建', zh_TW: '福建' }],
  ['910', { en: 'Shanghai', zh_CN: '上海', zh_TW: '上海' }],
  ['911', { en: 'Beijing', zh_CN: '北京', zh_TW: '北京' }],
  ['912', { en: 'Guangxi', zh_CN: '广西', zh_TW: '廣西' }],
  ['913', { en: 'Guangdong', zh_CN: '广东', zh_TW: '廣東' }],
  ['914', { en: 'Sichuan', zh_CN: '四川', zh_TW: '四川' }],
  ['915', { en: 'Yunnan', zh_CN: '云南', zh_TW: '雲南' }],
  ['916', { en: 'Jiangsu', zh_CN: '江苏', zh_TW: '江蘇' }],
  ['917', { en: 'Zhejiang', zh_CN: '浙江', zh_TW: '浙江' }],
  ['918', { en: 'Qinghai', zh_CN: '青海', zh_TW: '青海' }],
  ['919', { en: 'Ningxia', zh_CN: '宁夏', zh_TW: '寧夏' }],
  ['920', { en: 'Hebei', zh_CN: '河北', zh_TW: '河北' }],
  ['921', { en: 'Heilongjiang', zh_CN: '黑龙江', zh_TW: '黑龍江' }],
  ['922', { en: 'Jilin', zh_CN: '吉林', zh_TW: '吉林' }],
  ['923', { en: 'Tianjin', zh_CN: '天津', zh_TW: '天津' }],
  ['924', { en: 'Shaanxi', zh_CN: '陕西', zh_TW: '陝西' }],
  ['925', { en: 'Gansu', zh_CN: '甘肃', zh_TW: '甘肅' }],
  ['926', { en: 'Xinjiang', zh_CN: '新疆', zh_TW: '新疆' }],
  ['927', { en: 'Henan', zh_CN: '河南', zh_TW: '河南' }],
  ['928', { en: 'Anhui', zh_CN: '安徽', zh_TW: '安徽' }],
  ['929', { en: 'Shanxi', zh_CN: '山西', zh_TW: '山西' }],
  ['930', { en: 'Hainan', zh_CN: '海南', zh_TW: '海南' }],
  ['931', { en: 'Taiwan', zh_CN: '台湾', zh_TW: '台灣' }],
  ['932', { en: 'Tibet', zh_CN: '西藏', zh_TW: '西藏' }],
  ['933', { en: 'Hong Kong', zh_CN: '香港', zh_TW: '香港' }],
  ['934', { en: 'Macao', zh_CN: '澳门', zh_TW: '澳門' }],
]

/** @type {Array<[string, Tri]>} */
const baiduCities = [
  ['95', { en: 'Guangzhou', zh_CN: '广州', zh_TW: '廣州' }],
  ['94', { en: 'Shenzhen', zh_CN: '深圳', zh_TW: '深圳' }],
  ['133', { en: 'Dongguan', zh_CN: '东莞', zh_TW: '東莞' }],
  ['196', { en: 'Foshan', zh_CN: '佛山', zh_TW: '佛山' }],
  ['200', { en: 'Zhuhai', zh_CN: '珠海', zh_TW: '珠海' }],
  ['168', { en: 'Zhengzhou', zh_CN: '郑州', zh_TW: '鄭州' }],
  ['378', { en: 'Luoyang', zh_CN: '洛阳', zh_TW: '洛陽' }],
  ['97', { en: 'Chengdu', zh_CN: '成都', zh_TW: '成都' }],
  ['98', { en: 'Mianyang', zh_CN: '绵阳', zh_TW: '綿陽' }],
  ['125', { en: 'Nanjing', zh_CN: '南京', zh_TW: '南京' }],
  ['126', { en: 'Suzhou', zh_CN: '苏州', zh_TW: '蘇州' }],
  ['127', { en: 'Wuxi', zh_CN: '无锡', zh_TW: '無錫' }],
  ['161', { en: 'Xuzhou', zh_CN: '徐州', zh_TW: '徐州' }],
  ['162', { en: 'Changzhou', zh_CN: '常州', zh_TW: '常州' }],
  ['163', { en: 'Nantong', zh_CN: '南通', zh_TW: '南通' }],
  ['28', { en: 'Wuhan', zh_CN: '武汉', zh_TW: '武漢' }],
  ['35', { en: 'Yichang', zh_CN: '宜昌', zh_TW: '宜昌' }],
  ['32', { en: 'Xiangyang', zh_CN: '襄阳', zh_TW: '襄陽' }],
  ['138', { en: 'Hangzhou', zh_CN: '杭州', zh_TW: '杭州' }],
  ['289', { en: 'Ningbo', zh_CN: '宁波', zh_TW: '寧波' }],
  ['149', { en: 'Wenzhou', zh_CN: '温州', zh_TW: '溫州' }],
  ['303', { en: 'Shaoxing', zh_CN: '绍兴', zh_TW: '紹興' }],
  ['304', { en: 'Jiaxing', zh_CN: '嘉兴', zh_TW: '嘉興' }],
  ['50', { en: 'Fuzhou', zh_CN: '福州', zh_TW: '福州' }],
  ['54', { en: 'Xiamen', zh_CN: '厦门', zh_TW: '廈門' }],
  ['55', { en: 'Quanzhou', zh_CN: '泉州', zh_TW: '泉州' }],
  ['152', { en: 'Harbin', zh_CN: '哈尔滨', zh_TW: '哈爾濱' }],
  ['153', { en: 'Daqing', zh_CN: '大庆', zh_TW: '大慶' }],
  ['1', { en: 'Jinan', zh_CN: '济南', zh_TW: '濟南' }],
  ['77', { en: 'Qingdao', zh_CN: '青岛', zh_TW: '青島' }],
  ['78', { en: 'Yantai', zh_CN: '烟台', zh_TW: '煙臺' }],
  ['80', { en: 'Weifang', zh_CN: '潍坊', zh_TW: '濰坊' }],
  ['79', { en: 'Linyi', zh_CN: '临沂', zh_TW: '臨沂' }],
  ['165', { en: 'Xi’an', zh_CN: '西安', zh_TW: '西安' }],
  ['277', { en: 'Xianyang', zh_CN: '咸阳', zh_TW: '咸陽' }],
  ['141', { en: 'Shijiazhuang', zh_CN: '石家庄', zh_TW: '石家莊' }],
  ['261', { en: 'Tangshan', zh_CN: '唐山', zh_TW: '唐山' }],
  ['259', { en: 'Baoding', zh_CN: '保定', zh_TW: '保定' }],
  ['150', { en: 'Shenyang', zh_CN: '沈阳', zh_TW: '瀋陽' }],
  ['29', { en: 'Dalian', zh_CN: '大连', zh_TW: '大連' }],
  ['154', { en: 'Changchun', zh_CN: '长春', zh_TW: '長春' }],
  ['117', { en: 'Kunming', zh_CN: '昆明', zh_TW: '昆明' }],
  ['467', { en: 'Urumqi', zh_CN: '乌鲁木齐', zh_TW: '烏魯木齊' }],
  ['90', { en: 'Nanning', zh_CN: '南宁', zh_TW: '南寧' }],
  ['91', { en: 'Guilin', zh_CN: '桂林', zh_TW: '桂林' }],
  ['231', { en: 'Taiyuan', zh_CN: '太原', zh_TW: '太原' }],
  ['43', { en: 'Changsha', zh_CN: '长沙', zh_TW: '長沙' }],
  ['46', { en: 'Zhuzhou', zh_CN: '株洲', zh_TW: '株洲' }],
  ['5', { en: 'Nanchang', zh_CN: '南昌', zh_TW: '南昌' }],
  ['10', { en: 'Ganzhou', zh_CN: '赣州', zh_TW: '贛州' }],
  ['189', { en: 'Hefei', zh_CN: '合肥', zh_TW: '合肥' }],
  ['188', { en: 'Wuhu', zh_CN: '芜湖', zh_TW: '蕪湖' }],
  ['20', { en: 'Hohhot', zh_CN: '呼和浩特', zh_TW: '呼和浩特' }],
  ['13', { en: 'Baotou', zh_CN: '包头', zh_TW: '包頭' }],
  ['166', { en: 'Lanzhou', zh_CN: '兰州', zh_TW: '蘭州' }],
  ['239', { en: 'Haikou', zh_CN: '海口', zh_TW: '海口' }],
  ['243', { en: 'Sanya', zh_CN: '三亚', zh_TW: '三亞' }],
  ['2', { en: 'Guiyang', zh_CN: '贵阳', zh_TW: '貴陽' }],
  ['59', { en: 'Zunyi', zh_CN: '遵义', zh_TW: '遵義' }],
  ['140', { en: 'Yinchuan', zh_CN: '银川', zh_TW: '銀川' }],
  ['139', { en: 'Xining', zh_CN: '西宁', zh_TW: '西寧' }],
  ['466', { en: 'Lhasa', zh_CN: '拉萨', zh_TW: '拉薩' }],
]

/** @type {Array<[string, Tri]>} */
const googleGeos = [
  ['US', { en: 'United States', zh_CN: '美国', zh_TW: '美國' }],
  ['CN', { en: 'China', zh_CN: '中国', zh_TW: '中國' }],
  ['JP', { en: 'Japan', zh_CN: '日本', zh_TW: '日本' }],
  ['KR', { en: 'South Korea', zh_CN: '韩国', zh_TW: '韓國' }],
  ['IN', { en: 'India', zh_CN: '印度', zh_TW: '印度' }],
  ['GB', { en: 'United Kingdom', zh_CN: '英国', zh_TW: '英國' }],
  ['DE', { en: 'Germany', zh_CN: '德国', zh_TW: '德國' }],
  ['FR', { en: 'France', zh_CN: '法国', zh_TW: '法國' }],
  ['IT', { en: 'Italy', zh_CN: '意大利', zh_TW: '義大利' }],
  ['ES', { en: 'Spain', zh_CN: '西班牙', zh_TW: '西班牙' }],
  ['NL', { en: 'Netherlands', zh_CN: '荷兰', zh_TW: '荷蘭' }],
  ['SE', { en: 'Sweden', zh_CN: '瑞典', zh_TW: '瑞典' }],
  ['CH', { en: 'Switzerland', zh_CN: '瑞士', zh_TW: '瑞士' }],
  ['RU', { en: 'Russia', zh_CN: '俄罗斯', zh_TW: '俄羅斯' }],
  ['CA', { en: 'Canada', zh_CN: '加拿大', zh_TW: '加拿大' }],
  ['MX', { en: 'Mexico', zh_CN: '墨西哥', zh_TW: '墨西哥' }],
  ['BR', { en: 'Brazil', zh_CN: '巴西', zh_TW: '巴西' }],
  ['AR', { en: 'Argentina', zh_CN: '阿根廷', zh_TW: '阿根廷' }],
  ['AU', { en: 'Australia', zh_CN: '澳大利亚', zh_TW: '澳洲' }],
  ['NZ', { en: 'New Zealand', zh_CN: '新西兰', zh_TW: '紐西蘭' }],
  ['SG', { en: 'Singapore', zh_CN: '新加坡', zh_TW: '新加坡' }],
  ['MY', { en: 'Malaysia', zh_CN: '马来西亚', zh_TW: '馬來西亞' }],
  ['TH', { en: 'Thailand', zh_CN: '泰国', zh_TW: '泰國' }],
  ['VN', { en: 'Vietnam', zh_CN: '越南', zh_TW: '越南' }],
  ['ID', { en: 'Indonesia', zh_CN: '印度尼西亚', zh_TW: '印尼' }],
  ['PH', { en: 'Philippines', zh_CN: '菲律宾', zh_TW: '菲律賓' }],
  ['TR', { en: 'Turkey', zh_CN: '土耳其', zh_TW: '土耳其' }],
  ['SA', { en: 'Saudi Arabia', zh_CN: '沙特阿拉伯', zh_TW: '沙烏地阿拉伯' }],
  ['AE', { en: 'United Arab Emirates', zh_CN: '阿联酋', zh_TW: '阿拉伯聯合大公國' }],
  ['IL', { en: 'Israel', zh_CN: '以色列', zh_TW: '以色列' }],
  ['EG', { en: 'Egypt', zh_CN: '埃及', zh_TW: '埃及' }],
  ['ZA', { en: 'South Africa', zh_CN: '南非', zh_TW: '南非' }],
  ['NG', { en: 'Nigeria', zh_CN: '尼日利亚', zh_TW: '奈及利亞' }],
  ['PL', { en: 'Poland', zh_CN: '波兰', zh_TW: '波蘭' }],
  ['UA', { en: 'Ukraine', zh_CN: '乌克兰', zh_TW: '烏克蘭' }],
  ['PT', { en: 'Portugal', zh_CN: '葡萄牙', zh_TW: '葡萄牙' }],
  ['GR', { en: 'Greece', zh_CN: '希腊', zh_TW: '希臘' }],
  ['NO', { en: 'Norway', zh_CN: '挪威', zh_TW: '挪威' }],
  ['DK', { en: 'Denmark', zh_CN: '丹麦', zh_TW: '丹麥' }],
  ['FI', { en: 'Finland', zh_CN: '芬兰', zh_TW: '芬蘭' }],
  ['AT', { en: 'Austria', zh_CN: '奥地利', zh_TW: '奧地利' }],
  ['BE', { en: 'Belgium', zh_CN: '比利时', zh_TW: '比利時' }],
  ['IE', { en: 'Ireland', zh_CN: '爱尔兰', zh_TW: '愛爾蘭' }],
  ['CZ', { en: 'Czechia', zh_CN: '捷克', zh_TW: '捷克' }],
  ['HK', { en: 'Hong Kong', zh_CN: '中国香港', zh_TW: '中國香港' }],
  ['TW', { en: 'Taiwan', zh_CN: '中国台湾', zh_TW: '台灣' }],
  ['MO', { en: 'Macao', zh_CN: '中国澳门', zh_TW: '中國澳門' }],
]

for (const [code, tri] of baiduProvinces) catalog[`baiduRegion${code}`] = tri
for (const [code, tri] of baiduCities) catalog[`baiduRegion${code}`] = tri
for (const [code, tri] of googleGeos) catalog[`googleRegion${code}`] = tri

function toMessages(locale) {
  /** @type {Record<string, { message: string, placeholders?: Record<string, { content: string }> }>} */
  const out = {}
  for (const [key, tri] of Object.entries(catalog)) {
    const message = tri[locale]
    const placeholders = {}
    for (const match of message.matchAll(/\$(\d+)\$/g)) {
      const n = match[1]
      placeholders[n] = { content: `$${n}` }
    }
    out[key] = Object.keys(placeholders).length
      ? { message, placeholders }
      : { message }
  }
  return out
}

for (const locale of ['en', 'zh_CN', 'zh_TW']) {
  const dir = join(root, 'public/_locales', locale)
  mkdirSync(dir, { recursive: true })
  const path = join(dir, 'messages.json')
  writeFileSync(path, `${JSON.stringify(toMessages(locale), null, 2)}\n`)
  console.log(`wrote ${path}`)
}
