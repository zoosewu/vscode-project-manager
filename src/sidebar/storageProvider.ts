/*---------------------------------------------------------------------------------------------
*  Copyright (c) Alessandro Fragnani. All rights reserved.
*  Licensed under the GPLv3 License. See License.md in the project root for license information.
*--------------------------------------------------------------------------------------------*/

import path = require("path");
import * as vscode from "vscode";
import { Container } from "../core/container";
import { ProjectStorage } from "../storage/storage";
import { PathUtils } from "../utils/path";
import { isRemotePath } from "../utils/remote";
import { sortProjects } from "../utils/sorter";
import { GroupNode, ProjectNode } from "./nodes";

interface ProjectInQuickPick {
    label: string;
    description: string;
    profile: string;
}

// eslint-disable-next-line @typescript-eslint/no-empty-interface
interface ProjectInQuickPickList extends Array<ProjectInQuickPick> { }

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

    public getChildren(element?: ProjectNode | GroupNode): Thenable<(ProjectNode | GroupNode)[]> {

        return new Promise(resolve => {

            if (element) {

                if (element instanceof GroupNode) {
                    resolve(this.getGroupChildren(element));
                    return;
                }

                resolve([]);
                return;

            } else { // ROOT

                if (this.projectSource.length() === 0) {
                    return resolve([]);
                }

                const viewMode = Container.context.globalState.get<string>("favoritesViewMode", "list");

                // viewAsGroups
                if (viewMode === "groups") {
                    resolve(this.getGroupRootChildren());
                    return;
                }

                // viewAsList (default)
                const nodes: ProjectNode[] = [];

                let projectsMapped: ProjectInQuickPickList;
                projectsMapped = <ProjectInQuickPickList>this.projectSource.map();
                projectsMapped = sortProjects(projectsMapped);

                for (let index = 0; index < projectsMapped.length; index++) {
                    const prj: ProjectInQuickPick = projectsMapped[ index ];

                    let iconFavorites = "favorites";
                    if (path.extname(prj.description) === ".code-workspace") {
                        iconFavorites = "favorites-workspace";
                    } else if (isRemotePath(prj.description)) {
                        iconFavorites = "favorites-remote";
                    }
                    nodes.push(new ProjectNode(prj.label, vscode.TreeItemCollapsibleState.None,
                        iconFavorites, {
                            name: prj.label,
                            path: PathUtils.expandHomePath(prj.description)
                        },
                        {
                            command: "_projectManager.open",
                            title: "",
                            arguments: [ PathUtils.expandHomePath(prj.description), prj.label, prj.profile ],
                        }));
                }

                resolve(nodes);
            }
        });
    }

    private getGroupRootChildren(): (ProjectNode | GroupNode)[] {
        const projects = this.getFilteredEnabledProjects();
        return this.buildGroupLevel(projects, "");
    }

    private getGroupChildren(groupNode: GroupNode): (ProjectNode | GroupNode)[] {
        const projects = this.getFilteredEnabledProjects();
        return this.buildGroupLevel(projects, groupNode.groupPath);
    }

    private getFilteredEnabledProjects(): Array<{ name: string; rootPath: string; profile: string; group: string }> {
        return this.projectSource.getProjects().filter(p => p.enabled);
    }

    private buildGroupLevel(
        projects: Array<{ name: string; rootPath: string; profile: string; group: string }>,
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

    private createProjectNode(project: { name: string; rootPath: string; profile: string; group: string }): ProjectNode {
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
