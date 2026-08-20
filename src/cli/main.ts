import { realpathSync } from 'node:fs';
import { resolve } from 'node:path';

const canonical_path = (path: string): string => {
    try { return realpathSync.native(path); }
    catch { return resolve(path); }
};

export const is_cli_main = (module_path: string, argv_path?: string): boolean => {
    if (!argv_path) return false;
    const module = canonical_path(module_path);
    const argv = canonical_path(argv_path);
    return process.platform === 'win32' ? module.toLocaleLowerCase() === argv.toLocaleLowerCase() : module === argv;
};