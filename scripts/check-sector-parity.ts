#!/usr/bin/env npx ts-node
/**
 * Sector Config Parity Check (C2)
 *
 * Verifies that TS and Python sector configs remain in sync.
 * Run this script to ensure both runtimes have identical:
 * - Sector names
 * - Decay lambdas
 * - Sector weights
 * - Scoring weights
 * - Hybrid parameters
 * - Reinforcement settings
 *
 * Usage: npx ts-node scripts/check-sector-parity.ts
 */

import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// TS configs (imported inline to avoid module resolution issues)
const TS_SECTOR_CONFIGS = {
    episodic: { decay_lambda: 0.015, weight: 1.2 },
    semantic: { decay_lambda: 0.005, weight: 1.0 },
    procedural: { decay_lambda: 0.008, weight: 1.1 },
    emotional: { decay_lambda: 0.02, weight: 1.3 },
    reflective: { decay_lambda: 0.001, weight: 0.8 },
};

const TS_SCORING_WEIGHTS = {
    similarity: 0.35,
    overlap: 0.20,
    waypoint: 0.15,
    recency: 0.10,
    tag_match: 0.20,
};

const TS_HYBRID_PARAMS = {
    tau: 3,
    beta: 2,
    eta: 0.1,
    gamma: 0.2,
    alpha_reinforce: 0.08,
    t_days: 7,
    t_max_days: 60,
    tau_hours: 1,
    epsilon: 1e-8,
};

const TS_REINFORCEMENT = {
    salience_boost: 0.1,
    waypoint_boost: 0.05,
    max_salience: 1.0,
    max_waypoint_weight: 1.0,
    prune_threshold: 0.05,
};

// Extract Python config values using regex
function parsePythonConfig(filePath: string, configName: string): Record<string, any> {
    const content = fs.readFileSync(filePath, "utf-8");
    const result: Record<string, any> = {};

    // Match dictionary pattern: "key": value
    const regex = new RegExp(`${configName}\\s*=\\s*\\{([^}]+)\\}`, "s");
    const match = content.match(regex);
    if (!match) return result;

    const dictContent = match[1];
    // Parse key-value pairs
    const kvRegex = /"([^"]+)":\s*([^,\n]+)/g;
    let kvMatch;
    while ((kvMatch = kvRegex.exec(dictContent)) !== null) {
        const key = kvMatch[1];
        let value = kvMatch[2].trim();

        // Handle nested dict for sector configs
        if (value.startsWith("{")) {
            const nestedRegex = /"decay_lambda":\s*([\d.]+).*?"weight":\s*([\d.]+)/s;
            const nestedMatch = dictContent.slice(kvMatch.index).match(nestedRegex);
            if (nestedMatch) {
                result[key] = {
                    decay_lambda: parseFloat(nestedMatch[1]),
                    weight: parseFloat(nestedMatch[2]),
                };
            }
        } else {
            // Parse numeric value
            result[key] = parseFloat(value) || value;
        }
    }

    return result;
}

function parsePythonSectorConfigs(filePath: string): Record<string, { decay_lambda: number; weight: number }> {
    const content = fs.readFileSync(filePath, "utf-8");
    const result: Record<string, { decay_lambda: number; weight: number }> = {};

    const sectorRegex = /"(\w+)":\s*\{[^}]*"decay_lambda":\s*([\d.]+)[^}]*"weight":\s*([\d.]+)/gs;
    let match;
    while ((match = sectorRegex.exec(content)) !== null) {
        result[match[1]] = {
            decay_lambda: parseFloat(match[2]),
            weight: parseFloat(match[3]),
        };
    }

    return result;
}

function parsePythonSimpleDict(filePath: string, varName: string): Record<string, number> {
    const content = fs.readFileSync(filePath, "utf-8");
    const result: Record<string, number> = {};

    const regex = new RegExp(`${varName}\\s*=\\s*\\{([^}]+)\\}`, "s");
    const match = content.match(regex);
    if (!match) return result;

    const kvRegex = /"([^"]+)":\s*([\d.e-]+)/g;
    let kvMatch;
    while ((kvMatch = kvRegex.exec(match[1])) !== null) {
        result[kvMatch[1]] = parseFloat(kvMatch[2]);
    }

    return result;
}

