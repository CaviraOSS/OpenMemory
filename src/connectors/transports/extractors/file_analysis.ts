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
 *  file  : src/connectors/transports/extractors/file_analysis.ts
 *  usage : implements the LongMemory file analysis component
 */

import { createHash } from 'node:crypto';
import { extname } from 'node:path';
import type { file_analysis, file_role, source_symbol } from '../types.js';
import { detect_language } from './language.js';

const unique = (values: string[]) => [...new Set(values.map((value) => value.trim()).filter(Boolean))];

export function is_binary(data: Uint8Array): boolean {
    const length = Math.min(data.length, 8_192);
    if (!length) return false;
    let suspicious = 0;
    for (let index = 0; index < length; index++) {
        const value = data[index];
        if (value === 0) return true;
        if (value < 7 || (value > 13 && value < 32)) suspicious++;
    }
    return suspicious / length > 0.15;
}

function role_for(path: string, language: string, generated: boolean): file_role {
    const clean = path.replace(/\\/g, '/').toLowerCase();
    const name = clean.split('/').pop() ?? '';
    if (generated || /(^|\/)(dist|build|coverage|vendor|node_modules|target|\.next)\//.test(clean)) return generated ? 'generated' : 'vendor';
    if (/\.(test|spec|e2e)\.|(^|\/)(__tests__|tests?|specs?|cypress|playwright)\//.test(clean)) return 'test';
    if (/(^|\/)(docs?|adr|rfcs?)\/|\.(md|mdx|rst)$|^(readme|changelog|contributing|license)/.test(clean)) return 'documentation';
    if (/(^|\/)(\.github\/workflows|\.gitlab|\.circleci)\/|^(jenkinsfile|azure-pipelines)|\.(workflow\.ya?ml)$/.test(clean)) return 'workflow';
    if (/(^|\/)(migrations?|schema)\/|\bmigrat(e|ion)/.test(clean)) return 'migration';
    if (/^(dockerfile|makefile|cmakelists\.txt)|(^|\/)(scripts?|build)\/|\.(gradle|cmake)$/.test(name)) return 'build';
    if (/^(package|tsconfig|jsconfig|eslint|prettier|vite|vitest|webpack|rollup|babel|cargo|pyproject|go\.mod)|\.(json|jsonc|ya?ml|toml|ini|cfg|conf|env|properties)$/.test(name)) return 'configuration';
    if (/\.(csv|tsv|parquet|avro|sql|graphql|proto|xml)$/.test(name)) return 'data';
    if (/\.(png|jpe?g|gif|webp|svg|ico|woff2?|ttf|mp[34]|wav|pdf|zip|gz)$/.test(name)) return 'asset';
    return language === 'Unknown' ? 'unknown' : 'source';
}

function import_values(text: string, language: string): string[] {
    const values: string[] = [];
    const patterns = language.match(/TypeScript|JavaScript|TSX|JSX|Vue|Svelte|Astro/)
        ? [/\b(?:import|export)\s+(?:[^'";]+?\s+from\s+)?['"]([^'"]+)['"]/g, /\brequire\(\s*['"]([^'"]+)['"]\s*\)/g, /\bimport\(\s*['"]([^'"]+)['"]\s*\)/g]
        : language === 'Python'
            ? [/^\s*from\s+([\w.]+)\s+import\s+/gm, /^\s*import\s+([\w., ]+)/gm]
            : language === 'Go'
                ? [/^\s*import\s+(?:\w+\s+)?"([^"]+)"/gm, /^\s*"([^"]+)"/gm]
                : language === 'Rust'
                    ? [/^\s*(?:use|extern\s+crate)\s+([^;]+);/gm]
                    : language.match(/Java|Kotlin|Scala|C#|Swift/)
                        ? [/^\s*import\s+([\w.*]+)/gm, /^\s*using\s+([\w.]+)/gm]
                        : language === 'PHP'
                            ? [/^\s*(?:use|require|include)(?:_once)?\s*\(?['"]?([^;'"\s)]+)/gm]
                            : [];
    for (const pattern of patterns) for (const match of text.matchAll(pattern)) values.push(...match[1].split(',').map((item) => item.trim()));
    return unique(values);
}

function symbols_for(text: string, language: string): source_symbol[] {
    const symbols: source_symbol[] = [];
    const patterns: Array<{ kind: source_symbol['kind']; pattern: RegExp; exported?: boolean }> = [];
    if (/TypeScript|JavaScript|TSX|JSX/.test(language)) patterns.push(
        { kind: 'class', pattern: /^\s*(?:export\s+)?(?:default\s+)?class\s+([\w$]+)/gm },
        { kind: 'interface', pattern: /^\s*(?:export\s+)?interface\s+([\w$]+)/gm },
        { kind: 'type', pattern: /^\s*(?:export\s+)?type\s+([\w$]+)/gm },
        { kind: 'enum', pattern: /^\s*(?:export\s+)?(?:const\s+)?enum\s+([\w$]+)/gm },
        { kind: 'function', pattern: /^\s*(?:export\s+)?(?:default\s+)?(?:async\s+)?function\s+([\w$]+)/gm },
        { kind: 'variable', pattern: /^\s*export\s+(?:const|let|var)\s+([\w$]+)/gm, exported: true },
    );
    else if (language === 'Python') patterns.push(
        { kind: 'class', pattern: /^\s*class\s+([\w_]+)/gm },
        { kind: 'function', pattern: /^\s*(?:async\s+)?def\s+([\w_]+)/gm },
    );
    else if (language === 'Go') patterns.push(
        { kind: 'type', pattern: /^\s*type\s+([\w_]+)\s+/gm },
        { kind: 'function', pattern: /^\s*func\s+(?:\([^)]*\)\s*)?([\w_]+)\s*\(/gm },
    );
    else if (language === 'Rust') patterns.push(
        { kind: 'type', pattern: /^\s*(?:pub\s+)?(?:struct|trait|enum|type)\s+([\w_]+)/gm },
        { kind: 'function', pattern: /^\s*(?:pub(?:\([^)]*\))?\s+)?(?:async\s+)?fn\s+([\w_]+)/gm },
    );
    else if (/Java|Kotlin|Scala|C#|C\+\+|C|Swift|PHP|Ruby/.test(language)) patterns.push(
        { kind: 'class', pattern: /^\s*(?:public|private|protected|internal|open|final|abstract|sealed|static|export\s+)*\s*(?:class|interface|struct|enum|trait|protocol|module)\s+([\w_]+)/gm },
        { kind: 'function', pattern: /^\s*(?:public|private|protected|internal|static|async|virtual|override|final|export\s+)*\s*(?:fun|func|function|def|[\w<>?\[\],]+)\s+([\w_]+)\s*\(/gm },
    );
    if (/Markdown|MDX|reStructuredText/.test(language)) patterns.push({ kind: 'heading', pattern: /^#{1,6}\s+(.+)$/gm });
    for (const item of patterns) {
        for (const match of text.matchAll(item.pattern)) {
            const before = text.slice(0, match.index ?? 0);
            const signature = match[0].trim().slice(0, 300);
            symbols.push({
                name: match[1].trim(),
                kind: item.kind,
                line: before.split('\n').length,
                end_line: before.split('\n').length,
                signature,
                exported: item.exported ?? /\b(export|public|pub)\b/.test(signature),
                calls: [],
            });
        }
    }
    const lines = text.split(/\r?\n/);
    const ignored = new Set(['if', 'for', 'while', 'switch', 'catch', 'return', 'throw', 'new', 'typeof', 'await', 'function', 'super', 'this']);
    const ordered = symbols.sort((left, right) => left.line - right.line || left.name.localeCompare(right.name)).slice(0, 2_000);
    return ordered.map((symbol, index) => {
        const end_line = Math.max(symbol.line, Math.min(lines.length, (ordered[index + 1]?.line ?? lines.length + 1) - 1));
        const body = lines.slice(symbol.line - 1, end_line).join('\n');
        const calls = unique([...body.matchAll(/\b([A-Za-z_$][\w$]*)\s*\(/g)]
            .map((match) => match[1])
            .filter((name) => name !== symbol.name && !ignored.has(name)));
        return { ...symbol, end_line, calls: calls.slice(0, 500) };
    });
}

function manifest_metadata(path: string, text: string): Record<string, unknown> {
    const name = path.replace(/\\/g, '/').split('/').pop()?.toLowerCase();
    if (!name?.endsWith('.json') || text.length > 5_000_000) return {};
    try {
        const value = JSON.parse(text) as Record<string, unknown>;
        if (name === 'package.json') return {
            package_name: value.name ?? null,
            package_version: value.version ?? null,
            scripts: value.scripts ?? {},
            dependencies: value.dependencies ?? {},
            dev_dependencies: value.devDependencies ?? {},
            engines: value.engines ?? {},
        };
        return { top_level_keys: Object.keys(value).slice(0, 200) };
    } catch {
        return { invalid_json: true };
    }
}

export function analyze_file(path: string, input: Uint8Array | string): file_analysis {
    const data = typeof input === 'string' ? Buffer.from(input) : Buffer.from(input);
    const binary = is_binary(data);
    const text = binary ? '' : data.toString('utf8');
    const language = detect_language(path, text);
    const lines = text ? text.split(/\r?\n/) : [];
    const generated = /(^|\/)(dist|build|vendor|node_modules|generated)\/|@generated|code generated|do not edit/i.test(`${path}\n${text.slice(0, 2_000)}`);
    const minified = lines.length > 0 && lines.some((line) => line.length > 2_000) && lines.length < 20;
    const comment_markers = /Python|Ruby|Shell|PowerShell|YAML|R|Perl/.test(language) ? /^\s*#/ : /SQL/.test(language) ? /^\s*--/ : /^\s*(?:\/\/|\/\*|\*|<!--)/;
    const blank_lines = lines.filter((line) => !line.trim()).length;
    const comment_lines = lines.filter((line) => comment_markers.test(line)).length;
    const imports = import_values(text, language);
    const symbols = symbols_for(text, language);
    const exports = unique(symbols.filter((symbol) => symbol.exported).map((symbol) => symbol.name));
    const dependencies = unique(imports.map((item) => item.startsWith('@') ? item.split('/').slice(0, 2).join('/') : item.split('/')[0]));
    const headings = symbols.filter((symbol) => symbol.kind === 'heading').map((symbol) => symbol.name);
    return {
        language,
        extension: extname(path).toLowerCase().replace(/^\./, ''),
        role: role_for(path, language, generated),
        binary,
        generated,
        minified,
        line_count: lines.length,
        code_lines: Math.max(0, lines.length - blank_lines - comment_lines),
        comment_lines,
        blank_lines,
        byte_count: data.length,
        char_count: text.length,
        sha256: createHash('sha256').update(data).digest('hex'),
        imports,
        exports,
        dependencies,
        symbols,
        headings,
        metadata: manifest_metadata(path, text),
    };
}

export function extract_text(path: string, data: Uint8Array, mime_type: string | null = null): { text: string; analysis: file_analysis } {
    const analysis = analyze_file(path, data);
    if (analysis.binary) return { text: '', analysis };
    let text = Buffer.from(data).toString('utf8');
    if (mime_type?.includes('html') || /\.html?$/i.test(path)) {
        text = text
            .replace(/<(script|style|noscript)[^>]*>[\s\S]*?<\/\1>/gi, ' ')
            .replace(/<br\s*\/?>/gi, '\n')
            .replace(/<\/p>|<\/div>|<\/h[1-6]>/gi, '\n')
            .replace(/<[^>]+>/g, ' ')
            .replace(/&nbsp;/g, ' ')
            .replace(/&amp;/g, '&')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/[ \t]+/g, ' ')
            .replace(/\n{3,}/g, '\n\n')
            .trim();
    }
    return { text, analysis };
}