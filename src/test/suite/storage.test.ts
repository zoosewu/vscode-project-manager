/*---------------------------------------------------------------------------------------------
*  Copyright (c) Alessandro Fragnani. All rights reserved.
*  Licensed under the GPLv3 License. See License.md in the project root for license information.
*--------------------------------------------------------------------------------------------*/

import * as assert from "assert";
import * as path from "path";
import * as os from "os";
import * as vscode from "vscode";
import { Uri } from "vscode";
import { normalizeGroupPath, parseProjectInput } from "../../core/project";
import { ProjectStorage } from "../../storage/storage";
import { NO_TAGS_DEFINED } from "../../sidebar/constants";

let stubProjects: unknown[] = [];
let lastUpdateTarget: vscode.ConfigurationTarget | undefined;
const originalGetConfiguration = vscode.workspace.getConfiguration.bind(vscode.workspace);

function installProjectManagerConfigStub(): void {
    vscode.workspace.getConfiguration = ((section?: string, scope?: vscode.ConfigurationScope | null): vscode.WorkspaceConfiguration => {
        if (section === "projectManager") {
            return {
                get: <T>(key: string, defaultValue?: T): T => {
                    if (key === "projects") {
                        return stubProjects as T;
                    }
                    return originalGetConfiguration(section, scope).get(key, defaultValue);
                },
                update: async (key: string, value: unknown, target?: vscode.ConfigurationTarget) => {
                    if (key === "projects") {
                        stubProjects = value as unknown[];
                        lastUpdateTarget = target;
                    }
                },
                has: (key: string) => (key === "projects" ? true : originalGetConfiguration(section, scope).has(key)),
                inspect: originalGetConfiguration(section, scope).inspect.bind(originalGetConfiguration(section, scope))
            } as vscode.WorkspaceConfiguration;
        }
        return originalGetConfiguration(section, scope);
    }) as typeof vscode.workspace.getConfiguration;
}

