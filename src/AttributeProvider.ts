/*
 * Copyright (C) con terra GmbH
 */

/**
 * Semantical interface of the server.
 * An AttributeProvider is responsible to lookup additional attributes of an user.
 */
export interface AttributeProvider {
    /** name used as context-path post fix */
    name: string
    resolveAttributes(userInfo: UserInfo): Promise<AdditionalAttributes | undefined>
    dispose?(): void
}

export interface UserInfo {
    anonymous: boolean;
    userId: string;
    roles: string[]
}

export interface AdditionalAttributes {
    [attributename: string]: string | number | boolean | string[] | number[] | boolean[] | undefined,
    roles?: string[]
}
