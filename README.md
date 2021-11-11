# security.manager User Informations Service sample implementation

This project is a sample implementation of the User Information Service interface defined by security.manager NEXT.
Please visit the [User Information Service documentation](https://docs.conterra.de/en/securitymanager-next/latest/reference/extensions/userinfoservice.html) for further details.

The project demonstrates two different attribute lookup approaches:

   1. Mapping of roles or user IDs to additional attributes based on a `mapping.json` file
      - Implemented by [JSONAttributeProvider](./src/jsonmapping/JSONAttributeProvider.ts)
      - Default URL: <https://localhost:9090/userinfo-json/fetch>
      - Uses [`conf/mapping.json`](./resources/mapping.json) to map user IDs or roles to user attributes

   2. Connect to a LDAP in order to lookup the attributes for a given user ID
      - Implemented by [LDAPAttributeProvider](./src/ldap/LDAPAttributeProvider.ts)
      - Default URL: <https://localhost:9090/userinfo-ldap/fetch>
      - Uses [`conf/ldap.json`](./resources/ldap.json) to connect to an LDAP and fetch all user attributes

## Example requests

### JSON mapping

POST the following content to the service at `/userinfo-json/fetch` in order to test the JSON mapping:

```json
POST as "application/json":
{
    "anonymous": false,
    "userId": "whatever",
    "roles": ["a-role"]
}
```

This should return something like:

```json
{
    "data": {
        "ProjectId": [
            "a",
            "b"
        ],
        "roles": [
            "fancyExtraRole"
        ]
    }
}
```

### LDAP mapping

POST the following content to the service at `/userinfo-ldap/fetch` in order to test LDAP.

Replace the value of the property `userId` by a valid LDAP user.

```json
POST as "application/json":
{
    "anonymous": false,
    "userId": "my.user",
    "roles": []
}
```

This should return something like:

```json
{
    "data": {
        "cn": "my.user",
        "sn": "Test User",
        "roles": [
            "my-role"
        ]
    }
}
```

## Configuration

### mapping.json

The JSON mapping can be configured in [`conf/mapping.json`](./resources/mapping.json).

It is possible to configure mappings for users and roles.

Mappings are applied under these rules:

- A user ID mapping will win over roles
- The first role mapping matching a given role will be used

The structure of the file is like:

```jsonc
{
    // enable or disable the provider
    "enabled": true,

    "users": {
        // user ids mapped to attributes
        "a-user-id": {
            "ProjectId": [
                "a",
                "b"
            ],
            "roles": [
                "fancyExtraRole"
            ]
        }
    },
    "roles": {
        // role names mapped to attributes
        "a-role": {
            "ProjectId": [
                "a",
                "b"
            ],
            "roles": [
                "fancyExtraRole"
            ]
        }
    }
}
```

### ldap.json

The LDAP configuration has to be done in [`conf/ldap.json`](./resources/ldap.json).

The structure of the file is like:

```jsonc
{
    // enable/disable the provider
    "enabled": true,

    // url to the ldap
    "url": "ldap://myorg.example.com:389",

    // user name for simple bind
    "user": "",

    // password for simple bind
    "password": "",

    // base dn of user nodes
    "userBaseDn": "OU=Users,OU=myorg,DC=example,DC=com",

    // filter to find matching user nodes by userid
    "userSearchPattern": "(uid=${userid})",

    // name of the attribute identifying a role inside the user node
    "roleAttribute": "member",

    // null means lookup only ["cn", "sn"] attributes,
    // you can list the names of attributes which should be returned
    "userAttributes": null
}
```

The user and password can alternatively be provided by the environment variables `LDAP_USER` and `LDAP_PW`.

### Access token (optional)

If the environment variable `ACCESS_TOKEN` is defined during start of the service then a client needs to send the HTTP header 'Authorization' in order to access the service endpoints.

```plain
Authorization: Bearer <access-token>
```

## Build and run

Execute a build as follows:

```sh
npm install
npm run full-build
```

> Build errors like `gyp ERR! find Python` from the `node-gyp` module are expected and can be ignored.

Run the server:

```sh
cd dist
node ./index.js
```

By default, the locally started server is available at <http://localhost:9090/userinfo-json/fetch> and <http://localhost:9090/userinfo-ldap/fetch>.

## Docker

The given [Dockerfile](./Dockerfile) shows how to build a container image.

## Licensing

Copyright 2021 con terra GmbH

This is a code sample and not intended to be used in production.

Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License. You may obtain a copy of the License at

<http://www.apache.org/licenses/LICENSE-2.0>

Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.

A copy of the license is available in the repository's [LICENSE](LICENSE) file.
