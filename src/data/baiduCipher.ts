/**
 * Baidu Index "Cipher-Text" anti-bot token.
 *
 * Since ~2023 index.baidu.com rejects SearchApi calls without this header
 * (status 10018 "疑似异常访问"), even for logged-in users. The token format
 * was reverse engineered by the MIT-licensed spider-BaiduIndex project
 * (github.com/longxiaofei/spider-BaiduIndex, qdata/baidu_index/common.py,
 * get_cipher_text) and is ported here to Web Crypto:
 *
 *   AES-128-CBC(key="goqwgaiiacaykuwo", iv="1234567887654321", PKCS7)
 *   over JSON {ua, url, platform, clientTs, version}, then
 *   "<acsScriptTs>_<clientTs>_<base64(ciphertext)>".
 */

const KEY_BYTES = new TextEncoder().encode('goqwgaiiacaykuwo')
const IV_BYTES = new TextEncoder().encode('1234567887654321')

/**
 * Lower timestamp constant baked into Baidu's acs-2057.js. Baidu refreshes
 * the script occasionally; if the token stops working this is the first
 * value to re-check.
 */
const ACS_SCRIPT_TS = 1763957172935

function toBase64(bytes: Uint8Array): string {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary)
}

export interface CipherTextOptions {
  /** Injectable clock (ms) for tests. */
  clientTs?: number
  /** Overrides for environments without a matching navigator. */
  userAgent?: string
  platform?: string
}

/** Builds the Cipher-Text header value for one keyword request. */
export async function baiduCipherText(keyword: string, options: CipherTextOptions = {}): Promise<string> {
  const clientTs = options.clientTs ?? Date.now()
  const nav = globalThis.navigator as Navigator | undefined
  const quoted = encodeURIComponent(keyword)

  // The payload mirrors what Baidu's own page-side script encrypts. The ua
  // must match the real User-Agent header the browser sends with the fetch.
  const payload = {
    ua: options.userAgent ?? nav?.userAgent ?? '',
    url: `https://index.baidu.com/v2/main/index.html#/trend/${quoted}?words=${quoted}`,
    platform: options.platform ?? nav?.platform ?? 'MacIntel',
    clientTs,
    version: '1.0.0.5',
  }

  const key = await crypto.subtle.importKey('raw', KEY_BYTES, { name: 'AES-CBC' }, false, ['encrypt'])
  const plaintext = new TextEncoder().encode(JSON.stringify(payload))
  // Web Crypto AES-CBC applies PKCS#7 padding, same as the reference.
  const encrypted = await crypto.subtle.encrypt({ name: 'AES-CBC', iv: IV_BYTES }, key, plaintext)
  return `${ACS_SCRIPT_TS}_${clientTs}_${toBase64(new Uint8Array(encrypted))}`
}
