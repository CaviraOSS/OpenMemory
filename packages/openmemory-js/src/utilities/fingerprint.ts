/*
   ____                   __  __                                 
  / __ \                 |  \/  |                                
 | |  | |_ __   ___ _ __ | \  / | ___ _ __ ___   ___  _ __ _   _ 
 | |  | | '_ \ / _ \ '_ \| |\/| |/ _ \ '_ ` _ \ / _ \| '__| | | |
 | |__| | |_) |  __/ | | | |  | |  __/ | | | | | (_) | |  | |_| |
  \____/| .__/ \___|_| |_|_|  |_|\___|_| |_| |_|\___/|_|   \__, |
        | |                                                 __/ |
        |_|                                                |___/ 
  CaviraOSS @ 2026

 - filename
 - what is the file used for
*/

import crypto from "node:crypto";
import { canonical_token_set, stable_text_fallback_hash } from "./text";

const tokenHash64 = (token: string) =>
  crypto.createHash("sha256").update(token, "utf8").digest().subarray(0, 8);

export function computeSimhash(text: string): string {
  const tokens = canonical_token_set(text);
  if (!tokens.size) return stable_text_fallback_hash(text);

  const weights = new Array<number>(64).fill(0);
  for (const token of tokens) {
    const hash = tokenHash64(token);
    for (let byte = 0; byte < hash.length; byte++) {
      for (let bit = 0; bit < 8; bit++) {
        const mask = 1 << bit;
        weights[byte * 8 + bit] += hash[byte] & mask ? 1 : -1;
      }
    }
  }

  let output = "";
  for (let i = 0; i < 64; i += 4) {
    const nibble =
      (weights[i] > 0 ? 8 : 0) +
      (weights[i + 1] > 0 ? 4 : 0) +
      (weights[i + 2] > 0 ? 2 : 0) +
      (weights[i + 3] > 0 ? 1 : 0);
    output += nibble.toString(16);
  }
  return output;
}

export function hammingDistance(left: string, right: string): number {
  const max = Math.max(left.length, right.length);
  let distance = 0;
  for (let i = 0; i < max; i++) {
    const a = parseInt(left[i] || "0", 16);
    const b = parseInt(right[i] || "0", 16);
    const xor = a ^ b;
    distance +=
      (xor & 8 ? 1 : 0) +
      (xor & 4 ? 1 : 0) +
      (xor & 2 ? 1 : 0) +
      (xor & 1 ? 1 : 0);
  }
  return distance;
}
