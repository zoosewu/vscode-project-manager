/*---------------------------------------------------------------------------------------------
*  Copyright (c) Alessandro Fragnani. All rights reserved.
*  Licensed under the GPLv3 License. See License.md in the project root for license information.
*--------------------------------------------------------------------------------------------*/

import * as vscode from "vscode";
import { ProjectStorage } from "../storage/storage";
import { GroupNode, ProjectNode } from "./nodes";
import { StorageProvider } from "./storageProvider";
import { FavoritesDragAndDropController } from "./favoritesReorder";
import { Container } from "../core/container";

export class Providers {

    public storageProvider: StorageProvider;

    private storageTreeView: vscode.TreeView<ProjectNode | GroupNode>;

    private projectStorage: ProjectStorage;

    constructor(storage: ProjectStorage) {
        this.projectStorage = storage;

        this.storageProvider = new StorageProvider(this.projectStorage);

        this.storageTreeView = vscode.window.createTreeView("projectsExplorerFavorites", {
            treeDataProvider: this.storageProvider,
            showCollapseAll: true,
            dragAndDropController: new FavoritesDragAndDropController(this.projectStorage, () => this.refreshStorageTreeView())
        });

        this.registerStorageTreeViewListeners();
    }

    private registerStorageTreeViewListeners() {
        Container.context.subscriptions.push(
            this.storageTreeView.onDidExpandElement(async event => {
                await this.handleStorageTreeViewExpansionChange(event, "expanded");
            }),
            this.storageTreeView.onDidCollapseElement(async event => {
                await this.handleStorageTreeViewExpansionChange(event, "collapsed");
            })
        );
    }

    private async handleStorageTreeViewExpansionChange(_event: vscode.TreeViewExpansionEvent<ProjectNode | GroupNode>, _state: "expanded" | "collapsed") {
        // Group expansion changes are handled by VS Code natively
    }

    public refreshTreeViews() {
        this.storageProvider.refresh();
    }

    public refreshStorageTreeView() {
        this.storageProvider.refresh();
        this.updateTreeViewStorage();
    }

    public updateTreeViewStorage() {
        this.storageTreeView.title = `Favorites (${this.projectStorage.length()})`;
    }
}
