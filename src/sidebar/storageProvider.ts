/*---------------------------------------------------------------------------------------------
*  Copyright (c) Alessandro Fragnani. All rights reserved.
*  Licensed under the GPLv3 License. See License.md in the project root for license information.
*--------------------------------------------------------------------------------------------*/

import path = require("path");
import * as vscode from "vscode";
import { Container } from "../core/container";
import { Project } from "../core/project";
import { ProjectStorage } from "../storage/storage";
import { PathUtils } from "../utils/path";
import { isRemotePath } from "../utils/remote";
import { sortProjects } from "../utils/sorter";
import { GroupNode, ProjectNode } from "./nodes";

export class StorageProvider implements vscode.TreeDataProvider<ProjectNode | GroupNode> {

    public readonly onDidChangeTreeData: vscode.Event<ProjectNode | GroupNode | void>;

    private projectSource: ProjectStorage;
    private internalOnDidChangeTreeData: vscode.EventEmitter<ProjectNode | GroupNode | void> = new vscode.EventEmitter<ProjectNode | GroupNode | void>();

    constructor(projectSource: ProjectStorage) {
        this.projectSource = projectSource;
        this.onDidChangeTreeData = this.internalOnDidChangeTreeData.event;
    }

    public refresh(): void {
        this.internalOnDidChangeTreeData.fire();
    }

    public getTreeItem(element: ProjectNode | GroupNode): vscode.TreeItem {
        return element;
    }

    public getChildren(element?: ProjectNode | GroupNode): (ProjectNode | GroupNode)[] {
        if (element) {
            return element instanceof GroupNode ? this.getGroupChildren(element) : [];
        }

        const viewMode = Container.context.globalState.get<string>("favoritesViewMode", "list");
        if (viewMode === "groups") {
            return this.getGroupRootChildren();
        }

        return sortProjects(this.projectSource.map()).map(item =>
            this.createProjectNode({ name: item.label, rootPath: item.description, profile: item.profile }));
    }

    private getGroupRootChildren(): (ProjectNode | GroupNode)[] {
        return this.buildGroupLevel(this.projectSource.getProjects(), "");
    }

    private getGroupChildren(groupNode: GroupNode): (ProjectNode | GroupNode)[] {
        return this.buildGroupLevel(this.projectSource.getProjects(), groupNode.groupPath);
    }

    private buildGroupLevel(
        projects: Project[],
        parentPath: string
    ): (ProjectNode | GroupNode)[] {
        const projectNodes: ProjectNode[] = [];
        const childGroupNames = new Set<string>();

        for (const project of projects) {
            const group: string = project.group || "";
            const isChild = parentPath === ""
                ? group === ""
                : group === parentPath;
            const isDescendant = parentPath === ""
                ? group !== ""
                : group.startsWith(parentPath + "/");

            if (isChild) {
                projectNodes.push(this.createProjectNode(project));
            } else if (isDescendant) {
                const remainder = parentPath === ""
                    ? group
                    : group.substring(parentPath.length + 1);
                childGroupNames.add(remainder.split("/")[0]);
            }
        }

        const groupNodes: GroupNode[] = [...childGroupNames].sort().map(name => {
            const fullPath = parentPath === "" ? name : `${parentPath}/${name}`;
            return new GroupNode(name, fullPath, vscode.TreeItemCollapsibleState.Expanded);
        });

        return [...groupNodes, ...projectNodes];
    }

    private createProjectNode(project: Pick<Project, "name" | "rootPath" | "profile">): ProjectNode {
        const prjPath = PathUtils.expandHomePath(project.rootPath);
        let iconFavorites = "favorites";
        if (path.extname(prjPath) === ".code-workspace") {
            iconFavorites = "favorites-workspace";
        } else if (isRemotePath(prjPath)) {
            iconFavorites = "favorites-remote";
        }
        return new ProjectNode(project.name, vscode.TreeItemCollapsibleState.None,
            iconFavorites, {
                name: project.name,
                path: prjPath
            }, {
                command: "_projectManager.open",
                title: "",
                arguments: [ prjPath, project.name, project.profile ],
            });
    }

}
