/* eslint-disable @typescript-eslint/naming-convention */
import { InteractionCallbackType, MessageFlags } from "lilybird";

import type { Client, Interaction } from "lilybird";

interface GoogleAPIResponse {
    kind: string;
    url: Record<string, unknown>;
    queries: Record<string, unknown>;
    context: {
        title: string
    };
    searchInformation: Record<string, unknown>;
    items: Array<GoogleAPIItem>;
}

interface GoogleAPIItem {
    kind: string;
    title: string;
    htmlTitle: string;
    link: string;
    displayLink: string;
    snippet: string;
    htmlSnippet: string;
    cacheId: string;
    formattedUrl: string;
    htmlFormattedUrl: string;
    pagemap: {
        cse_thumbnail: Array<{ src: string, width: string, height: string }>,
        xfn: Array<Record<string, unknown>>,
        BreadcrumbList: Array<Record<string, unknown>>,
        metatags: Array<Metatag>,
        cse_image: Array<{ src: string }>
    };
}

interface Metatag {
    "og:image": string;
    "theme-color": string;
    "og:type": string;
    "og:image:width": string;
    "og:image:alt": string;
    "twitter:card": string;
    "og:site_name": string;
    "og:title": string;
    "og:image:height": string;
    "og:image:type": string;
    "og:description": string;
    "twitter:creator": string;
    viewport: string;
    "og:locale": string;
    position: string;
    "og:url": string;
}

const localMDNCache = new Map<string, Metatag>();

function populateCache(items: Array<GoogleAPIItem>): void {
    for (let i = 0, { length } = items; i < length; i++) {
        const item = items[i];
        const meta = item.pagemap.metatags;

        if (localMDNCache.has(item.cacheId)) continue;

        localMDNCache.set(item.cacheId, meta[0]);
    }
}

export async function handleMDNAutocomplete(client: Client, interaction: Interaction.GuildApplicationCommandInteractionStructure): Promise<void> {
    if (typeof interaction.data.options === "undefined") return;

    let i = 0;
    while (!interaction.data.options[i].focused) i++;

    const query = interaction.data.options[i].value;
    if (typeof query !== "string") return;
    if (query.length === 0) return;

    const url = `https://www.googleapis.com/customsearch/v1?key=${process.env.SEARCH_KEY}&cx=${process.env.CX}&q=${query}&num=10`;

    const response = await fetch(url);
    if (!response.ok) return;
    const body: GoogleAPIResponse = await response.json() as never;

    populateCache(body.items);

    await client.rest.createInteractionResponse(interaction.id, interaction.token, {
        type: InteractionCallbackType.APPLICATION_COMMAND_AUTOCOMPLETE_RESULT,
        data: { choices: body.items.map((val) => ({ name: val.title, value: val.cacheId })) }
    });
}

export async function handleMDNInteraction(client: Client, interaction: Interaction.GuildApplicationCommandInteractionStructure): Promise<void> {
    const cacheId = interaction.data.options?.find((op) => op.name === "query")?.value;
    if (typeof cacheId === "undefined" || typeof cacheId !== "string") {
        await client.rest.createInteractionResponse(interaction.id, interaction.token, {
            type: InteractionCallbackType.CHANNEL_MESSAGE_WITH_SOURCE,
            data: { content: "Something went wrong", flags: MessageFlags.EPHEMERAL }
        });
        return;
    }
    const tags = localMDNCache.get(cacheId);
    if (!tags) throw new Error("Internal MDN cache logic error");

    const userId = interaction.data.options?.find((op) => op.name === "user")?.value;

    await client.rest.createInteractionResponse(interaction.id, interaction.token, {
        type: InteractionCallbackType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: {
            content: typeof userId === "string" ? `<@${userId}> learn how to fucking google` : "",
            embeds: [
                {
                    title: tags["og:title"],
                    description: tags["og:description"],
                    url: tags["og:url"],
                    image: {
                        url: tags["og:image"]
                    }
                }
            ]
        }
    });
}
