const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')

const read = (path) => fs.readFileSync(path, 'utf8')

test('dashboard proxy defaults to the backend port and compose keeps the API key server-side', () => {
  const proxy = read('dashboard/app/api/openmemory/[...path]/route.ts')
  const compose = read('docker-compose.yml')
  const dockerfile = read('dashboard/Dockerfile')

  assert.match(proxy, /process\.env\.OPENMEMORY_API_URL \|\| 'http:\/\/127\.0\.0\.1:8080'/)
  assert.match(compose, /OPENMEMORY_API_URL=\$\{OPENMEMORY_API_URL:-http:\/\/openmemory:8080\}/)
  assert.match(compose, /OPENMEMORY_API_KEY=\$\{OM_API_KEY:-\}/)
  assert.doesNotMatch(compose, /NEXT_PUBLIC_API_KEY/)
  assert.doesNotMatch(dockerfile, /NEXT_PUBLIC_API_KEY/)
})
