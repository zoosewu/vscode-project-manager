/*---------------------------------------------------------------------------------------------
*  Copyright (c) Alessandro Fragnani. All rights reserved.
*  Licensed under the GPLv3 License. See License.md in the project root for license information.
*--------------------------------------------------------------------------------------------*/

import * as vscode from "vscode";
import { l10n } from "vscode";
import { Container } from "../core/container";
import { ProjectStorage } from "../storage/storage";
import { GroupNode, ProjectNode } from "./nodes";

const FAVORITE_MIME_TYPE = "application/vnd.projectmanager.favorite";

type FavoritesNode = ProjectNode | GroupNode;
type ReorderMode = "list" | "groups";

/**
 * The projects array is shown as-is only in Groups view or when List view is sorted by
 * "Saved"; any other sort would immediately hide the new order.
 */
function getReorderMode(): ReorderMode | undefined {
    const viewMode = Container.context.globalState.get<string>("favoritesViewMode", "list");
    if (viewMode === "groups") {
        return "groups";
    }
    const sortBy = vscode.workspace.getConfiguration("projectManager").get<string>("sortList", "Name");
    return sortBy === "Saved" ? "list" : undefined;
}

async function explainSortBySavedRequired() {
    const sortBySaved = l10n.t("Sort by Saved");
    const choice = await vscode.window.showInformationMessage(
        l10n.t("Projects can only be reordered when the list is sorted by Saved."), sortBySaved);
    if (choice === sortBySaved) {
        await vscode.commands.executeCommand("_projectManager.sortBySaved#sideBarFavorites");
    }
}

function projectName(node: ProjectNode): string {
    return node.command.arguments[ 1 ];
}

export class FavoritesDragAndDropController implements vscode.TreeDragAndDropController<FavoritesNode> {

    readonly dragMimeTypes = [ FAVORITE_MIME_TYPE ];
    readonly dropMimeTypes = [ FAVORITE_MIME_TYPE ];

    constructor(private readonly storage: ProjectStorage) { }

    public handleDrag(source: readonly FavoritesNode[], dataTransfer: vscode.DataTransfer): void {
        const project = source.find(node => node instanceof ProjectNode) as ProjectNode | undefined;
        if (project) {
            dataTransfer.set(FAVORITE_MIME_TYPE, new vscode.DataTransferItem(projectName(project)));
        }
    }

    public async handleDrop(target: FavoritesNode | undefined, dataTransfer: vscode.DataTransfer): Promise<void> {
        const name: string | undefined = dataTransfer.get(FAVORITE_MIME_TYPE)?.value;
        if (!name) {
            return;
        }

        const mode = getReorderMode();
        if (!mode) {
            await explainSortBySavedRequired();
            return;
        }

        if (this.applyDrop(name, target, mode)) {
            await this.storage.save();
        }
    }

    private applyDrop(name: string, target: FavoritesNode | undefined, mode: ReorderMode): boolean {
        if (target instanceof GroupNode) {
            return this.storage.moveProjectToGroup(name, target.groupPath);
        }

        if (target instanceof ProjectNode) {
            if (mode === "groups") {
                const targetGroup = this.storage.getProjects()
                    .find(project => project.name.toLowerCase() === projectName(target).toLowerCase())?.group ?? "";
                this.storage.editGroup(name, targetGroup);
            }
            return this.storage.moveProject(name, projectName(target));
        }

        // Dropped on empty space below the last item
        if (mode === "groups") {
            return this.storage.moveProjectToGroup(name, "");
        }
        const projects = this.storage.getProjects();
        return this.storage.moveProject(name, projects[ projects.length - 1 ].name);
    }
}

export function registerMoveProjectCommands(storage: ProjectStorage) {
    const move = async (node: ProjectNode, offset: -1 | 1) => {
        const mode = getReorderMode();
        if (!mode) {
            await explainSortBySavedRequired();
            return;
        }
        if (storage.moveProjectBy(projectName(node), offset, mode === "groups")) {
            await storage.save();
        }
    };

    Container.context.subscriptions.push(
        vscode.commands.registerCommand("_projectManager.moveProjectUp", (node: ProjectNode) => move(node, -1)),
        vscode.commands.registerCommand("_projectManager.moveProjectDown", (node: ProjectNode) => move(node, 1))
    );
}
