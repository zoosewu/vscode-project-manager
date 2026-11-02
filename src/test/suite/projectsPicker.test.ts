/*---------------------------------------------------------------------------------------------
*  Copyright (c) Alessandro Fragnani. All rights reserved.
*  Licensed under the GPLv3 License. See License.md in the project root for license information.
*--------------------------------------------------------------------------------------------*/

import * as assert from "assert";
import * as os from "os";
import { buildPickItems } from "../../quickpick/projectsPicker";

// A project whose folder is gone must be recognizable in the list before the user picks it,
// even when it belongs to a group (the group is otherwise shown on the same line).
suite("Project picker items", () => {

    test("projects with a missing folder are flagged instead of showing their group", () => {
        const [ item ] = buildPickItems([
            { label: "Gone", description: "/this/path/does/not/exist", profile: "", group: "Work" }
        ], false);

        assert.ok(item.detail?.includes("Path does not exist"), `unexpected detail: ${item.detail}`);
    });

    test("projects with an existing folder show their group", () => {
        const [ item ] = buildPickItems([
            { label: "Home", description: os.homedir(), profile: "Dev", group: "Work" }
        ], false);

        assert.strictEqual(item.detail, "Work");
        assert.strictEqual(item.profile, "Dev");
    });

    test("remote projects are never flagged as missing", () => {
        const [ item ] = buildPickItems([
            { label: "Remote", description: "vscode-remote://ssh-remote+host/srv/app", profile: "", group: "" }
        ], false);

        assert.strictEqual(item.detail, undefined);
    });
});
