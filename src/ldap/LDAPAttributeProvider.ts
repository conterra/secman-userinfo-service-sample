/*
 * Copyright (C) con terra GmbH
 */
import { AdditionalAttributes, AttributeProvider, UserInfo } from "../AttributeProvider";
import { createClient, Client, SearchEntryObject } from "ldapjs";
import { existsSync, readFileSync } from "fs";

/**
 * Options used to create a {@link LDAPAttributeProvider}.
 */
interface LDAPAttributeProviderOptions {
    enabled: boolean,
    url: string,
    password?: string
    user?: string,
    userBaseDn: string
    userSearchPattern?: string
    roleAttribute?: string,
    userAttributes?: string[]
}
/**
 * The provider reads a mapping.json file.
 * It maps role information to attributes.
 * The first matching role, wins.
 */
export class LDAPAttributeProvider implements AttributeProvider {

    name = "ldap"

    private ldapClient: Client | undefined;
    private binded = false;
    private binding: Promise<void> | undefined;

    private bindOptions: {
        user?: string,
        password?: string
    } | undefined = undefined;
    private userSearchOptions: {
        userBaseDn: string,
        userSearchPattern: string,
        roleAttribute: string,
        attributes?: string[]
    } | undefined = undefined

    constructor(options: LDAPAttributeProviderOptions) {
        if (options.user && options.password) {
            this.bindOptions = {
                user: options.user,
                password: options.password
            }
        }
        this.userSearchOptions = {
            userBaseDn: options.userBaseDn,
            userSearchPattern: options.userSearchPattern ?? "(uid=${userid})",
            roleAttribute: options.roleAttribute ?? "memberOf",
            attributes: options.userAttributes ?? ["cn", "sn"]
        };
        const errListener = (err: any) => {
            if (err.code === "ECONNRESET") {
                console.warn(`Error is ECONNRESET, full restart the ldap client.`);
                const oldClient = this.ldapClient;
                oldClient?.off("error", errListener);
                oldClient?.destroy();
                this.ldapClient = createClient({
                    url: options.url,
                    reconnect: true
                });
                this.ldapClient.on("error", errListener);
            } else {
                console.error(`Unexpected error in ldap client.`, err);
            }
            // always reset binding state
            this.binded = false;
            this.binding = undefined;
        };
        this.ldapClient = createClient({
            url: options.url,
            reconnect: true
        });
        this.ldapClient.on("error", errListener);
    }

    /**
     * Create a new {@link LDAPAttributeProvider} from a config file.
     *
     * @param opts Path to config file. External ldap credentials.
     * @returns Provider or undefined if config file was not found or could not be parsed.
     */
    public static fromConfig(opts: {
        configFilePath: string,
        externalLdapUser?: string,
        externalLdapPassword?: string
    }): LDAPAttributeProvider | undefined {

        const { configFilePath, externalLdapUser, externalLdapPassword } = opts;

        if (!existsSync(configFilePath)) {
            console.info(`Ldap conf '${configFilePath}' not found.`)
            return undefined;
        }

        const rawData = readFileSync(configFilePath, { encoding: "utf-8" });
        const res = JSON.parse(rawData) as LDAPAttributeProviderOptions;
        if (!res.enabled) {
            console.info(`Ldap mapping is disabled.`)
            return undefined;
        }
        console.info(`Ldap conf '${configFilePath}' found: ${JSON.stringify(res)}`);
        res.user = externalLdapUser ?? res.user;
        res.password = externalLdapPassword ?? res.password;
        return new LDAPAttributeProvider(res);
    }

    dispose(): void {
        this.ldapClient?.destroy();
        this.ldapClient = undefined;
        this.binding = undefined;
        this.binded = false;
    }

    async resolveAttributes(userInfo: UserInfo): Promise<AdditionalAttributes | undefined> {
        if (userInfo.anonymous) {
            return undefined;
        }
        await this.bind();
        // do ldap lookup by user id
        return new Promise((resolve, reject) => {
            const { userBaseDn, userSearchPattern, roleAttribute, attributes } = this.userSearchOptions!;
            const filter = userSearchPattern.replace("${userid}", userInfo.userId);
            const attributesToFetch = roleAttribute ? [...(attributes ?? []), roleAttribute] : attributes;
            console.info(`Search Ldap using filter '${filter}'`);
            this.ldapClient!.search(userBaseDn, {
                filter: filter,
                scope: "sub",
                attributes: attributesToFetch
            }, (err, res) => {
                if (err) {
                    reject(err);
                    return;
                }
                const entries: AdditionalAttributes[] = [];
                let wasError = false;
                res.on('searchEntry', (entry) => {
                    if (wasError) {
                        return;
                    }
                    entries.push(this.ldapEntryToAttributeData(entry.object, roleAttribute));
                });
                res.once('error', (err) => {
                    wasError = true;
                    reject(err);
                });
                res.once('end', (result) => {
                    if (wasError) {
                        return;
                    }
                    if (!entries.length) {
                        resolve(undefined);
                        return;
                    }
                    if (entries.length > 1) {
                        reject(new Error(`Multiple matches found! For user '${userInfo.userId}'`));
                        return;
                    }
                    if (entries.length === 1) {
                        if (roleAttribute) {
                            // convert role attributes to roles
                        }
                        resolve(entries[0]);
                        return;
                    }
                    reject(new Error(`Unexpected state. Ldap status code is '${result?.status}'`));
                });
            });
        });
    }

    private ldapEntryToAttributeData(object: SearchEntryObject, roleAttributeName: string): AdditionalAttributes {
        return Object.keys(object).reduce((acc, key) => {
            if (key === "dn" || key === "controls") {
                return acc;
            }
            let value: string | string[] | boolean = object[key];
            if (key === roleAttributeName) {
                let roles;
                if (Array.isArray(value)) {
                    roles = value.map(this.convertDNRoleToSimpleRoleName);
                } else {
                    roles = [value];
                }
                acc["roles"] = roles;
                return acc;
            }
            // cleanup booleans
            if (value === 'TRUE') {
                value = true;
            }
            if (value === 'FALSE') {
                value = false;
            }
            acc[key] = value;
            return acc;
        }, {} as Record<string, any>);
    }


    private async bind(): Promise<void> {
        if (!this.bindOptions) {
            return;
        }
        if (this.binded) {
            return;
        }
        if (this.binding) {
            return this.binding;
        }
        const options = this.bindOptions;
        const binding = new Promise<void>((resolve, reject) => {
            this.ldapClient!.bind(options.user!, options.password!, (err) => {
                if (err) {
                    console.error(`Error during bind to ldap: ${err}`, err);
                    reject(err);
                    return;
                }
                resolve();
            });
        });
        this.binding = binding;
        try {
            await binding;
            if (this.binding === binding) {
                this.binded = true;
                this.binding = undefined;
            }
        } finally {
            if (this.binding === binding) {
                this.binding = undefined;
            }
        }
    }

    private convertDNRoleToSimpleRoleName(r: string): string {
        const match = /^[a-zA-Z0-9]+=([^,]+)/.exec(r);
        return (match && match[1]) || r;
    }

}
