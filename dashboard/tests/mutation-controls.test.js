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
 *  file  : dashboard/tests/mutation-controls.test.js
 *  usage : verifies LongMemory mutation controls.test behavior
 */

const assert = require("node:assert/strict")
const fs = require("node:fs")
const path = require("node:path")
const test = require("node:test")

const readDashboardFile = (relativePath) =>
    fs.readFileSync(path.join(__dirname, "..", relativePath), "utf8")

test("dashboard pages do not offer immutable memory mutations", () => {
    const decayPage = readDashboardFile("app/decay/page.tsx")
    const chatPage = readDashboardFile("app/chat/page.tsx")

    assert.doesNotMatch(decayPage, /memory\/\$\{id\}/)
    assert.doesNotMatch(decayPage, /method:\s*["']PATCH["']/)
    assert.doesNotMatch(decayPage, /boostmemory|>\s*Boost\s*</)
    assert.doesNotMatch(chatPage, /memory\/reinforce|addMemoryToBag|Add to bag/)
})

test("chat setup documents memory references as read-only", () => {
    const setup = readDashboardFile("CHAT_SETUP.md")

    assert.match(setup, /Read-only Memory References/)
    assert.doesNotMatch(setup, /memory\/reinforce|Memory Reinforcement|boost memory importance/i)
})
