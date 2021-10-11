/*
 * Copyright (C) con terra GmbH
 */

import http, { Server } from "http";
import { AdditionalAttributes, AttributeProvider, UserInfo } from "./AttributeProvider";

export class UserInfoServer {

    private httpServer: Server | undefined;

    constructor(
        private port: number,
        private providers: AttributeProvider[] = [],
        private contextPath = "userinfo") {
    }

    start(): void {
        this.stop();
        const server = this.createHTTPServer();
        server.listen(this.port, () => {
            console.info(`server started on port: ${this.port}`);
        });
        this.httpServer = server;
    }

    stop(): void {
        const server = this.httpServer;
        this.httpServer = undefined;
        server?.close();
    }

    private createHTTPServer() {
        const contextBasePath = `/${escapeRegExp(this.contextPath)}`;
        const allowedContextPostFix = this.providers.map(p => escapeRegExp(p.name)).join("|");
        const pathExpression = new RegExp(`^${contextBasePath}\\-(?<provider>${allowedContextPostFix})/fetch$`);

        return http.createServer(async (request, response) => {
            const match = pathExpression.exec(request.url || "");
            if (!match) {
                this.writeError(response, 404, `Endpoint not found: ${request.url}`);
                return;
            }

            if (request.method !== "POST") {
                this.writeError(response, 405, "Method not allowed. Use POST instead.");
                return;
            }

            if (!request.headers["content-type"]?.startsWith("application/json")) {
                this.writeError(response, 415, "Endpoint only consumes 'application/json'");
                return;
            }

            try {
                const userInfo = await this.parseUserInfoFromRequest(request);
                const additionalData = await this.fetchAttributes(userInfo, match.groups!["provider"]);
                this.writeReponse(response, 200, { data: additionalData ?? /* no additional info if undefined */{} });
            } catch (e) {
                this.writeError(response, 500, e.message);
            }
        });

    }

    private async fetchAttributes(userInfo: UserInfo, providerName: string): Promise<AdditionalAttributes | undefined> {
        for (const provider of this.providers) {
            if (provider.name != providerName) {
                continue;
            }
            try {
                const info = await provider.resolveAttributes(userInfo);
                if (info) {
                    return info;
                }
            } catch (e) {
                console.warn(`Unexpected error during resolving of attributes: ${e}`, e);
            }
        }
        return undefined;
    }

    private writeError(response: http.ServerResponse, code: number, msg: string) {
        this.writeReponse(response, code, { error: msg });
    }

    private writeReponse(response: http.ServerResponse, code: number, data: Record<string, any>) {
        response.writeHead(code, { "Content-Type": "application/json" });
        response.end(JSON.stringify(data));
    }

    private async parseUserInfoFromRequest(request: http.IncomingMessage): Promise<UserInfo> {
        const buffers = [];
        for await (const chunk of request) {
            buffers.push(chunk);
        }
        const body = Buffer.concat(buffers).toString();
        const bodyAsJson = JSON.parse(body);

        if (!("userId" in bodyAsJson)) {
            throw new Error("Missing 'userId' property.");
        }
        if (typeof (bodyAsJson["userId"]) !== "string") {
            throw new Error("'userId' property must be a string!");
        }
        if (!("anonymous" in bodyAsJson)) {
            throw new Error("Missing 'anonymous' property.");
        }
        if (typeof (bodyAsJson["anonymous"]) !== "boolean") {
            throw new Error("'anonymous' property must be a boolean!");
        }
        if (!("roles" in bodyAsJson)) {
            throw new Error("Missing 'roles' property.");
        }
        if (!Array.isArray(bodyAsJson["roles"])) {
            throw new Error("'roles' property must be a Array!");
        }
        return bodyAsJson;
    }
}

function escapeRegExp(value: string) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); // $& means the whole matched string
}
