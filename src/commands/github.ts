import { matchGithubURL } from "../utils/github-url-matcher.js";
import { ButtonStyle, ComponentType } from "lilybird";

import type { Client, Message } from "lilybird";

function getStartingPad(line: string): number {
    let i = 0;
    while (line[i] === " ") i++;
    return i;
}

// function calculateAvatarIndex(user: User.Structure): string {
//     if (user.discriminator === "0") return ((BigInt(user.id) >> 22n) % 6n).toString();
//     return (+user.discriminator % 5).toString();
// }

function trimDescription(text: string, limit: number): { text: string, extra: number } {
    if (text.length <= limit) return { text, extra: 0 };
    const indexToSliceAt = text.lastIndexOf("\n", limit);
    const slicedText = text.slice(0, indexToSliceAt + 1);
    const extraCharacters = text.length - slicedText.length;

    return { text: slicedText, extra: extraCharacters };
}

export async function handleGithubURLInMessage(client: Client, message: Message.GuildStructure): Promise<void> {
    if (typeof message.content === "undefined") return;

    const match = matchGithubURL(message.content);
    if (match === null) return;

    const { repository, path, firstLine, finalLine, index, lastIndex } = match;
    const extensionStart = path.lastIndexOf(".") + 1;
    let extension = path.slice(extensionStart);
    if (extension === "zig") extension = "rs";

    const firstLineNumber = parseInt(firstLine);
    const finalLineNumber = parseInt(finalLine);

    const contentUrl = `https://raw.githubusercontent.com/${repository}/${path}`;
    const response = await fetch(contentUrl);
    if (!response.ok) return;

    const content = await response.text();
    const lines = content.split("\n");
    const initialIndentation = getStartingPad(lines[firstLineNumber - 1]);

    let text = "";
    if (firstLineNumber !== finalLineNumber) {
        const length = finalLineNumber > lines.length ? lines.length : finalLineNumber + 1;
        for (let i = firstLineNumber - 1; i < length; i++) {
            const line = lines[i].slice(initialIndentation);
            text += `${line}\n`;
        }
    } else text = `${lines[firstLineNumber - 1].slice(initialIndentation)}\n`;

    const baseLength = 24 + extension.length;
    const descriptionLimit = 4096 - baseLength;
    const { text: slicedText, extra: extraCharacters } = trimDescription(text, descriptionLimit);

    const fileStart = path.lastIndexOf("/") + 1;
    const fileName = path.slice(fileStart);

    await client.rest.createMessage(message.channel_id, {
        content: `__**${fileName}**__ - Line: *${
            firstLineNumber !== finalLineNumber ? `${firstLineNumber} - ${finalLineNumber}` : firstLineNumber
        }*\n\`\`\`${extension}\n${
            extraCharacters > 0 ? `${slicedText}(more ${extraCharacters})\n` : slicedText
        }\`\`\``,
        components: [
            {
                type: ComponentType.ActionRow,
                components: [
                    {
                        type: ComponentType.Button,
                        style: ButtonStyle.Link,
                        url: `https://github.com/${repository}/blob/${path}#L${firstLineNumber === finalLineNumber ? firstLineNumber : `${firstLineNumber}-L${finalLineNumber}`}`,
                        label: repository
                    }
                ]
            }
        ]
    });

    // Delete the message if it contains only a github url
    if (index - 18 <= 0 && lastIndex === message.content.length - 1)
        await client.rest.deleteMessage(message.channel_id, message.id, "Messaged replaced by embed with code");
}
