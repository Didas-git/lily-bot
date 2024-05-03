import { ApplicationCommandOptionType, createClient, Intents, InteractionCallbackType, InteractionType } from "lilybird";
import { handleAnimeSearchAutocomplete, handleAnimeSearchInteraction, handleAnimeSearchRelationsButton } from "./commands/anime.js";
import { handleMDNAutocomplete, handleMDNInteraction } from "./commands/mdn.js";
import { handleGithubURLInMessage } from "./commands/github.js";
import { CommandManager } from "./handler.js";

const handler = new CommandManager();

handler.addCommand({
    name: "ping",
    description: "pong"
}, async (client, interaction) => {
    const { ws, rest } = await client.ping();
    return client.rest.createInteractionResponse(interaction.id, interaction.token, {
        type: InteractionCallbackType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: { content: `🏓 WebSocket: \`${Math.round(ws)}ms\` | Rest: \`${Math.round(rest)}ms\`` }
    });
});

handler.addCommand({
    name: "mdn",
    description: "Search the MDN documentation",
    options: [
        {
            type: ApplicationCommandOptionType.STRING,
            name: "query",
            description: "Search query to pass to mdn",
            required: true,
            autocomplete: true
        },
        {
            type: ApplicationCommandOptionType.USER,
            name: "user",
            description: "Ping a user along with the response"
        }
    ]
}, async (client, interaction) => handleMDNInteraction(client, interaction));

handler.addCommand({
    name: "anime",
    description: "Search for an anime",
    options: [
        {
            type: ApplicationCommandOptionType.NUMBER,
            name: "query",
            description: "The anime to search",
            required: true,
            autocomplete: true
        }
    ]
}, async (client, interaction) => handleAnimeSearchInteraction(client, interaction));

await createClient({
    token: process.env.TOKEN,
    intents: [
        Intents.MESSAGE_CONTENT,
        Intents.GUILD_MESSAGES,
        Intents.GUILD_MEMBERS,
        Intents.GUILDS
    ],
    setup: async (client) => {
        console.log(`Logged in as: ${client.user.username} (${client.user.id})`);
        await handler.loadGlobal(client);
    },
    attachDebugListener: true,
    listeners: {
        messageCreate: async (client, payload) => {
            await handleGithubURLInMessage(client, payload);
        },
        interactionCreate: async (client, payload) => {
            if (!("guild_id" in payload)) return;

            if (payload.type === InteractionType.APPLICATION_COMMAND_AUTOCOMPLETE) {
                switch (payload.data.name) {
                    case "mdn": {
                        await handleMDNAutocomplete(client, payload);
                        break;
                    }
                    case "anime": {
                        await handleAnimeSearchAutocomplete(client, payload);
                        break;
                    }
                }

                return;
            } else if (payload.type === InteractionType.MESSAGE_COMPONENT) {
                await handleAnimeSearchRelationsButton(client, payload);
                return;
            } else if (payload.type !== InteractionType.APPLICATION_COMMAND) return;

            await handler.commands[payload.data.name](client, payload);
        }
    }
});
