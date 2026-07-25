import assert from 'node:assert/strict'
import { ExtensionTarget, defineExtensionManifest, HOST_PERMISSIONS } from '../src/manifest.config.js'

const targets = Object.values(ExtensionTarget)

function validateLeastPrivilege(manifest, target) {
  assert.equal(manifest.manifest_version, 3, `${target}: manifest_version must be 3`)
  assert.deepEqual(
    [...manifest.permissions].sort(),
    ['alarms', 'cookies', 'storage'],
    `${target}: only storage + alarms + cookies permissions are allowed`,
  )
  assert.deepEqual(
    manifest.host_permissions,
    [...HOST_PERMISSIONS],
    `${target}: host access must stay limited to the two data sources`,
  )
  assert.ok(!manifest.content_scripts, `${target}: no content scripts`)
  assert.ok(!manifest.web_accessible_resources, `${target}: no web accessible resources`)
  assert.ok(!manifest.permissions.includes('notifications'), `${target}: system notifications are out of scope`)
}

function validateSurfaces(manifest, target) {
  assert.ok(manifest.action?.default_popup, `${target}: popup must be configured`)
  assert.ok(manifest.options_page, `${target}: options page must be configured`)
  assert.ok(manifest.background?.service_worker, `${target}: background worker must be configured`)
}

for (const target of targets) {
  const manifest = defineExtensionManifest({ target })
  validateLeastPrivilege(manifest, target)
  validateSurfaces(manifest, target)
}

console.log(`Validated extension manifests: ${targets.join(', ')}`)
