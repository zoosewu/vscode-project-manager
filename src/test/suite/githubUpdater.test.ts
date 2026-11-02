/*---------------------------------------------------------------------------------------------
*  Copyright (c) Alessandro Fragnani. All rights reserved.
*  Licensed under the GPLv3 License. See License.md in the project root for license information.
*--------------------------------------------------------------------------------------------*/

import * as assert from "assert";
import { isUpdateCheckDue } from "../../updater/githubUpdater";

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

// Auto-update hits the GitHub API, so it must run at most once a week to stay
// well below the unauthenticated rate limit and avoid surprise reinstalls.
suite("GitHub Updater", () => {
    const lastChecked = Date.UTC(2026, 0, 1);

    test("checks on first run when no previous check is recorded", () => {
        assert.strictEqual(isUpdateCheckDue(0, lastChecked), true);
    });

    test("does not check again within the same week", () => {
        assert.strictEqual(isUpdateCheckDue(lastChecked, lastChecked + ONE_DAY_MS), false);
        assert.strictEqual(isUpdateCheckDue(lastChecked, lastChecked + 7 * ONE_DAY_MS - 1), false);
    });

    test("checks again once a full week has passed", () => {
        assert.strictEqual(isUpdateCheckDue(lastChecked, lastChecked + 7 * ONE_DAY_MS), true);
    });
});
