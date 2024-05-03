import { MediaQuery, PageQuery, anilistEmbed, getAnilistData } from "../utils/anilist.js";
import { ComponentType, InteractionCallbackType, MessageFlags } from "lilybird";

import type { IStaffEdge, MediaType } from "anilist";
import type { Client, Interaction } from "lilybird";

export async function handleMangaSearchAutocomplete(client: Client, interaction: Interaction.GuildApplicationCommandInteractionStructure): Promise<void> {
    const name = interaction.data.options?.[0].value;
    if (typeof name !== "string") return;

    MediaQuery.arguments({
        search: name,
        type: "MANGA"
    });

    PageQuery.withMedia(MediaQuery);

    try {
        const data = await PageQuery.fetch();

        // Show the auto complete options on the discord UI
        await client.rest.createInteractionResponse(interaction.id, interaction.token, {
            type: InteractionCallbackType.APPLICATION_COMMAND_AUTOCOMPLETE_RESULT,
            data: {
                choices: data.media.map((e) => ({
                    name: e.title?.romaji && e.title.romaji.length > 100 ? `${e.title.romaji.substring(0, 97)}...` : e.title?.romaji ?? "",
                    value: e.id
                }))
            }
        });
    } catch (_) {
        // Show the auto complete options on the discord UI
        await client.rest.createInteractionResponse(interaction.id, interaction.token, {
            type: InteractionCallbackType.APPLICATION_COMMAND_AUTOCOMPLETE_RESULT,
            data: {
                choices: [
                    {
                        name: "Nothing Found",
                        value: 0
                    }
                ]
            }
        });
    }
}

function getCreator(edges: Array<IStaffEdge>): string | null {
    for (let i = 0, { length } = edges; i < length; i++) {
        const edge = edges[i];
        if (edge.node == null) continue;
        const { role, node: { name } } = edge;

        if (role?.includes("Creator")) return name?.full ?? "";
    }

    return null;
}

export async function handleMangaSearchInteraction(client: Client, interaction: Interaction.GuildApplicationCommandInteractionStructure): Promise<void> {
    // Defer interaction
    await client.rest.createInteractionResponse(interaction.id, interaction.token, {
        type: InteractionCallbackType.DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE
    });

    const mangaId = interaction.data.options?.[0].value;
    if (typeof mangaId !== "number") {
        // Edit message with the error message
        await client.rest.editOriginalInteractionResponse(client.user.id, interaction.token, {
            content: "Something went terribly wrong, try again later."
        });
        return;
    }

    try {
        const data = await getAnilistData(mangaId, "MANGA");

        const embed = anilistEmbed(data);
        const creator = getCreator(data.staff?.edges ?? []);
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        if (creator !== null && creator.length > 0) embed.fields = [ { name: "Author", value: `\`${creator}\`` }, ...embed.fields!];

        // Edit message with the anilist information
        await client.rest.editOriginalInteractionResponse(client.user.id, interaction.token, {
            embeds: [embed],
            components: [
                {
                    type: ComponentType.ActionRow,
                    components: [
                        {
                            type: ComponentType.StringSelect,
                            custom_id: "manga_search_relations",
                            placeholder: "View Relations",
                            options: data.relations?.edges?.map((edge) => ({
                                label: `${edge.relationType?.replaceAll("_", " ")} | ${
                                    edge.node?.title?.romaji && edge.node.title.romaji.length > 70 ? `${edge.node.title.romaji.substring(0, 67)}...` : edge.node?.title?.romaji
                                } (${edge.node?.type})`,
                                value: `${edge.node?.id}|${edge.node?.type}|${interaction.member.user?.id}`
                            }))
                        }
                    ]
                }
            ]
        });
    } catch (err) {
        // Edit message with the error information
        await client.rest.editOriginalInteractionResponse(client.user.id, interaction.token, { content: JSON.stringify(err) });
    }
}

export async function handleMangaSearchRelationsButton(client: Client, interaction: Interaction.GuildMessageComponentInteractionStructure): Promise<void> {
    if (typeof interaction.data.values === "undefined") return;

    const [id, type, authorId]: [string, MediaType, string] = <never>interaction.data.values[0].split("|");
    if (interaction.member.user?.id !== authorId) {
        // Reply with an ephemeral error
        await client.rest.createInteractionResponse(interaction.id, interaction.token, {
            type: InteractionCallbackType.CHANNEL_MESSAGE_WITH_SOURCE,
            data: { content: "You cannot do that", flags: MessageFlags.EPHEMERAL }
        });
        return;
    }

    try {
        const data = await getAnilistData(+id, type);

        const embed = anilistEmbed(data);
        const creator = getCreator(data.staff?.edges ?? []);
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        if (creator !== null && creator.length > 0) embed.fields = [ { name: "Author", value: `\`${creator}\`` }, ...embed.fields!];

        // Update the original message the component is attached to
        await client.rest.createInteractionResponse(interaction.id, interaction.token, {
            type: InteractionCallbackType.UPDATE_MESSAGE,
            data: {
                embeds: [embed],
                components: [
                    {
                        type: ComponentType.ActionRow,
                        components: [
                            {
                                type: ComponentType.StringSelect,
                                custom_id: "manga_search_relations",
                                placeholder: "View Relations",
                                options: data.relations?.edges?.map((edge) => ({
                                    label: `${edge.relationType?.replaceAll("_", " ")} | ${
                                        edge.node?.title?.romaji && edge.node.title.romaji.length > 70 ? `${edge.node.title.romaji.substring(0, 67)}...` : edge.node?.title?.romaji
                                    } (${edge.node?.type})`,
                                    value: `${edge.node?.id}|${edge.node?.type}|${interaction.member.user?.id}`
                                }))
                            }
                        ]
                    }
                ]
            }
        });
    } catch (err) {
        // Send a reply (new message) with an ephemeral error
        await client.rest.createInteractionResponse(interaction.id, interaction.token, {
            type: InteractionCallbackType.CHANNEL_MESSAGE_WITH_SOURCE,
            data: { content: JSON.stringify(err), flags: MessageFlags.EPHEMERAL }
        });
    }
}
