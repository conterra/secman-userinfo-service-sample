/*
 * Copyright (C) con terra GmbH
 */
import typescript from '@rollup/plugin-typescript';
import copyPlugin from "rollup-plugin-copy";
import commonjs from "@rollup/plugin-commonjs";
import nodeResolve from "@rollup/plugin-node-resolve";
import shebang from "rollup-plugin-preserve-shebang";

const LICENSE_HEADER = `
/*
 * Copyright con terra GmbH
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 * @license
 */
`.trim();

export default {
    external: ["ldapjs"],
    input: {
        index: "src/index.ts"
    },
    output: {
        dir: "./dist/",
        format: "cjs",
        sourcemap: true,
        banner: LICENSE_HEADER
    },
    plugins: [
        copyPlugin({
            targets: [
                {
                    src: "./resources/mapping.json",
                    dest: "./dist/conf"
                },
                {
                    src: "./resources/ldap.json",
                    dest: "./dist/conf"
                },
                {
                    src: "./package.json",
                    dest: "./dist/"
                }
            ],
            verbose: true
        }),
        shebang(),
        typescript(),
        nodeResolve({
            extensions: [".js", ".ts"],
            preferBuiltins: true
        }),
        commonjs()
    ]
};
