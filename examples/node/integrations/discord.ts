
import { Client, GatewayIntentBits, Events } from 'discord.js';
import { Memory } from 'openmemory-js';

// ==================================================================================
// REAL DISCORD BOTS (discord.js v14)
// ==================================================================================
// A fully functional bot structure.
// Requires: npm install discord.js dotenv
// Usage: tsx examples/node/integrations/discord_real.ts
// ==================================================================================

const TOKEN = process.env.DISCORD_TOKEN;
const mem = new Memory();

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

client.once(Events.ClientReady, c => {
    console.log(`Ready! Logged in as ${c.user.tag}`);
});

client.on(Events.MessageCreate, async message => {
    if (message.author.bot) return;

    const userId = message.author.id;
    const guildId = message.guildId || 'dm';
    const scopedUser = `${guildId}:${userId}`;

    // 1. Store Message
    // Make async storage non-blocking so bot feels fast
    mem.add(message.content, {
        user_id: scopedUser,
        metadata: {
            channel: message.channelId,
            username: message.author.username
        },
        tags: ['discord_chat']
    }).catch(console.error);

    // 2. Respond to mentions
    if (message.mentions.users.has(client.user!.id)) {
        const query = message.content.replace(/<@!?[0-9]+>/, '').trim();

        const context = await mem.search(query, {
            user_id: scopedUser, // Search THIS user's history
            limit: 3
        });

        let reply = "I don't recall anything about that.";
        if (context.length > 0) {
            reply = `I remember you mentioned:\n> ${context[0].content}`;
        }

        await message.reply(reply);
    }
});

if (TOKEN) {
    client.login(TOKEN);
} else {
    console.log("Please set DISCORD_TOKEN env var to run this bot.");
}
