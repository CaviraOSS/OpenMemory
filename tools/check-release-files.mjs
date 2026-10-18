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
 *  file  : tools/check-release-files.mjs
 *  usage : validates package.json and the source inputs to the npm package
 */

import { existsSync, readFileSync } from 'node:fs';

const repo_root = new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const pkg = JSON.parse(readFileSync(`${repo_root}/package.json`, 'utf8'));
const errors = [];

for (const field of ['name', 'version', 'license', 'main', 'types', 'bin', 'files']) {
    if (pkg[field] === undefined || pkg[field] === null || pkg[field] === '')
        errors.push(`package.json is missing "${field}"`);
}

// "dist" is a build output and will not exist until `pnpm build` runs later in
// release:check; everything else listed in "files" must already exist in source.
for (const entry of pkg.files ?? []) {
    if (entry === 'dist') continue;
    if (!existsSync(`${repo_root}/${entry}`)) errors.push(`package.json "files" entry "${entry}" does not exist`);
}

if (pkg.license) {
    const license_text = existsSync(`${repo_root}/LICENSE`) ? readFileSync(`${repo_root}/LICENSE`, 'utf8') : '';
    const declares_apache = pkg.license.toLowerCase().includes('apache');
    const file_is_apache = /apache license/i.test(license_text);
    if (!license_text) errors.push('LICENSE file is missing');
    else if (declares_apache !== file_is_apache)
        errors.push(`package.json license "${pkg.license}" does not match LICENSE file contents`);
}

if (typeof pkg.bin === 'object' && pkg.bin !== null) {
    for (const [name, target] of Object.entries(pkg.bin)) {
        if (typeof target !== 'string' || !target.startsWith('dist/'))
            errors.push(`bin "${name}" must point into dist/ (got "${target}")`);
    }
}

if (errors.length) {
    console.error('release:files failed:');
    for (const error of errors) console.error(`  - ${error}`);
    process.exit(1);
}
console.log('release:files: package.json and release source files look correct.');
