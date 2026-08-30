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
 *  file  : src/core/hash/merkle.ts
 *  usage : implements the LongMemory merkle component
 */

import { sha256_hex } from './content_hash.js';

const empty = sha256_hex('merkle:empty');
const leaf_prefix = 'merkle:leaf:';
const node_prefix = 'merkle:node:';


export function hash_merkle_children(children: readonly string[]): string {
    if (children.length === 0) return empty;

    let level = children.map((c) => sha256_hex(leaf_prefix + c));

    while (level.length > 1) {
        const next: string[] = [];
        for (let i = 0; i < level.length; i += 2) {
            const left = level[i];
            
            const right = i + 1 < level.length ? level[i + 1] : left;
            next.push(sha256_hex(node_prefix + left + ':' + right));
        }
        level = next;
    }

    return level[0];
}


export function verify_merkle_parent(parent: string, children: readonly string[]): boolean {
    return hash_merkle_children(children) === parent;
}
