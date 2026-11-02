/*---------------------------------------------------------------------------------------------
*  Copyright (c) Alessandro Fragnani. All rights reserved.
*  Licensed under the GPLv3 License. See License.md in the project root for license information.
*--------------------------------------------------------------------------------------------*/

import * as vscode from "vscode";
import { ProjectStorage } from "../storage/storage";
import { GroupNode, ProjectNode } from "./nodes";
import { StorageProvider } from "./storageProvider";
import { FavoritesDragAndDropController } from "./favoritesReorder";

export class Providers {

    private storageProvider: StorageProvider;

    private storageTreeView: vscode.TreeView<ProjectNode | GroupNode>;

    private projectStorage: ProjectStorage;

    constructor(storage: ProjectStorage) {
        this.projectStorage = storage;

        this.storageProvider = new StorageProvider(this.projectStorage);

        this.storageTreeView = vscode.window.createTreeView("projectsExplorerFavorites", {
            treeDataProvider: this.storageProvider,
            showCollapseAll: true,
            dragAndDropController: new FavoritesDragAndDropController(this.projectStorage)
        });
    }

    public refresh() {
        this.storageProvider.refresh();
        this.storageTreeView.title = `Favorites (${this.projectStorage.length()})`;
    }
}