suite("ProjectStorage", () => {

    suiteSetup(() => {
        installProjectManagerConfigStub();
    });

    suiteTeardown(() => {
        vscode.workspace.getConfiguration = originalGetConfiguration;
    });

    setup(() => {
        stubProjects = [];
        lastUpdateTarget = undefined;
    });

    test("push and length track added projects", () => {
        const storage = new ProjectStorage();

        assert.strictEqual(storage.length(), 0);

        storage.push("Project A", "/path/a");
        storage.push("Project B", "/path/b");

        assert.strictEqual(storage.length(), 2);
    });

    test("pop removes and returns project by name (case-insensitive)", () => {
        const storage = new ProjectStorage();

        storage.push("MyProject", "/path/project");
        storage.push("Other", "/path/other");

        const popped = storage.pop("myproject");
        assert.ok(popped);
        assert.strictEqual(popped!.name, "MyProject");
        assert.strictEqual(storage.length(), 1);

        const notFound = storage.pop("non-existent");
        assert.strictEqual(notFound, undefined);
        assert.strictEqual(storage.length(), 1);
    });

    test("rename changes project name", () => {
        const storage = new ProjectStorage();

        storage.push("OldName", "/path/old");
        storage.rename("oldname", "NewName");

        assert.strictEqual(storage.exists("OldName"), false);
        assert.strictEqual(storage.exists("NewName"), true);
    });

    test("updateRootPath and existsWithRootPath are case-insensitive", () => {
        const storage = new ProjectStorage();

        storage.push("Sample", "/path/one");
        storage.updateRootPath("sample", "/PATH/UPDATED");

        assert.ok(storage.exists("Sample"));

        const found = storage.existsWithRootPath("/path/updated");
        assert.ok(found);
        assert.strictEqual(found!.name, "Sample");
    });

    test("toggleEnabled toggles enabled flag and disabled returns list", () => {
        const storage = new ProjectStorage();

        storage.push("One", "/path/one");
        storage.push("Two", "/path/two");

        const toggled = storage.toggleEnabled("one");
        assert.strictEqual(toggled, false);

        const disabled = storage.disabled();
        assert.ok(disabled);
        assert.strictEqual(disabled!.length, 1);
        assert.strictEqual(disabled![0].name, "One");

        const toggledBack = storage.toggleEnabled("One");
        assert.strictEqual(toggledBack, true);
        assert.strictEqual(storage.disabled()!.length, 0);
    });

    test("editTags and getAvailableTags collect unique tags", () => {
        const storage = new ProjectStorage();

        storage.push("A", "/a");
        storage.push("B", "/b");
        storage.push("C", "/c");

        storage.editTags("A", [ "frontend", "react" ]);
        storage.editTags("B", [ "backend", "node" ]);
        storage.editTags("C", [ "frontend", "node" ]);

        const tags = storage.getAvailableTags().sort();
        assert.deepStrictEqual(tags, [ "backend", "frontend", "node", "react" ]);
    });

    test("getProjectsByTag returns enabled projects matching tag (including no-tag case)", () => {
        const storage = new ProjectStorage();

        storage.push("WithTag", "/with");
        storage.push("NoTag", "/notag");

        storage.editTags("WithTag", [ "tag1" ]);

        let result = storage.getProjectsByTag("tag1");
        assert.strictEqual(result.length, 1);
        assert.strictEqual(result[0].label, "WithTag");

        result = storage.getProjectsByTag("");
        assert.strictEqual(result.length, 1);
        assert.strictEqual(result[0].label, "NoTag");
    });

    test("getProjectsByTags returns enabled projects matching any tag and NO_TAGS_DEFINED behavior", () => {
        const storage = new ProjectStorage();

        storage.push("Frontend", "/fe");
        storage.push("Backend", "/be");
        storage.push("NoTags", "/nt");

        storage.editTags("Frontend", [ "frontend" ]);
        storage.editTags("Backend", [ "backend" ]);

        let result = storage.getProjectsByTags([ "frontend" ]);
        assert.strictEqual(result.length, 1);
        assert.strictEqual(result[0].label, "Frontend");

        result = storage.getProjectsByTags([ "frontend", "backend" ]);
        assert.strictEqual(result.length, 2);
        const labels = result.map(r => r.label).sort();
        assert.deepStrictEqual(labels, [ "Backend", "Frontend" ]);

        result = storage.getProjectsByTags([ NO_TAGS_DEFINED ]);
        assert.strictEqual(result.length, 1);
        assert.strictEqual(result[0].label, "NoTags");
    });

    test("map returns only enabled projects with expected shape", () => {
        const storage = new ProjectStorage();

        storage.push("EnabledProject", "/enabled");
        storage.push("DisabledProject", "/disabled");

        storage.toggleEnabled("DisabledProject");

        const mapped = storage.map();
        assert.strictEqual(mapped.length, 1);
        assert.deepStrictEqual(mapped[0], {
            label: "EnabledProject",
            description: "/enabled",
            profile: "",
            group: ""
        });
    });

    test("save and load preserve projects in v2 format", async () => {
        const storage = new ProjectStorage();

        storage.push("A", "/path/a");
        storage.push("B", "/path/b");
        storage.editTags("A", [ "x" ]);
        storage.editTags("B", [ "y" ]);

        await storage.save();

        const loadedStorage = new ProjectStorage();
        const error = loadedStorage.load();
        assert.strictEqual(error, "");
        assert.strictEqual(loadedStorage.length(), 2);
        assert.ok(loadedStorage.exists("A"));
        assert.ok(loadedStorage.exists("B"));

        const tags = loadedStorage.getAvailableTags().sort();
        assert.deepStrictEqual(tags, [ "x", "y" ]);
    });

    test("existsRemoteWithRootPath returns matching project for remote URI", () => {
        const storage = new ProjectStorage();

        const remoteRoot = "vscode-remote://ssh-remote+test/home/user/project";
        storage.push("RemoteProject", remoteRoot);

        const uri = Uri.parse(remoteRoot);
        const found = storage.existsRemoteWithRootPath(uri);

        assert.ok(found);
        assert.strictEqual(found!.name, "RemoteProject");
    });

    test("existsWithRootPath returns expandedHomePath when asked", () => {
        const storage = new ProjectStorage();

        storage.push("Regular", "/reg");
        storage.push("ExpandsTilde", "~/et");
        storage.push("ExpandsHome", "$home/eh");

        const foundTildeExpanded = storage.existsWithRootPath(path.join(os.homedir(), "et"), true);
        assert.ok(foundTildeExpanded);
        assert.strictEqual(foundTildeExpanded!.name, "ExpandsTilde");
        assert.strictEqual(foundTildeExpanded!.rootPath, path.join(os.homedir(), "et"));

        const foundTilde = storage.existsWithRootPath(path.join(os.homedir(), "et"), false);
        assert.ok(foundTilde);
        assert.strictEqual(foundTilde!.name, "ExpandsTilde");
        assert.strictEqual(foundTilde!.rootPath, "~/et");

        const foundHomeExpanded = storage.existsWithRootPath(path.join(os.homedir(), "eh"), true);
        assert.ok(foundHomeExpanded);
        assert.strictEqual(foundHomeExpanded!.name, "ExpandsHome");
        assert.strictEqual(foundHomeExpanded!.rootPath, path.join(os.homedir(), "eh"));

        const foundHome = storage.existsWithRootPath(path.join(os.homedir(), "eh"), false);
        assert.ok(foundHome);
        assert.strictEqual(foundHome!.name, "ExpandsHome");
        assert.strictEqual(foundHome!.rootPath, "$home/eh");
    });

    test("editGroup updates project group with normalization", () => {
        const storage = new ProjectStorage();
        storage.push("MyProject", "/path/project");
        storage.editGroup("myproject", "Work/Frontend");
        const project = storage.existsWithRootPath("/path/project");
        assert.ok(project);
        assert.strictEqual(project!.group, "Work/Frontend");
    });

    test("editGroup normalizes group path", () => {
        const storage = new ProjectStorage();
        storage.push("MyProject", "/path/project");
        storage.editGroup("myproject", "  /Work//Frontend/ ");
        const project = storage.existsWithRootPath("/path/project");
        assert.ok(project);
        assert.strictEqual(project!.group, "Work/Frontend");
    });

    test("load with empty globalState returns no error", () => {
        const storage = new ProjectStorage();
        const error = storage.load();
        assert.strictEqual(error, "");
        assert.strictEqual(storage.length(), 0);
    });

    test("load fills missing fields with defaults", () => {
        stubProjects = [
            { name: "Legacy", rootPath: "/legacy" }
        ];
        const storage = new ProjectStorage();
        storage.load();
        assert.strictEqual(storage.length(), 1);
        const project = storage.existsWithRootPath("/legacy");
        assert.ok(project);
        assert.deepStrictEqual(project!.tags, []);
        assert.strictEqual(project!.group, "");
        assert.strictEqual(project!.enabled, true);
    });

    test("save and load round-trip with group", async () => {
        const storage = new ProjectStorage();
        storage.push("A", "/path/a");
        storage.editGroup("A", "Work/Frontend");
        await storage.save();

        const storage2 = new ProjectStorage();
        storage2.load();
        const project = storage2.existsWithRootPath("/path/a");
        assert.ok(project);
        assert.strictEqual(project!.group, "Work/Frontend");
    });

    test("getProjects returns a copy of projects array", () => {
        const storage = new ProjectStorage();
        storage.push("A", "/a");
        const projects = storage.getProjects();
        assert.strictEqual(projects.length, 1);
        projects.pop();
        assert.strictEqual(storage.length(), 1);
    });

    test("setProjects replaces all projects", async () => {
        const storage = new ProjectStorage();
        storage.push("A", "/a");
        storage.setProjects([
            { name: "B", rootPath: "/b", paths: [], tags: [], enabled: true, profile: "", group: "" }
        ]);
        assert.strictEqual(storage.length(), 1);
        assert.ok(storage.exists("B"));
        assert.strictEqual(storage.exists("A"), false);
    });

    test("push with group parameter stores the group", () => {
        const storage = new ProjectStorage();
        storage.push("App", "/app", "Work/Frontend");

        const project = storage.existsWithRootPath("/app");
        assert.ok(project);
        assert.strictEqual(project!.group, "Work/Frontend");
    });

    test("push without group parameter defaults to empty string", () => {
        const storage = new ProjectStorage();
        storage.push("App", "/app");

        const project = storage.existsWithRootPath("/app");
        assert.ok(project);
        assert.strictEqual(project!.group, "");
    });

    test("save writes to ConfigurationTarget.Global", async () => {
        const storage = new ProjectStorage();
        storage.push("A", "/a");
        await storage.save();

        assert.strictEqual(lastUpdateTarget, vscode.ConfigurationTarget.Global);
    });

    test("load filters out entries with empty name", () => {
        stubProjects = [
            { name: "", rootPath: "/valid" },
            { name: "Good", rootPath: "/good" }
        ];
        const storage = new ProjectStorage();
        storage.load();

        assert.strictEqual(storage.length(), 1);
        assert.ok(storage.exists("Good"));
    });

    test("load filters out entries with empty rootPath", () => {
        stubProjects = [
            { name: "NoPath", rootPath: "" },
            { name: "Good", rootPath: "/good" }
        ];
        const storage = new ProjectStorage();
        storage.load();

        assert.strictEqual(storage.length(), 1);
        assert.ok(storage.exists("Good"));
    });

    test("load strips unknown keys from projects", () => {
        stubProjects = [
            { name: "A", rootPath: "/a", customField: "should-be-stripped", extraNum: 42 }
        ];
        const storage = new ProjectStorage();
        storage.load();

        assert.strictEqual(storage.length(), 1);
        const projects = storage.getProjects();
        const keys = Object.keys(projects[0]).sort();
        assert.deepStrictEqual(keys, ["enabled", "group", "name", "paths", "profile", "rootPath", "tags"]);
    });

    test("map includes group for projects with groups", () => {
        const storage = new ProjectStorage();
        storage.push("App", "/app", "Work/Frontend");

        const mapped = storage.map();
        assert.strictEqual(mapped.length, 1);
        assert.strictEqual(mapped[0].group, "Work/Frontend");
    });

    test("getProjectsByTag includes group in returned items", () => {
        const storage = new ProjectStorage();
        storage.push("App", "/app", "Work");
        storage.editTags("App", ["web"]);

        const result = storage.getProjectsByTag("web");
        assert.strictEqual(result.length, 1);
        assert.strictEqual(result[0].group, "Work");
    });

    test("getProjectsByTags includes group in returned items", () => {
        const storage = new ProjectStorage();
        storage.push("App", "/app", "Infra");
        storage.editTags("App", ["backend"]);

        const result = storage.getProjectsByTags(["backend"]);
        assert.strictEqual(result.length, 1);
        assert.strictEqual(result[0].group, "Infra");
    });

    test("save and load round-trip preserves group from push", async () => {
        const storage = new ProjectStorage();
        storage.push("App", "/app", "Deploy/Prod");
        await storage.save();

        const storage2 = new ProjectStorage();
        storage2.load();
        const project = storage2.existsWithRootPath("/app");
        assert.ok(project);
        assert.strictEqual(project!.group, "Deploy/Prod");
    });

});

