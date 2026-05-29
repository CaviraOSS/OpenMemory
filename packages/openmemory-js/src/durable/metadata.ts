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

import { computeSimhash } from "../utilities/fingerprint";
import { detectTextLanguage } from "../utilities/language";
import { tokenize } from "../utilities/text";

export function enrichDurableMetadata(
  content: string,
  metadata?: Record<string, unknown>,
) {
  const detected = detectTextLanguage(content);
  return {
    ...(metadata || {}),
    language:
      typeof metadata?.language === "string"
        ? metadata.language
        : detected.language,
    language_script:
      typeof metadata?.language_script === "string"
        ? metadata.language_script
        : detected.script,
    language_confidence:
      typeof metadata?.language_confidence === "number"
        ? metadata.language_confidence
        : Number(detected.confidence.toFixed(3)),
    simhash:
      typeof metadata?.simhash === "string"
        ? metadata.simhash
        : computeSimhash(content),
    token_count:
      typeof metadata?.token_count === "number"
        ? metadata.token_count
        : tokenize(content).length,
  };
}
