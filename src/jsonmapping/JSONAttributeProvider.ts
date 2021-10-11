/*
 * Copyright (C) con terra GmbH
 */
import { existsSync, readFileSync } from "fs";
import { AdditionalAttributes, AttributeProvider, UserInfo } from "../AttributeProvider";

/**
 * Root of the mapping.json file.
 */
interface MappingConfig {
    enabled: boolean,
    roles?: Mapping
    users?: Mapping
}

/**
 * Mapping from keys (role or user id) to additional user attributes.
 */
interface Mapping {
    [key: string]: AdditionalAttributes
}

/**
 * The provider reads a mapping.json file.
 * It maps user and role information to attributes.
 * If user mapping is found, this will be used.
 * If role mapping is found, the first match will, win.
 * The order of roles is not defined, so the role mapping should not be used for not clear semantically separated roles.
 */
export class JSONAttributeProvider implements AttributeProvider {
    name = "json"

    constructor(
        private userMapping: Mapping,
        private roleMapping: Mapping) { }

    /**
     * Create a new {@link JSONAttributeProvider} from a config file.
     *
     * @param opts Path to config file.
     * @returns Provider or undefined if config file was not found.
     */
    public static fromConfig(opts: { configFilePath: string }): AttributeProvider | undefined {

        const { configFilePath } = opts;

        if (!existsSync(configFilePath)) {
            console.info(`Mapping file '${configFilePath}' does not exist.`);
            return undefined;
        }

        try {
            const rawData = readFileSync(configFilePath, { encoding: "utf-8" });
            const mappingConfig = JSON.parse(rawData) as MappingConfig;
            if (!mappingConfig.enabled) {
                console.info(`Mapping via json is disabled.`);
                return undefined;
            }
            console.debug(`Mapping data read '${configFilePath}': ${JSON.stringify(mappingConfig)}`);
            return new JSONAttributeProvider(mappingConfig.users ?? {}, mappingConfig.roles ?? {});
        } catch (e) {
            console.error(`File '${configFilePath}' can not be parsed into mapping structure. ${e}`, e);
        }
    }

    async resolveAttributes(userInfo: UserInfo): Promise<AdditionalAttributes | undefined> {
        const attr = this.userMapping[userInfo.anonymous ? "$anonymous" : userInfo.userId];
        if (attr) {
            return attr;
        }
        for (const role of (userInfo.roles ?? [])) {
            const attr = this.roleMapping[role];
            if (attr) {
                return attr;
            }
        }
        return undefined;
    }

}