suite("normalizeGroupPath", () => {
    test("trims whitespace", () => {
        assert.strictEqual(normalizeGroupPath("  Work  "), "Work");
    });

    test("collapses consecutive slashes", () => {
        assert.strictEqual(normalizeGroupPath("Work//Frontend"), "Work/Frontend");
    });

    test("strips leading and trailing slashes", () => {
        assert.strictEqual(normalizeGroupPath("/Work/Frontend/"), "Work/Frontend");
    });

    test("handles empty string", () => {
        assert.strictEqual(normalizeGroupPath(""), "");
    });

    test("handles complex case", () => {
        assert.strictEqual(normalizeGroupPath("  /Work///Frontend/ "), "Work/Frontend");
    });
});

suite("parseProjectInput", () => {
    test("plain name without slash returns empty group", () => {
        const result = parseProjectInput("my-app");
        assert.strictEqual(result.name, "my-app");
        assert.strictEqual(result.group, "");
    });

    test("single slash separates group and name", () => {
        const result = parseProjectInput("Work/my-app");
        assert.strictEqual(result.name, "my-app");
        assert.strictEqual(result.group, "Work");
    });

    test("nested group path is extracted", () => {
        const result = parseProjectInput("Work/Frontend/my-app");
        assert.strictEqual(result.name, "my-app");
        assert.strictEqual(result.group, "Work/Frontend");
    });

    test("trailing slash yields empty name", () => {
        const result = parseProjectInput("Work/Frontend/");
        assert.strictEqual(result.name, "");
        assert.strictEqual(result.group, "Work/Frontend");
    });

    test("group path is normalized", () => {
        const result = parseProjectInput("  /Work//Frontend/my-app");
        assert.strictEqual(result.name, "my-app");
        assert.strictEqual(result.group, "Work/Frontend");
    });
});
