#!/usr/bin/env node
/*
 * Copyright (C) con terra GmbH
 */

import { JSONAttributeProvider } from "./jsonmapping/JSONAttributeProvider";
import { UserInfoServer } from "./UserInfoServer";
import { resolve } from "path";
import { LDAPAttributeProvider } from "./ldap/LDAPAttributeProvider";
import { AttributeProvider } from "./AttributeProvider";
import { exit } from "process";

const serverPort = Number(process.env.HTTP_PORT ?? "9090");
const contextPath = process.env.CONTEXT_PATH ?? "userinfo";
const accessToken = process.env.ACCESS_TOKEN ?? "";

const attributeProviders: AttributeProvider[] = [];

const jsonMappingProvider = JSONAttributeProvider.fromConfig({
    configFilePath: resolve(process.cwd(), "conf/mapping.json")
});
addProvider(attributeProviders, jsonMappingProvider, "JSONAttributeProvider");

const ldapAttributeProvider = LDAPAttributeProvider.fromConfig({
    configFilePath: resolve(process.cwd(), "conf/ldap.json"),
    externalLdapUser: process.env.LDAP_USER,
    externalLdapPassword: process.env.LDAP_PW
});
addProvider(attributeProviders, ldapAttributeProvider, "LDAPAttributeProvider");

if (!attributeProviders.length) {
    console.error("You need to enable at least one provider.")
    exit(1);
}

const userinfoServer = new UserInfoServer(serverPort, attributeProviders, contextPath, accessToken);
userinfoServer.start();

// Cleanup / stop Server on process exit
function exitHandler() {
    userinfoServer.stop();
    for (const provider of attributeProviders) {
        provider.dispose?.();
    }
}

//do something when app is closing
process.on('exit', exitHandler);
//catches uncaught exceptions
process.on('uncaughtException', (err) => console.warn("Uncaught exception detected!", err));

function addProvider(providers: AttributeProvider[], provider: AttributeProvider | undefined, providerName: string) {
    if (!provider) {
        console.info(`${providerName} disabled.`)
        return;
    }
    providers.push(provider);
}
