/*---------------------------------------------------------------------------------------------
*  Copyright (c) Alessandro Fragnani. All rights reserved.
*  Licensed under the GPLv3 License. See License.md in the project root for license information.
*--------------------------------------------------------------------------------------------*/

import * as assert from "assert";
import { getIconDetailsFromProjectPath } from "../../utils/icons";

// The Side Bar tooltip must name a remote the same way the suggested project name does
// (e.g. "Container/my-app"), for every remote type the extension knows about.
suite("Remote project kinds", () => {

    test("attached containers are shown as Container, like dev containers", () => {
        const devContainer = getIconDetailsFromProjectPath("vscode-remote://dev-container+abc/workspaces/app");
        const attached = getIconDetailsFromProjectPath("vscode-remote://attached-container+abc/workspaces/app");

        assert.strictEqual(attached.title, "Container");
        assert.deepStrictEqual(attached, devContainer);
    });

    test("tunnels are shown as Tunnel instead of a local folder", () => {
        const details = getIconDetailsFromProjectPath("vscode-remote://tunnel+my-box/home/user/app");

        assert.strictEqual(details.title, "Tunnel");
    });

    test("unknown remote types and local folders keep the generic folder details", () => {
        assert.strictEqual(getIconDetailsFromProjectPath("vscode-remote://unknown+x/app").title, "Folder");
        assert.strictEqual(getIconDetailsFromProjectPath("/home/user/app").title, "Folder");
    });
});
