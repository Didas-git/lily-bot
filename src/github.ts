import { extname, basename } from "node:path";

import type { User } from "lilybird";
import { ButtonStyle, CDN, ComponentType, type Client, type Message } from "lilybird";

// https://github.com/xHyroM/bun-discord-bot/blob/6cfaa99d50c5f047faff978a9bc36207c05950e2/src/listeners/message_create.tsx#L13C1-L14C170
const GITHUB_LINE_URL_REGEX = /(?:https?:\/\/)?(?:www\.)?(?:github)\.com\/(?<repo>[a-zA-Z0-9-_]+\/[A-Za-z0-9_.-]+)\/blob\/(?<path>.+?)#L(?<first_line_number>\d+)[-~]?L?(?<second_line_number>\d*)/i;

function getStartingPad(line: string): number {
    let i = 0;
    while (line[i] === " ") i++;
    return i;
}

function calculateAvatarIndex(user: User.Structure): string {
    if (user.discriminator === "0") return ((BigInt(user.id) >> 22n) % 6n).toString();
    return (+user.discriminator % 5).toString();
}

export async function handleGithubURLInMessage(client: Client, message: Message.GuildStructure): Promise<void> {
    if (typeof message.content === "undefined") return;

    const match = GITHUB_LINE_URL_REGEX.exec(message.content);
    if (match === null) return;
    const { groups } = match;
    if (typeof groups === "undefined") return;

    const { repo, path } = groups;
    let extension = extname(path).slice(1);
    if (extension === "zig") extension = "rs";

    const firstLineNumber = parseInt(groups.first_line_number);
    const secondLineNumber = parseInt(groups.second_line_number) || firstLineNumber;

    const contentUrl = `https://raw.githubusercontent.com/${repo}/${path}`;
    const response = await fetch(contentUrl);
    if (!response.ok) return;

    const content = await response.text();
    const lines = content.split("\n");

    let text = "";

    const length = secondLineNumber > lines.length ? lines.length : secondLineNumber + 1;
    const initialIndentation = getStartingPad(lines[firstLineNumber - 1]);
    for (let i = firstLineNumber - 1; i < length; i++) {
        const line = lines[i].slice(initialIndentation);
        text += `${line}\n`;
    }

    const baseLength = 8 + extension.length;
    const descriptionLimit = 4096 - baseLength - 16;

    const indexToSliceAt = text.lastIndexOf("\n", descriptionLimit);
    const slicedText = text.slice(0, indexToSliceAt + 1);
    const extraCharacters = text.length - slicedText.length;

    await client.rest.createMessage(message.channel_id, {
        embeds: [
            {
                color: 0xad9ee7,
                author: {
                    name: message.author.username,
                    icon_url: message.author.avatar === null
                        ? CDN.defaultUserAvatarURL(calculateAvatarIndex(message.author))
                        : CDN.userAvatarURL(message.author.id, message.author.avatar)
                },
                title: `__**${basename(path)}**__ - Line: *${firstLineNumber !== secondLineNumber ? `${firstLineNumber} - ${secondLineNumber}` : firstLineNumber}*`,
                description: `\`\`\`${extension}\n${extraCharacters > 0 ? `${slicedText}\n(more ${extraCharacters})\n` : slicedText}\`\`\``
            }
        ],
        // In case you want to use content instead of embed remember to change the 4096 in the descriptionLimit to 1900
        // (base 2000 - 100 reserved for the path+lines at the beginning)
        // content: `__**${basename(path)}**__ - Line: *${
        //     firstLineNumber !== secondLineNumber ? `${firstLineNumber} - ${secondLineNumber}` : firstLineNumber
        // }*\n\`\`\`${extension}\n${
        //     extraCharacters > 0 ? `${slicedText}(more ${extraCharacters})\n` : slicedText
        // }\`\`\``,
        components: [
            {
                type: ComponentType.ActionRow,
                components: [
                    {
                        type: ComponentType.Button,
                        style: ButtonStyle.Link,
                        url: `https://github.com/${repo}/blob/${path}#L${firstLineNumber === secondLineNumber ? firstLineNumber : `${firstLineNumber}-L${secondLineNumber}`}`,
                        label: repo
                    }
                ]
            }
        ]
    });
}
