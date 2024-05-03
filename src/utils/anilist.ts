import { anilist } from "anilist";

import type { Embed } from "lilybird";
import type { Media, MediaType } from "anilist";

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

const localAnilistCache = new Map<number, Media>();

export async function getAnilistData(mediaId: number, type: MediaType): Promise<Media> {
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

export function anilistEmbed(data: Media): Embed.Structure {
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

