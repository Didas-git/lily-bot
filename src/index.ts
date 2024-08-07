import { ActivityType, ApplicationCommandOptionType, createClient, Intents, InteractionCallbackType, InteractionType } from "lilybird";
import { handleAnimeSearchAutocomplete, handleAnimeSearchInteraction, handleAnimeSearchRelationsButton } from "./commands/anime.js";
import { handleMangaSearchAutocomplete, handleMangaSearchInteraction, handleMangaSearchRelationsButton } from "./commands/manga.js";
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

handler.addCommand(
    {
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
    },
    handleMDNInteraction,
    handleMDNAutocomplete
);

handler.addCommand(
    {
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
    },
    handleAnimeSearchInteraction,
    handleAnimeSearchAutocomplete
);

handler.addCommand(
    {
        name: "manga",
        description: "Search for an manga",
        options: [
            {
                type: ApplicationCommandOptionType.NUMBER,
                name: "query",
                description: "The manga to search",
                required: true,
                autocomplete: true
            }
        ]
    },
    handleMangaSearchInteraction,
    handleMangaSearchAutocomplete
);

await createClient({
    token: process.env.TOKEN,
    intents: [
        Intents.MESSAGE_CONTENT,
        Intents.GUILD_MESSAGES,
        Intents.GUILD_MEMBERS,
        Intents.GUILDS
    ],
    presence: {
        since: null,
        activities: [
            {
                name: "Lilybird",
                type: ActivityType.Watching
            }
        ],
        status: "idle",
        afk: false
    },
    setup: async (client) => {
        console.log(`Logged in as: ${client.user.username} (${client.user.id})`);
        await handler.loadGlobalCommands(client);
    },
    listeners: {
        messageCreate: async (client, payload) => {
            await handleGithubURLInMessage(client, payload);
        },
        interactionCreate: async (client, payload) => {
            if (!("guild_id" in payload)) return;

            if (payload.type === InteractionType.MESSAGE_COMPONENT) {
                switch (payload.data.custom_id) {
                    case "anime_search_relations": {
                        await handleAnimeSearchRelationsButton(client, payload);
                        break;
                    }
                    case "manga_search_relations": {
                        await handleMangaSearchRelationsButton(client, payload);
                        break;
                    }
                }
                return;
            } else if (payload.type === InteractionType.APPLICATION_COMMAND_AUTOCOMPLETE)
                return handler.autoComplete[payload.data.name](client, payload);
            else if (payload.type !== InteractionType.APPLICATION_COMMAND) return;

            return handler.commands[payload.data.name](client, payload);
        }
    }
});
