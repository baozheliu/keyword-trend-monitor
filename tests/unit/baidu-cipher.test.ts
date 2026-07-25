import { describe, expect, it } from 'vitest'
import { webcrypto } from 'node:crypto'
import { baiduCipherText } from '../../src/data/baiduCipher'

// Provide Web Crypto + a navigator stub for the Node test environment.
if (!globalThis.crypto) {
  // @ts-expect-error assign Node's webcrypto as the global
  globalThis.crypto = webcrypto
}
Object.defineProperty(globalThis, 'navigator', {
  value: { userAgent: 'TestUA/1.0', platform: 'MacIntel' },
  configurable: true,
})

/** Reference decryptor: AES-128-CBC with the documented key/iv. */
async function decrypt(base64: string): Promise<string> {
  const key = await webcrypto.subtle.importKey(
    'raw', new TextEncoder().encode('goqwgaiiacaykuwo'), { name: 'AES-CBC' }, false, ['decrypt'],
  )
  const iv = new TextEncoder().encode('1234567887654321')
  const bytes = Uint8Array.from(atob(base64), c => c.charCodeAt(0))
  const plain = await webcrypto.subtle.decrypt({ name: 'AES-CBC', iv }, key, bytes)
  return new TextDecoder().decode(plain)
}

describe('baiduCipherText', () => {
  it('produces the <scriptTs>_<clientTs>_<base64> shape', async () => {
    const token = await baiduCipherText('新冠', { clientTs: 1_700_000_000_000 })
    const parts = token.split('_')
    expect(parts).toHaveLength(3)
    expect(parts[0]).toBe('1763957172935')
    expect(parts[1]).toBe('1700000000000')
    expect(parts[2]!.length).toBeGreaterThan(0)
  })

  it('encrypts a JSON payload that round-trips back to the request fields', async () => {
    const clientTs = 1_700_000_000_000
    const token = await baiduCipherText('比亚迪', { clientTs, userAgent: 'TestUA/1.0', platform: 'MacIntel' })
    const payload = JSON.parse(await decrypt(token.split('_')[2]!))
    expect(payload).toMatchObject({
      ua: 'TestUA/1.0',
      platform: 'MacIntel',
      clientTs,
      version: '1.0.0.5',
    })
    expect(payload.url).toContain(encodeURIComponent('比亚迪'))
  })

  it('embeds the request time so tokens differ across calls', async () => {
    const a = await baiduCipherText('a', { clientTs: 1 })
    const b = await baiduCipherText('a', { clientTs: 2 })
    expect(a).not.toBe(b)
  })
})