function compareConfigs(
    name: string,
    tsConfig: Record<string, any>,
    pyConfig: Record<string, any>,
    tolerance: number = 1e-10
): { match: boolean; errors: string[] } {
    const errors: string[] = [];

    const tsKeys = new Set(Object.keys(tsConfig));
    const pyKeys = new Set(Object.keys(pyConfig));

    // Check for missing keys
    for (const key of tsKeys) {
        if (!pyKeys.has(key)) {
            errors.push(`${name}: Key '${key}' missing in Python config`);
        }
    }
    for (const key of pyKeys) {
        if (!tsKeys.has(key)) {
            errors.push(`${name}: Key '${key}' missing in TS config`);
        }
    }

    // Compare values
    for (const key of tsKeys) {
        if (!pyKeys.has(key)) continue;

        const tsVal = tsConfig[key];
        const pyVal = pyConfig[key];

        if (typeof tsVal === "object" && typeof pyVal === "object") {
            // Nested comparison
            for (const subKey of Object.keys(tsVal)) {
                if (Math.abs(tsVal[subKey] - pyVal[subKey]) > tolerance) {
                    errors.push(
                        `${name}.${key}.${subKey}: TS=${tsVal[subKey]}, PY=${pyVal[subKey]}`
                    );
                }
            }
        } else if (typeof tsVal === "number" && typeof pyVal === "number") {
            if (Math.abs(tsVal - pyVal) > tolerance) {
                errors.push(`${name}.${key}: TS=${tsVal}, PY=${pyVal}`);
            }
        }
    }

    return { match: errors.length === 0, errors };
}

function main() {
    console.log("Sector Config Parity Check\n");
    console.log("=".repeat(50));

    const pyConstantsPath = path.join(
        __dirname,
        "../packages/openmemory-py/src/openmemory/core/constants.py"
    );
    const pyHsgPath = path.join(
        __dirname,
        "../packages/openmemory-py/src/openmemory/memory/hsg.py"
    );

    let allMatch = true;
    const allErrors: string[] = [];

    // Check sector configs
    console.log("\n[1] Checking SECTOR_CONFIGS...");
    const pySectorConfigs = parsePythonSectorConfigs(pyConstantsPath);
    const sectorResult = compareConfigs("SECTOR_CONFIGS", TS_SECTOR_CONFIGS, pySectorConfigs);
    if (sectorResult.match) {
        console.log("    PASS: All sector configs match");
    } else {
        allMatch = false;
        allErrors.push(...sectorResult.errors);
        sectorResult.errors.forEach(e => console.log(`    FAIL: ${e}`));
    }

    // Check scoring weights
    console.log("\n[2] Checking SCORING_WEIGHTS...");
    const pyScoringWeights = parsePythonSimpleDict(pyHsgPath, "SCORING_WEIGHTS");
    const scoringResult = compareConfigs("SCORING_WEIGHTS", TS_SCORING_WEIGHTS, pyScoringWeights);
    if (scoringResult.match) {
        console.log("    PASS: All scoring weights match");
    } else {
        allMatch = false;
        allErrors.push(...scoringResult.errors);
        scoringResult.errors.forEach(e => console.log(`    FAIL: ${e}`));
    }

    // Check hybrid params
    console.log("\n[3] Checking HYBRID_PARAMS...");
    const pyHybridParams = parsePythonSimpleDict(pyHsgPath, "HYBRID_PARAMS");
    const hybridResult = compareConfigs("HYBRID_PARAMS", TS_HYBRID_PARAMS, pyHybridParams);
    if (hybridResult.match) {
        console.log("    PASS: All hybrid params match");
    } else {
        allMatch = false;
        allErrors.push(...hybridResult.errors);
        hybridResult.errors.forEach(e => console.log(`    FAIL: ${e}`));
    }

    // Check reinforcement
    console.log("\n[4] Checking REINFORCEMENT...");
    const pyReinforcement = parsePythonSimpleDict(pyHsgPath, "REINFORCEMENT");
    const reinforceResult = compareConfigs("REINFORCEMENT", TS_REINFORCEMENT, pyReinforcement);
    if (reinforceResult.match) {
        console.log("    PASS: All reinforcement settings match");
    } else {
        allMatch = false;
        allErrors.push(...reinforceResult.errors);
        reinforceResult.errors.forEach(e => console.log(`    FAIL: ${e}`));
    }

    // Summary
    console.log("\n" + "=".repeat(50));
    if (allMatch) {
        console.log("\nPARITY CHECK PASSED: TS and Python configs are in sync\n");
        process.exit(0);
    } else {
        console.log("\nPARITY CHECK FAILED:");
        allErrors.forEach(e => console.log(`  - ${e}`));
        console.log("\nPlease update the configs to match.\n");
        process.exit(1);
    }
}

main();
