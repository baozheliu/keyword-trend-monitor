export const ExtensionTarget = Object.freeze({
  chrome: 'chrome',
  edge: 'edge',
})

const DEFAULT_TARGET = ExtensionTarget.chrome

export const EXTENSION_PAGES = Object.freeze({
  popup: 'src/pages/popup/index.html',
  options: 'src/pages/options/index.html',
})

/**
 * Host permissions are limited to the two data sources. All code and
 * assets ship inside the package; nothing is loaded from a CDN and no
 * remote code is executed.
 */
export const HOST_PERMISSIONS = Object.freeze([
  'https://index.baidu.com/*',
  'https://trends.google.com/*',
])

function normalizeTarget(target = DEFAULT_TARGET) {
  return Object.values(ExtensionTarget).includes(target) ? target : DEFAULT_TARGET
}

export function defineExtensionManifest({ target = DEFAULT_TARGET } = {}) {
  normalizeTarget(target)

  return {
    manifest_version: 3,
    name: '__MSG_extName__',
    version: '1.0.0',
    description: '__MSG_extDescription__',
    default_locale: 'zh_CN',
    action: {
      default_title: '__MSG_extName__',
      default_popup: EXTENSION_PAGES.popup,
      default_icon: {
        16: 'assets/icons/icon16.png',
        32: 'assets/icons/icon32.png',
        48: 'assets/icons/icon48.png',
        128: 'assets/icons/icon128.png',
      },
    },
    icons: {
      16: 'assets/icons/icon16.png',
      32: 'assets/icons/icon32.png',
      48: 'assets/icons/icon48.png',
      128: 'assets/icons/icon128.png',
    },
    permissions: [
      'storage',
      'alarms',
      // Detects when the user logs in to Baidu so the extension can resume
      // fetching immediately; the extension never reads cookie values.
      'cookies',
    ],
    host_permissions: [...HOST_PERMISSIONS],
    background: {
      service_worker: 'src/background/index.ts',
      type: 'module',
    },
    options_page: EXTENSION_PAGES.options,
  }
}
