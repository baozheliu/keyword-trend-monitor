/**
 * Thin typed wrapper over chrome.storage.local.
 * All keys are namespaced under `kw:`. Only subscription config, fetched
 * series, alerts and lifecycle state are stored — nothing else about the
 * user is persisted.
 */

const NAMESPACE = 'kw'

function storageArea(): chrome.storage.StorageArea {
  return chrome.storage.local
}

export function nsKey(...parts: string[]): string {
  return [NAMESPACE, ...parts].join(':')
}

export async function dbGet<T>(key: string, fallback: T): Promise<T> {
  const result = await storageArea().get(key)
  return (result[key] as T | undefined) ?? fallback
}

export async function dbSet(key: string, value: unknown): Promise<void> {
  await storageArea().set({ [key]: value })
}

export async function dbRemove(keys: string | string[]): Promise<void> {
  await storageArea().remove(keys)
}

export async function dbKeysWithPrefix(prefix: string): Promise<string[]> {
  const all = await storageArea().get(null)
  return Object.keys(all).filter(key => key.startsWith(prefix))
}
