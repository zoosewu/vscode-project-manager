/*---------------------------------------------------------------------------------------------
*  Copyright (c) Alessandro Fragnani. All rights reserved.
*  Licensed under the GPLv3 License. See License.md in the project root for license information.
*--------------------------------------------------------------------------------------------*/

import * as assert from "assert";
import * as os from "os";
import * as vscode from "vscode";
import { Container } from "../../core/container";
import { FavoritesDragAndDropController } from "../../sidebar/favoritesReorder";
import { GroupNode, ProjectNode } from "../../sidebar/nodes";
import { ProjectStorage } from "../../storage/storage";
import { createMockContext } from "./mocks/MockMemento";

let sortList = "Saved";
let savedProjects: unknown[] | undefined;
let shownMessages: string[] = [];
const originalGetConfiguration = vscode.workspace.getConfiguration.bind(vscode.workspace);
const originalShowInformationMessage = vscode.window.showInformationMessage;

function stubEnvironment(): void {
    vscode.workspace.getConfiguration = ((section?: string, scope?: vscode.ConfigurationScope | null): vscode.WorkspaceConfiguration => {
        const real = originalGetConfiguration(section, scope);
        if (section !== "projectManager") {
            return real;
        }
        return {
            ...real,
            get: <T>(key: string, defaultValue?: T): T => (key === "sortList" ? sortList as T : real.get(key, defaultValue) as T),
            update: async (key: string, value: unknown) => {
                if (key === "projects") {
                    savedProjects = value as unknown[];
                }
            }
        } as vscode.WorkspaceConfiguration;
    }) as typeof vscode.workspace.getConfiguration;

    // Resolves immediately as if the user dismissed the message
    vscode.window.showInformationMessage = (async (message: string) => {
        shownMessages.push(message);
        return undefined;
    }) as typeof vscode.window.showInformationMessage;
}

function projectNode(name: string): ProjectNode {
    return new ProjectNode(name, vscode.TreeItemCollapsibleState.None, "favorites",
        { name, path: `/${name}` },
        { command: "_projectManager.open", title: "", arguments: [ `/${name}`, name, "" ] });
}

async function drag(controller: FavoritesDragAndDropController, source: ProjectNode | GroupNode, target: ProjectNode | GroupNode | undefined) {
    const dataTransfer = new vscode.DataTransfer();
    controller.handleDrag([ source ], dataTransfer);
    await controller.handleDrop(target, dataTransfer);
}

const names = (storage: ProjectStorage) => storage.getProjects().map(p => `${p.group}:${p.name}`);

// Dragging must never silently produce an order the user cannot see: in List view only
// "Sort by Saved" shows the stored order, so other sort modes are rejected with a hint.
suite("Favorites drag and drop", () => {
    let storage: ProjectStorage;
    let reorderCount: number;
    let controller: FavoritesDragAndDropController;

    suiteSetup(() => {
        stubEnvironment();
    });

    suiteTeardown(() => {
        vscode.workspace.getConfiguration = originalGetConfiguration;
        vscode.window.showInformationMessage = originalShowInformationMessage;
    });

    setup(() => {
        Container.initialize({ ...createMockContext(), extensionUri: vscode.Uri.file(os.tmpdir()) } as vscode.ExtensionContext);
        sortList = "Saved";
        savedProjects = undefined;
        shownMessages = [];
        reorderCount = 0;
        storage = new ProjectStorage();
        controller = new FavoritesDragAndDropController(storage, () => reorderCount++);
    });

    test("List view sorted by Saved reorders and saves the projects", async () => {
        storage.push("A", "/A");
        storage.push("B", "/B");

        await drag(controller, projectNode("A"), projectNode("B"));

        assert.deepStrictEqual(names(storage), [ ":B", ":A" ]);
        assert.ok(savedProjects, "new order must be persisted");
        assert.strictEqual(reorderCount, 1);
    });

    test("List view sorted by Name rejects the drop and explains why", async () => {
        sortList = "Name";
        storage.push("A", "/A");
        storage.push("B", "/B");

        await drag(controller, projectNode("A"), projectNode("B"));

        assert.deepStrictEqual(names(storage), [ ":A", ":B" ]);
        assert.strictEqual(savedProjects, undefined);
        assert.strictEqual(reorderCount, 0);
        assert.strictEqual(shownMessages.length, 1);
        assert.ok(shownMessages[ 0 ].includes("Saved"));
    });

    test("Groups view allows reordering regardless of the List sort mode", async () => {
        sortList = "Name";
        await Container.context.globalState.update("favoritesViewMode", "groups");
        storage.push("A", "/A", "Work");
        storage.push("B", "/B", "Work");

        await drag(controller, projectNode("B"), projectNode("A"));

        assert.deepStrictEqual(names(storage), [ "Work:B", "Work:A" ]);
    });

    test("Groups view dropping on a project of another group moves it into that group", async () => {
        await Container.context.globalState.update("favoritesViewMode", "groups");
        storage.push("Home", "/Home", "Personal");
        storage.push("W1", "/W1", "Work");
        storage.push("W2", "/W2", "Work");

        await drag(controller, projectNode("Home"), projectNode("W2"));

        assert.deepStrictEqual(names(storage), [ "Work:W1", "Work:W2", "Work:Home" ]);
    });

    test("Groups view dropping on a group node moves the project to the end of that group", async () => {
        await Container.context.globalState.update("favoritesViewMode", "groups");
        storage.push("Root", "/Root");
        storage.push("W1", "/W1", "Work");

        await drag(controller, projectNode("Root"), new GroupNode("Work", "Work", vscode.TreeItemCollapsibleState.Expanded));

        assert.deepStrictEqual(names(storage), [ "Work:W1", "Work:Root" ]);
    });

    test("Dragging a group node is ignored", async () => {
        await Container.context.globalState.update("favoritesViewMode", "groups");
        storage.push("W1", "/W1", "Work");
        storage.push("Root", "/Root");

        await drag(controller, new GroupNode("Work", "Work", vscode.TreeItemCollapsibleState.Expanded), projectNode("Root"));

        assert.deepStrictEqual(names(storage), [ "Work:W1", ":Root" ]);
        assert.strictEqual(reorderCount, 0);
    });
});
