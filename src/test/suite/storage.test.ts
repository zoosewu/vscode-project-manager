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

    test("map returns every project with the quick pick shape", () => {
        const storage = new ProjectStorage();

        storage.push("First", "/first");
        storage.push("Second", "/second");

        const mapped = storage.map();
        assert.strictEqual(mapped.length, 2);
        assert.deepStrictEqual(mapped[0], {
            label: "First",
            description: "/first",
            profile: "",
            group: ""
        });
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
        assert.ok(storage.exists("Legacy"));
        const project = storage.getProjects()[0];
        assert.strictEqual(project.group, "");
        assert.strictEqual(project.profile, "");
    });

    test("load keeps projects saved as disabled by older versions visible", () => {
        stubProjects = [
            { name: "OldDisabled", rootPath: "/old", enabled: false }
        ];
        const storage = new ProjectStorage();
        storage.load();

        assert.strictEqual(storage.map().length, 1);
        assert.strictEqual("enabled" in storage.getProjects()[0], false);
    });

    test("save and load round-trip with group", async () => {
        const storage = new ProjectStorage();
        storage.push("A", "/path/a");
        storage.editGroup("A", "Work/Frontend");
        await storage.save();

        const storage2 = new ProjectStorage();
        storage2.load();
        assert.ok(storage2.exists("A"));
        const project = storage2.getProjects().find(p => p.name === "A");
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
            { name: "B", rootPath: "/b", paths: [], profile: "", group: "" }
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
        assert.deepStrictEqual(keys, ["group", "name", "paths", "profile", "rootPath"]);
    });

    test("map includes group for projects with groups", () => {
        const storage = new ProjectStorage();
        storage.push("App", "/app", "Work/Frontend");

        const mapped = storage.map();
        assert.strictEqual(mapped.length, 1);
        assert.strictEqual(mapped[0].group, "Work/Frontend");
    });

    test("save and load round-trip preserves group from push", async () => {
        const storage = new ProjectStorage();
        storage.push("App", "/app", "Deploy/Prod");
        await storage.save();

        const storage2 = new ProjectStorage();
        storage2.load();
        assert.ok(storage2.exists("App"));
        const project = storage2.getProjects().find(p => p.name === "App");
        assert.ok(project);
        assert.strictEqual(project!.group, "Deploy/Prod");
    });

    // Reordering: the projects array order is the "Saved" order shown in the Side Bar,
    // so these tests assert on names in array order.
    const names = (storage: ProjectStorage) => storage.getProjects().map(p => p.name);

    test("moveProject dragging down onto the next project swaps them", () => {
        const storage = new ProjectStorage();
        storage.push("A", "/a");
        storage.push("B", "/b");
        storage.push("C", "/c");

        assert.strictEqual(storage.moveProject("A", "B"), true);

        assert.deepStrictEqual(names(storage), ["B", "A", "C"]);
    });

    test("moveProject dragging up places the project before the target", () => {
        const storage = new ProjectStorage();
        storage.push("A", "/a");
        storage.push("B", "/b");
        storage.push("C", "/c");

        storage.moveProject("C", "A");

        assert.deepStrictEqual(names(storage), ["C", "A", "B"]);
    });

    test("moveProject is a no-op for unknown names or dropping on itself", () => {
        const storage = new ProjectStorage();
        storage.push("A", "/a");
        storage.push("B", "/b");

        assert.strictEqual(storage.moveProject("A", "A"), false);
        assert.strictEqual(storage.moveProject("Missing", "A"), false);
        assert.strictEqual(storage.moveProject("A", "Missing"), false);
        assert.deepStrictEqual(names(storage), ["A", "B"]);
    });

    test("moveProjectToGroup appends after the last project of that group", () => {
        const storage = new ProjectStorage();
        storage.push("W1", "/w1", "Work");
        storage.push("W2", "/w2", "Work");
        storage.push("P1", "/p1", "Personal");
        storage.push("Root", "/root");

        assert.strictEqual(storage.moveProjectToGroup("Root", "Work"), true);

        assert.deepStrictEqual(names(storage), ["W1", "W2", "Root", "P1"]);
        assert.strictEqual(storage.getProjects()[2].group, "Work");
    });

    test("moveProjectToGroup into a group without projects moves to the end", () => {
        const storage = new ProjectStorage();
        storage.push("A", "/a");
        storage.push("B", "/b");

        storage.moveProjectToGroup("A", "/New//Group/");

        assert.deepStrictEqual(names(storage), ["B", "A"]);
        assert.strictEqual(storage.getProjects()[1].group, "New/Group");
    });

    test("moveProjectBy within groups only swaps with projects of the same group", () => {
        const storage = new ProjectStorage();
        storage.push("W1", "/w1", "Work");
        storage.push("P1", "/p1", "Personal");
        storage.push("W2", "/w2", "Work");

        storage.moveProjectBy("W1", 1, true);

        assert.deepStrictEqual(names(storage), ["W2", "P1", "W1"]);
    });

    test("moveProjectBy returns false at the edge of the list", () => {
        const storage = new ProjectStorage();
        storage.push("A", "/a");
        storage.push("B", "/b");

        assert.strictEqual(storage.moveProjectBy("A", -1, false), false);
        assert.strictEqual(storage.moveProjectBy("B", 1, false), false);
        assert.deepStrictEqual(names(storage), ["A", "B"]);
    });

    test("reordered projects keep their order after save and load", async () => {
        const storage = new ProjectStorage();
        storage.push("A", "/a");
        storage.push("B", "/b");
        storage.moveProject("B", "A");
        await storage.save();

        const reloaded = new ProjectStorage();
        reloaded.load();
        assert.deepStrictEqual(names(reloaded), ["B", "A"]);
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
