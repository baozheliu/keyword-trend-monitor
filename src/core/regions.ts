/**
 * Region option lists.
 *
 * Baidu area codes follow index.baidu.com's own numeric codes (publicly
 * documented by multiple open-source clients, e.g. longxiaofei/spider-BaiduIndex).
 * Google geo codes are ISO 3166-1 alpha-2 country codes; '' = worldwide.
 * An empty area on a subscription always means "source default"
 * (Baidu: nationwide, Google: worldwide). Labels come from chrome.i18n.
 */
import { t } from '../app/i18n'

export interface RegionOption {
  code: string
  label: string
  group: string
}

/** Baidu province codes in display order. */
export const BAIDU_PROVINCE_CODES = [
  '901', '902', '903', '904', '905', '906', '907', '908', '909', '910',
  '911', '912', '913', '914', '915', '916', '917', '918', '919', '920',
  '921', '922', '923', '924', '925', '926', '927', '928', '929', '930',
  '931', '932', '933', '934',
] as const

/** Major cities (subset of Baidu's public city code table). */
export const BAIDU_CITY_CODES = [
  '95', '94', '133', '196', '200', '168', '378', '97', '98', '125',
  '126', '127', '161', '162', '163', '28', '35', '32', '138', '289',
  '149', '303', '304', '50', '54', '55', '152', '153', '1', '77',
  '78', '80', '79', '165', '277', '141', '261', '259', '150', '29',
  '154', '117', '467', '90', '91', '231', '43', '46', '5', '10',
  '189', '188', '20', '13', '166', '239', '243', '2', '59', '140',
  '139', '466',
] as const

/** Google Trends geo codes in display order. */
export const GOOGLE_GEO_CODES = [
  'US', 'CN', 'JP', 'KR', 'IN', 'GB', 'DE', 'FR', 'IT', 'ES',
  'NL', 'SE', 'CH', 'RU', 'CA', 'MX', 'BR', 'AR', 'AU', 'NZ',
  'SG', 'MY', 'TH', 'VN', 'ID', 'PH', 'TR', 'SA', 'AE', 'IL',
  'EG', 'ZA', 'NG', 'PL', 'UA', 'PT', 'GR', 'NO', 'DK', 'FI',
  'AT', 'BE', 'IE', 'CZ', 'HK', 'TW', 'MO',
] as const

export function baiduRegionOptions(): RegionOption[] {
  return [
    { code: '', label: t('baiduDefaultNationwide'), group: t('groupDefault') },
    { code: '0', label: t('baiduNationwide'), group: t('groupNationwide') },
    ...BAIDU_PROVINCE_CODES.map(code => ({
      code,
      label: t(`baiduRegion${code}`),
      group: t('groupProvince'),
    })),
    ...BAIDU_CITY_CODES.map(code => ({
      code,
      label: t(`baiduRegion${code}`),
      group: t('groupCity'),
    })),
  ]
}

export function googleRegionOptions(): RegionOption[] {
  return [
    { code: '', label: t('googleDefaultWorldwide'), group: t('groupDefault') },
    ...GOOGLE_GEO_CODES.map(code => ({
      code,
      label: t(`googleRegion${code}`),
      group: t('groupCountry'),
    })),
  ]
}

export function baiduRegionLabel(code: string): string {
  if (!code || code === '0') return t('baiduNationwide')
  const key = `baiduRegion${code}`
  const label = t(key)
  return label === key ? code : label
}

export function googleRegionLabel(code: string): string {
  if (!code) return t('googleWorldwide')
  const key = `googleRegion${code}`
  const label = t(key)
  return label === key ? code : label
}
