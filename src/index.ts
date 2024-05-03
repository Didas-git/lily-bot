import { ButtonStyle, ComponentType, createClient, Intents, InteractionCallbackType, InteractionType } from "lilybird";
import { extname, basename } from "node:path";
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

// https://github.com/xHyroM/bun-discord-bot/blob/6cfaa99d50c5f047faff978a9bc36207c05950e2/src/listeners/message_create.tsx#L13C1-L14C170
const GITHUB_LINE_URL_REGEX = /(?:https?:\/\/)?(?:www\.)?(?:github)\.com\/(?<repo>[a-zA-Z0-9-_]+\/[A-Za-z0-9_.-]+)\/blob\/(?<path>.+?)#L(?<first_line_number>\d+)[-~]?L?(?<second_line_number>\d*)/i;

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
            if (typeof payload.content === "undefined") return;

            const match = GITHUB_LINE_URL_REGEX.exec(payload.content);
            const groups = match?.groups;
            if (!groups) return;

            const { repo } = groups;
            const { path } = groups;
            let extension = extname(path).slice(1);
            const firstLineNumber = parseInt(groups.first_line_number) - 1;
            const secondLineNumber = parseInt(groups.second_line_number) || firstLineNumber + 1;

            const contentUrl = `https://raw.githubusercontent.com/${repo}/${path}`;
            const response = await fetch(contentUrl);
            if (!response.ok) return;
            const content = await response.text();
            const lines = content.split("\n");

            // limit, max 25 lines - possible flood
            if (
                secondLineNumber - firstLineNumber > 25 && lines.length > secondLineNumber
            ) {
                await client.rest.createReaction(payload.channel_id, payload.id, "❌");
                return;
            }

            let text = "";

            for (let i = 0; i < lines.length; i++) {
                if (i < firstLineNumber || i >= secondLineNumber) continue;

                const line = lines[i];
                text += `${line}\n`;
            }

            // delete the last \n
            text = text.slice(0, -1);

            if (extension === "zig") extension = "rs";

            await client.rest.createMessage(payload.channel_id, {
                content: `***${basename(path)}*** — *(L${firstLineNumber + 1}${
                    secondLineNumber ? `-L${secondLineNumber}` : ""
                })*\n\`\`\`${extension}\n${safeSlice(
                    text,
                    2000 - 6 - extension.length
                )}\n\`\`\``,
                components: [
                    {
                        type: ComponentType.ActionRow,
                        components: [
                            {
                                type: ComponentType.Button,
                                style: ButtonStyle.Link,
                                url: `https://github.com/${repo}/blob/${path}#L${firstLineNumber + 1}${secondLineNumber ? `-L${secondLineNumber}` : ""}`,
                                label: repo
                            }
                        ]
                    }
                ]
            });
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
