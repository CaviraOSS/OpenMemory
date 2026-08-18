/*
 *   _____                 ___  ___
 *  |  _  |                |  \/  |
 *  | | | |_ __   ___ _ __ | .  . | ___ _ __ ___   ___  _ __ _   _
 *  | | | | '_ \ / _ \ '_ \| |\/| |/ _ \ '_ ` _ \ / _ \| '__| | | |
 *  \ \_/ / |_) |  __/ | | | |  | |  __/ | | | | | (_) | |  | |_| |
 *   \___/| .__/ \___|_| |_\_|  |_/\___|_| |_| |_|\___/|_|   \__, |
 *        | |                                                 __/ |
 *        |_|                                                |___/
 *
 *  cavira oss (c) 2026  -  nullure (c) 2026
 *  ----------------------------------------------------------
 *  file  : src/connectors/transports/extractors/language.ts
 *  usage : programming, config, data, and document language detection
 */

const language_by_extension: Record<string, string> = {
    ts: 'TypeScript', tsx: 'TSX', mts: 'TypeScript', cts: 'TypeScript', js: 'JavaScript', jsx: 'JSX', mjs: 'JavaScript', cjs: 'JavaScript',
    py: 'Python', pyw: 'Python', pyi: 'Python', rb: 'Ruby', php: 'PHP', go: 'Go', rs: 'Rust', java: 'Java', kt: 'Kotlin', kts: 'Kotlin',
    c: 'C', h: 'C', cc: 'C++', cpp: 'C++', cxx: 'C++', hpp: 'C++', cs: 'C#', fs: 'F#', fsx: 'F#', swift: 'Swift', scala: 'Scala',
    sh: 'Shell', bash: 'Shell', zsh: 'Shell', fish: 'Fish', ps1: 'PowerShell', bat: 'Batch', cmd: 'Batch', sql: 'SQL', gql: 'GraphQL', graphql: 'GraphQL',
    html: 'HTML', htm: 'HTML', css: 'CSS', scss: 'SCSS', sass: 'Sass', less: 'Less', vue: 'Vue', svelte: 'Svelte', astro: 'Astro',
    json: 'JSON', jsonc: 'JSON with Comments', json5: 'JSON5', yaml: 'YAML', yml: 'YAML', toml: 'TOML', xml: 'XML', ini: 'INI', cfg: 'Configuration', conf: 'Configuration',
    md: 'Markdown', mdx: 'MDX', rst: 'reStructuredText', txt: 'Text', csv: 'CSV', tsv: 'TSV', proto: 'Protocol Buffers', thrift: 'Thrift',
    tf: 'Terraform', hcl: 'HCL', nix: 'Nix', lua: 'Lua', r: 'R', dart: 'Dart', ex: 'Elixir', exs: 'Elixir', erl: 'Erlang', hrl: 'Erlang',
    clj: 'Clojure', cljs: 'ClojureScript', groovy: 'Groovy', sol: 'Solidity', move: 'Move', zig: 'Zig', wasm: 'WebAssembly', wat: 'WebAssembly Text',
    dockerfile: 'Dockerfile', makefile: 'Makefile', cmake: 'CMake', gradle: 'Gradle', properties: 'Properties', lock: 'Lockfile', env: 'Environment',
    tex: 'TeX', bib: 'BibTeX', ipynb: 'Jupyter Notebook', feature: 'Gherkin', rego: 'Rego', cue: 'CUE', prisma: 'Prisma',
};

const filename_languages: Record<string, string> = {
    dockerfile: 'Dockerfile', makefile: 'Makefile', rakefile: 'Ruby', gemfile: 'Ruby', procfile: 'Procfile',
    'cmakelists.txt': 'CMake', 'package.json': 'JSON', 'tsconfig.json': 'JSON with Comments', 'cargo.toml': 'TOML',
    'go.mod': 'Go Module', 'go.sum': 'Go Module', 'requirements.txt': 'Python Requirements', 'pyproject.toml': 'TOML',
};

export function detect_language(path: string, content = ''): string {
    const name = path.replace(/\\/g, '/').split('/').pop()?.toLowerCase() ?? '';
    if (filename_languages[name]) return filename_languages[name];
    const extension = name.includes('.') ? name.split('.').pop()! : name;
    if (language_by_extension[extension]) return language_by_extension[extension];
    const first = content.split(/\r?\n/, 1)[0] ?? '';
    if (/^#!.*\bpython\b/.test(first)) return 'Python';
    if (/^#!.*\b(node|deno|bun)\b/.test(first)) return 'JavaScript';
    if (/^#!.*\b(bash|sh|zsh)\b/.test(first)) return 'Shell';
    if (/^\s*[<{[]/.test(content) && /[}\]>]\s*$/.test(content)) return 'Structured Data';
    return 'Unknown';
}

export const supported_languages = [...new Set([...Object.values(language_by_extension), ...Object.values(filename_languages)])].sort();