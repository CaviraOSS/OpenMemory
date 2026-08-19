const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const root = path.resolve(__dirname, '..', '..')
const read = (relativePath) => fs.readFileSync(path.resolve(root, relativePath), 'utf8')

test('dashboard falls back to the server proxy without baking public API config', () => {
  const context = read('dashboard/lib/project-context.tsx')
  const proxy = read('dashboard/app/api/openmemory/[...path]/route.ts')
  const dockerfile = read('dashboard/Dockerfile')

  assert.match(context, /process\.env\.NEXT_PUBLIC_API_URL \|\| '\/api\/openmemory'/)
  assert.match(proxy, /process\.env\.OPENMEMORY_API_URL \|\| 'http:\/\/127\.0\.0\.1:7331'/)
  assert.doesNotMatch(dockerfile, /NEXT_PUBLIC_API_URL/)
  assert.doesNotMatch(dockerfile, /NEXT_PUBLIC_API_KEY/)
})
