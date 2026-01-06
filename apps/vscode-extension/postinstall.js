#!/usr/bin/env node
const tryRequire = (p) => {
  try {
    return require(p);
  } catch {
    return null;
  }
};

const { detectBackend } = require('./out/detectors/openmemory');
const { writeCursorConfig } = require('./out/writers/cursor');
const { writeClaudeConfig } = require('./out/writers/claude');
const { writeWindsurfConfig } = require('./out/writers/windsurf');
const { writeCopilotConfig } = require('./out/writers/copilot');
const { writeCodexConfig } = require('./out/writers/codex');

// Optional: not all builds ship a standalone MCP config generator.
const mcpGenerator = tryRequire('./out/mcp/generator');

const DEFAULT_URL = 'http://localhost:18080';

function readApiKeyFromEnvFile() {
  const envCandidates = [
    process.env.OPENMEMORY_API_KEY,
    process.env.OM_API_KEY,
  ].filter(Boolean);
  if (envCandidates.length) return envCandidates[0];

  // Dev/monorepo installs: try to read the repo root `.env`.
  try {
    const fs = require('fs');
    const path = require('path');
    const rootEnv = path.resolve(__dirname, '..', '..', '.env');
    if (!fs.existsSync(rootEnv)) return undefined;

    const raw = fs.readFileSync(rootEnv, 'utf8');
    const m = raw.match(/^\s*OM_API_KEY\s*=\s*(.*)\s*$/m);
    if (!m) return undefined;

    const val = (m[1] || '').trim();
    if (!val || val === 'your-secret-api-key-here') return undefined;
    return val;
  } catch {
    return undefined;
  }
}

async function postInstall() {
  console.log('🧠 OpenMemory IDE Extension - Auto-Setup');
  console.log('=========================================\n');

  console.log('Checking for OpenMemory backend...');
  const isRunning = await detectBackend(DEFAULT_URL);

  if (isRunning) {
    console.log('✅ Backend detected at', DEFAULT_URL);
    console.log('\nAuto-linking AI tools...');

    try {
      const apiKey = readApiKeyFromEnvFile();

      if (mcpGenerator?.writeMCPConfig) {
        const mcpPath = await mcpGenerator.writeMCPConfig(DEFAULT_URL, apiKey);
        console.log(`  ✓ MCP config: ${mcpPath}`);
      }

      const cursorPath = await writeCursorConfig(DEFAULT_URL, apiKey);
      console.log(`  ✓ Cursor config: ${cursorPath}`);

      const claudePath = await writeClaudeConfig(DEFAULT_URL, apiKey);
      console.log(`  ✓ Claude config: ${claudePath}`);

      const windsurfPath = await writeWindsurfConfig(DEFAULT_URL, apiKey);
      console.log(`  ✓ Windsurf config: ${windsurfPath}`);

      const copilotPath = await writeCopilotConfig(DEFAULT_URL, apiKey);
      console.log(`  ✓ GitHub Copilot config: ${copilotPath}`);

      const codexPath = await writeCodexConfig(DEFAULT_URL, apiKey);
      console.log(`  ✓ Codex config: ${codexPath}`);
      console.log(
        '\n🎉 Setup complete! All AI tools can now access OpenMemory.',
      );
      console.log('\nSupported AI tools:');
      console.log('  • GitHub Copilot');
      console.log('  • Cursor');
      console.log('  • Claude');
      console.log('  • Windsurf');
      console.log('  • Codex');
      console.log('  • Any MCP-compatible AI');
      console.log('\nRestart your AI tools to activate.');
    } catch (error) {
      console.error('\n❌ Auto-link failed:', error.message);
      console.log('\nYou can manually configure later via the extension.');
    }
  } else {
    console.log('⚠️  Backend not detected at', DEFAULT_URL);
    console.log('\nTo start the backend:');
    console.log('  cd packages/openmemory-js && npm run dev');
    console.log(
      '\nAuto-link will run automatically when you activate the extension.',
    );
  }

  console.log('\n📖 For more info: https://github.com/CaviraOSS/OpenMemory');
}

postInstall().catch(console.error);
