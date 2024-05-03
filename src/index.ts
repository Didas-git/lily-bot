import { createClient, Intents, InteractionCallbackType, InteractionType } from "lilybird";
import { handleGithubURLInMessage } from "./github.js";
import { Handler } from "./handler.js";

const handler = new Handler();

handler.addCommand({
    name: "ping",
    description: "pong"
});

export function safeSlice<T extends string | Array<any>>(
    input: T,
    length: number
): T {
    return <T>(input.length > length ? input.slice(0, length) : input);
}
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
            if (payload.type !== InteractionType.APPLICATION_COMMAND) return;
            switch (payload.data.name) {
                case "ping": {
                    const { ws, rest } = await client.ping();
                    return client.rest.createInteractionResponse(payload.id, payload.token, {
                        type: InteractionCallbackType.CHANNEL_MESSAGE_WITH_SOURCE,
                        data: { content: `🏓 WebSocket: \`${Math.round(ws)}ms\` | Rest: \`${Math.round(rest)}ms\`` }
                    });
                }
            }

            return undefined;
        }
    }
});
