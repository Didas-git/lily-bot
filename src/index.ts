import { ApplicationCommandOptionType, createClient, Intents, InteractionCallbackType, InteractionType } from "lilybird";
import { handleGithubURLInMessage } from "./github.js";
import { CommandManager } from "./handler.js";
import { handleMDNAutocomplete, handleMDNInteraction } from "./mdn.js";

const handler = new CommandManager();

handler.addCommand({
    name: "ping",
    description: "pong"
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
});

await createClient({
    token: process.env.TOKEN,
    intents: [
        Intents.MESSAGE_CONTENT,
        Intents.GUILD_MESSAGES,
        Intents.GUILD_MEMBERS,
        Intents.GUILDS
    ],
    setup: async (client) => {
        await handler.loadGlobal(client);
        console.log(`Logged in as: ${client.user.username} (${client.user.id})`);
    },
    listeners: {
        messageCreate: async (client, payload) => {
            await handleGithubURLInMessage(client, payload);
        },
        interactionCreate: async (client, payload) => {
            if (!("guild_id" in payload)) return;

            if (payload.type === InteractionType.APPLICATION_COMMAND_AUTOCOMPLETE) {
                await handleMDNAutocomplete(client, payload);
                return;
            }

            if (payload.type !== InteractionType.APPLICATION_COMMAND) return;

            switch (payload.data.name) {
                case "ping": {
                    const { ws, rest } = await client.ping();
                    return client.rest.createInteractionResponse(payload.id, payload.token, {
                        type: InteractionCallbackType.CHANNEL_MESSAGE_WITH_SOURCE,
                        data: { content: `🏓 WebSocket: \`${Math.round(ws)}ms\` | Rest: \`${Math.round(rest)}ms\`` }
                    });
                }
                case "mdn": {
                    return handleMDNInteraction(client, payload);
                }
            }

            return undefined;
        }
    }
});
