import { ComponentType, InteractionCallbackType, MessageFlags } from "lilybird";
import { anilist } from "anilist";

import type { IStaffEdge, Media, MediaType } from "anilist";
import type { Embed, Client, Interaction } from "lilybird";

export const FullMediaQuery = anilist.query.media()
    .withSiteUrl()
    .withType()
    .withTitles("romaji", "english", "native")
    .withDescription()
    .withStatus()
    .withFormat()
    .withGenres()
    .withStartDate()
    .withEndDate()
    .withEpisodes()
    .withDuration()
    .withVolumes()
    .withChapters()
    .withAverageScore()
    .withRankings("rank", "allTime")
    .withCoverImage("color", "extraLarge")
    .withRelations({
        edges: (edge) => edge.withRelationType().withNode((node) => node.withId().withType().withTitles("romaji"))
    })
    .withStaff({
        edges: (edge) => edge.withRole().withNode((node) => node.withName())
    });

export const MediaQuery = anilist.query.media().withTitles().withId();
export const PageQuery = anilist.query.page({ perPage: 15 }).withMedia(MediaQuery);

export function animeAndMangaEmbed(data: Media): Embed.Structure {
    return {
        color: parseInt(data.coverImage?.color?.replace("#", "") ?? "", 16),
        thumbnail: { url: data.coverImage?.extraLarge ?? "" },
        title: data.title?.romaji ?? "",
        url: data.siteUrl ?? "",
        description: data.description?.replace(/<\/?[^>]+(>|$)/g, "") ?? "(No description)",
        fields: [
            {
                name: "Status",
                value: `\`${data.status?.replaceAll("_", " ") ?? "Unknown"}\``
            },
            {
                name: "Type",
                value: `\`${data.format ?? "Unknown"}\``
            },
            {
                name: "Genres",
                value: `\`${data.genres?.join(", ") ?? "None"}\``
            },
            {
                inline: true,
                name: "Start Date",
                value: `\`${data.startDate?.year}${data.startDate?.month ? `-${data.startDate.month}` : ""}${data.startDate?.day ? `-${data.startDate.day}` : ""}\``
            },
            {
                inline: true,
                name: "End Date",
                value: `\`${data.endDate?.year ? `${data.endDate.year}-${data.endDate.month}-${data.endDate.day}` : "??"}\``
            },
            {
                name: data.type === "ANIME" ? "Episodes" : "Volumes",
                value: `\`${data.type === "ANIME" ? data.episodes?.toString() ?? "*Not Yet Known*" : data.volumes?.toString() ?? "*Not Yet Known*"}\``
            },
            {
                name: data.type === "ANIME" ? "Duration" : "Chapters",
                value: `\`${data.type === "ANIME" ? data.duration?.toString() ?? "*Not Yet Known*" : data.chapters?.toString() ?? "*Not Yet Known*"}\``
            }
        ]
    };
}

const localAnilistCache = new Map<number, Media>();

async function getAnilistData(mediaId: number, type: MediaType): Promise<Media> {
    const cached = localAnilistCache.get(mediaId);
    if (typeof cached !== "undefined") return cached;

    FullMediaQuery.arguments({
        id: mediaId,
        type: type
    });

    const data = FullMediaQuery.fetch();
    localAnilistCache.set(mediaId, <never>data);

    return data;
}

export async function handleAnimeSearchAutocomplete(client: Client, interaction: Interaction.GuildApplicationCommandInteractionStructure): Promise<void> {
    const name = interaction.data.options?.[0].value;
    if (typeof name !== "string") return;

    MediaQuery.arguments({
        search: name,
        type: "ANIME"
    });

    PageQuery.withMedia(MediaQuery);

    try {
        const data = await PageQuery.fetch();

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

export async function handleAnimeSearchInteraction(client: Client, interaction: Interaction.GuildApplicationCommandInteractionStructure): Promise<void> {
    await client.rest.createInteractionResponse(interaction.id, interaction.token, {
        type: InteractionCallbackType.DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE
    });

    const animeId = interaction.data.options?.[0].value;
    if (typeof animeId !== "number") {
        await client.rest.editOriginalInteractionResponse(client.user.id, interaction.token, {
            content: "Something went terribly wrong, try again later."
        });
        return;
    }

    try {
        const data = await getAnilistData(animeId, "ANIME");

        const embed = animeAndMangaEmbed(data);
        const creator = getCreator(data.staff?.edges ?? []);
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        if (creator !== null && creator.length > 0) embed.fields = [ { name: "Author", value: `\`${creator}\`` }, ...embed.fields!];

        await client.rest.editOriginalInteractionResponse(client.user.id, interaction.token, {
            embeds: [embed],
            components: [
                {
                    type: ComponentType.ActionRow,
                    components: [
                        {
                            type: ComponentType.StringSelect,
                            custom_id: "anime_search_relations",
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
        await client.rest.editOriginalInteractionResponse(client.user.id, interaction.token, { content: JSON.stringify(err) });
    }
}

export async function handleAnimeSearchRelationsButton(client: Client, interaction: Interaction.GuildMessageComponentInteractionStructure): Promise<void> {
    if (interaction.data.custom_id !== "anime_search_relations") return;
    if (typeof interaction.data.values === "undefined") return;

    const [id, type, authorId]: [string, MediaType, string] = <never>interaction.data.values[0].split("|");
    if (interaction.member.user?.id !== authorId) {
        await client.rest.createInteractionResponse(interaction.id, interaction.token, {
            type: InteractionCallbackType.CHANNEL_MESSAGE_WITH_SOURCE,
            data: { content: "You cannot do that", flags: MessageFlags.EPHEMERAL }
        });
        return;
    }

    try {
        const data = await getAnilistData(+id, type);

        const embed = animeAndMangaEmbed(data);
        const creator = getCreator(data.staff?.edges ?? []);
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        if (creator !== null && creator.length > 0) embed.fields = [ { name: "Author", value: `\`${creator}\`` }, ...embed.fields!];

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
                                custom_id: "anime_search_relations",
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
        await client.rest.createInteractionResponse(interaction.id, interaction.token, {
            type: InteractionCallbackType.CHANNEL_MESSAGE_WITH_SOURCE,
            data: { content: JSON.stringify(err), flags: MessageFlags.EPHEMERAL }
        });
    }
}
