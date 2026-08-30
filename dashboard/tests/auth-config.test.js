/*
*      __                      __  ___                               
*     / /   ____  ____  ____ _/  |/  /__  ____ ___  ____  _______  __
*    / /   / __ \/ __ \/ __ `/ /|_/ / _ \/ __ `__ \/ __ \/ ___/ / / /
*   / /___/ /_/ / / / / /_/ / /  / /  __/ / / / / / /_/ / /  / /_/ / 
*  /_____/\____/_/ /_/\__, /_/  /_/\___/_/ /_/ /_/\____/_/   \__, /  
                     /____/                                 /____/   
 *
 *  cavira oss (c) 2026  -  nullure (c) 2026
 *  ----------------------------------------------------------
 *  file  : dashboard/tests/auth-config.test.js
 *  usage : verifies LongMemory auth config.test behavior
 */

const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const root = path.resolve(__dirname, '..', '..')
const read = (relativePath) => fs.readFileSync(path.resolve(root, relativePath), 'utf8')

test('dashboard falls back to the server proxy without baking public API config', () => {
  const context = read('dashboard/lib/project-context.tsx')
  const proxy = read('dashboard/app/api/longmemory/[...path]/route.ts')
  const dockerfile = read('dashboard/Dockerfile')

  assert.match(context, /process\.env\.NEXT_PUBLIC_API_URL \|\| '\/api\/longmemory'/)
  assert.match(proxy, /process\.env\.LONGMEMORY_API_URL \|\| 'http:\/\/127\.0\.0\.1:7331'/)
  assert.doesNotMatch(dockerfile, /NEXT_PUBLIC_API_URL/)
  assert.doesNotMatch(dockerfile, /NEXT_PUBLIC_API_KEY/)
})
