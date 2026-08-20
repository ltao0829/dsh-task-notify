'use strict'
// Package/release metadata check for CI.
// Verifies that the published package has a scoped name and the metadata
// fields the DSH plugin loader and npm publishing rely on.
const fs = require('node:fs')

const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'))

if (!/^@[a-z0-9-]+\/[a-z0-9-]+$/.test(pkg.name)) {
  throw new Error('package name must be scoped (@scope/name), got: ' + pkg.name)
}

for (const key of ['name', 'version', 'description', 'license', 'repository', 'files']) {
  if (pkg[key] === undefined) {
    throw new Error('missing required package.json field: ' + key)
  }
}

console.log('metadata OK: ' + pkg.name + '@' + pkg.version)
