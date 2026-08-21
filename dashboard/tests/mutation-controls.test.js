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
