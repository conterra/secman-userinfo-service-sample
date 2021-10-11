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

const userinfoServer = new UserInfoServer(serverPort, attributeProviders, contextPath);
userinfoServer.start();

//process.stdin.resume();//so the program will not close instantly

// Cleanup / stop Server on process exit
function exitHandler(options: { server: UserInfoServer, exit?: boolean, cleanup?: boolean }) {
    userinfoServer.stop();
    for (const provider of attributeProviders) {
        provider.dispose?.();
    }
    if (options.exit) process.exit();
}

//do something when app is closing
process.on('exit', exitHandler.bind(null, { server: userinfoServer }));
//catches ctrl+c event
process.on('SIGINT', exitHandler.bind(null, { server: userinfoServer, exit: true }));
// catches "kill pid" (for example: nodemon restart)
process.on('SIGUSR1', exitHandler.bind(null, { server: userinfoServer, exit: true }));
process.on('SIGUSR2', exitHandler.bind(null, { server: userinfoServer, exit: true }));
//catches uncaught exceptions
process.on('uncaughtException', exitHandler.bind(null, { server: userinfoServer, exit: true }));

function addProvider(providers: AttributeProvider[], provider: AttributeProvider | undefined, providerName: string) {
    if (!provider) {
        console.info(`${providerName} disabled.`)
        return;
    }
    providers.push(provider);
}
