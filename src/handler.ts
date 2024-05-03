import { ApplicationCommandOptionType, type ApplicationCommand, type Client } from "lilybird";

type ApplicationCommandJSONParams = ApplicationCommand.Create.ApplicationCommandJSONParams;

export class Handler {
    readonly #commands = new Map<string, ApplicationCommandJSONParams>();
    readonly #cachePath: string;

    public constructor(path: string = `${import.meta.dir}/../lily-cache/commands.json`) {
        this.#cachePath = path;
    }

    public addCommand(command: ApplicationCommandJSONParams): void {
        this.#commands.set(command.name, command);
    }

    #differOption(
        incoming: ApplicationCommand.OptionStructureWithoutNarrowing,
        cached: ApplicationCommand.OptionStructureWithoutNarrowing
    ): boolean {
        if (incoming.type !== cached.type) return true;

        const differentName = incoming.name !== cached.name;
        const differentDescription = incoming.description !== cached.description;
        const differentRequired = incoming.required !== cached.required;

        const base = differentName || differentDescription || differentRequired;

        switch (incoming.type) {
            case ApplicationCommandOptionType.SUB_COMMAND:
            case ApplicationCommandOptionType.SUB_COMMAND_GROUP: {
                if (incoming.options?.length !== cached.options?.length) return true;
                if (typeof incoming.options !== "undefined" && typeof cached.options !== "undefined") {
                    for (let i = 0, { length } = incoming.options; i < length; i++) {
                        const option = incoming.options[i];
                        const cachedIndex = cached.options.findIndex((op) => op.name === option.name);

                        if (!this.#differOption(option, cached.options[cachedIndex])) continue;
                        return true;
                    }
                }

                return base;
            }
            case ApplicationCommandOptionType.NUMBER:
            case ApplicationCommandOptionType.INTEGER: {
                const differentMinValue = incoming.min_value !== cached.min_value;
                const differentMaxValue = incoming.max_value !== cached.max_value;

                return base || differentMinValue || differentMaxValue;
            }
            case ApplicationCommandOptionType.STRING: {
                const differentMinLength = incoming.min_length !== cached.min_length;
                const differentMaxLength = incoming.max_length !== cached.max_length;

                return base || differentMinLength || differentMaxLength;
            }
            case ApplicationCommandOptionType.CHANNEL: {
                const differentChannelTypes = incoming.channel_types?.length !== cached.channel_types?.length;

                return base || differentChannelTypes;
            }
            case ApplicationCommandOptionType.BOOLEAN:
            case ApplicationCommandOptionType.USER:
            case ApplicationCommandOptionType.ROLE:
            case ApplicationCommandOptionType.MENTIONABLE:
            case ApplicationCommandOptionType.ATTACHMENT: {
                return base;
            }
        }
    }

    #differ(incoming: ApplicationCommandJSONParams, cached: ApplicationCommandJSONParams): boolean {
        if (incoming.options?.length !== cached.options?.length) return true;

        const differentName = incoming.name !== cached.name;
        const differentDescription = incoming.description !== cached.description;
        const differentDefaultPermissions = incoming.default_member_permissions !== cached.default_member_permissions;
        // eslint-disable-next-line @typescript-eslint/naming-convention
        const differentDMpermission = incoming.dm_permission !== cached.dm_permission;
        const differentType = incoming.type !== cached.type;
        // eslint-disable-next-line @typescript-eslint/naming-convention
        const differentNSFW = incoming.nsfw !== cached.nsfw;

        if (typeof incoming.options !== "undefined" && typeof cached.options !== "undefined") {
            for (let i = 0, { length } = incoming.options; i < length; i++) {
                const option = incoming.options[i];
                const cachedIndex = cached.options.findIndex((op) => op.name === option.name);

                if (!this.#differOption(option, cached.options[cachedIndex])) continue;
                return true;
            }
        }

        return differentType
        || differentName
        || differentDescription
        || differentNSFW
        || differentDMpermission
        || differentDefaultPermissions;
    }

    public async loadGlobal(client: Client): Promise<void> {
        const file = Bun.file(this.#cachePath);
        const commands = [...this.#commands.values()];

        if (!await file.exists()) {
            console.log("Publish all commands & creating cache");
            await Bun.write(file, JSON.stringify(commands));
            await client.rest.bulkOverwriteGlobalApplicationCommand(client.user.id, commands);
            return;
        }

        const cachedCommands = await file.json() as Array<ApplicationCommandJSONParams>;
        const toPublish: Array<ApplicationCommandJSONParams> = [];

        for (let i = 0, { length } = commands; i < length; i++) {
            const command = commands[i];
            const cachedIndex = cachedCommands.findIndex((c) => c.name === command.name);
            if (cachedIndex === -1) {
                toPublish.push(command);
                cachedCommands.push(command);
                continue;
            }

            if (!this.#differ(command, cachedCommands[cachedIndex])) continue;
            toPublish.push(command);
            cachedCommands[cachedIndex] = command;
        }

        if (toPublish.length < 1) {
            console.log("All commands were cached, nothing to update");
            return;
        }

        console.log("Publishing changed commands", toPublish);
        await Bun.write(file, JSON.stringify(cachedCommands));
        await client.rest.bulkOverwriteGlobalApplicationCommand(client.user.id, toPublish);
    }
}
