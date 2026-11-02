/*---------------------------------------------------------------------------------------------
*  Copyright (c) Alessandro Fragnani. All rights reserved.
*  Licensed under the GPLv3 License. See License.md in the project root for license information.
*--------------------------------------------------------------------------------------------*/

import * as vscode from "vscode";
import { Uri, l10n } from "vscode";
import { PathUtils } from "../utils/path";
import { isRemotePath } from "../utils/remote";
import { createProject, normalizeGroupPath, Project } from "../core/project";

/** A saved project shaped for lists: label is the name, description is the root path. */
export interface ProjectListItem {
    label: string;
    description: string;
    profile: string;
    group: string;
}

export class ProjectStorage {

    private projects: Project[];

    constructor() {
        this.projects = [];
    }

    public push(name: string, rootPath: string, group: string = ""): void {
        this.projects.push(createProject(name, rootPath, group));
        return;
    }

    public pop(name: string): Project {
        for (let index = 0; index < this.projects.length; index++) {
            const element: Project = this.projects[ index ];
            if (element.name.toLowerCase() === name.toLowerCase()) {
                return this.projects.splice(index, 1)[ 0 ];
            }
        }
    }

    public rename(oldName: string, newName: string): void {
        for (const element of this.projects) {
            if (element.name.toLowerCase() === oldName.toLowerCase()) {
                element.name = newName;
                return;
            }
        }
    }

    public editGroup(name: string, group: string): void {
        for (const element of this.projects) {
            if (element.name.toLowerCase() === name.toLowerCase()) {
                element.group = normalizeGroupPath(group);
                return;
            }
        }
    }

    public renameGroup(oldGroup: string, newGroup: string): void {
        const normalizedOld = normalizeGroupPath(oldGroup);
        const normalizedNew = normalizeGroupPath(newGroup);

        for (const element of this.projects) {
            if (element.group === normalizedOld) {
                element.group = normalizedNew;
            } else if (element.group.startsWith(normalizedOld + "/")) {
                element.group = normalizedNew + element.group.substring(normalizedOld.length);
            }
        }
    }

    /**
     * Moves a project into the position currently held by the target project, so dragging
     * down lands after the target and dragging up lands before it.
     */
    public moveProject(name: string, targetName: string): boolean {
        const from = this.indexOf(name);
        const to = this.indexOf(targetName);
        if (from < 0 || to < 0 || from === to) {
            return false;
        }

        const [ project ] = this.projects.splice(from, 1);
        this.projects.splice(to, 0, project);
        return true;
    }

    /**
     * Assigns a project to a group and places it after the last project of that group,
     * or at the end of the list when the group has no other projects.
     */
    public moveProjectToGroup(name: string, group: string): boolean {
        const from = this.indexOf(name);
        if (from < 0) {
            return false;
        }

        const [ project ] = this.projects.splice(from, 1);
        project.group = normalizeGroupPath(group);

        let lastInGroup = -1;
        this.projects.forEach((element, index) => {
            if (element.group === project.group) {
                lastInGroup = index;
            }
        });
        this.projects.splice(lastInGroup < 0 ? this.projects.length : lastInGroup + 1, 0, project);
        return true;
    }

    /**
     * Swaps a project with its nearest neighbor in the given direction; with sameGroupOnly,
     * projects of other groups are skipped.
     */
    public moveProjectBy(name: string, offset: -1 | 1, sameGroupOnly: boolean): boolean {
        const from = this.indexOf(name);
        if (from < 0) {
            return false;
        }

        const group = this.projects[ from ].group;
        for (let index = from + offset; index >= 0 && index < this.projects.length; index += offset) {
            const neighbor = this.projects[ index ];
            if (sameGroupOnly && neighbor.group !== group) {
                continue;
            }
            this.projects[ index ] = this.projects[ from ];
            this.projects[ from ] = neighbor;
            return true;
        }
        return false;
    }

    private indexOf(name: string): number {
        return this.projects.findIndex(element => element.name.toLowerCase() === name.toLowerCase());
    }

    public updateRootPath(name: string, path: string): void {
        for (const element of this.projects) {
            if (element.name.toLowerCase() === name.toLowerCase()) {
                element.rootPath = path;
            }
        }
    }

    public exists(name: string): boolean {
        return this.indexOf(name) >= 0;
    }

    public existsWithRootPath(rootPath: string, returnExpandedHomePath: boolean = false): Project {
        for (const element of this.projects) {
            const elementPath = PathUtils.expandHomePath(element.rootPath);
            if ((elementPath.toLocaleLowerCase() === rootPath.toLocaleLowerCase()) || (elementPath === rootPath)) {
                if (returnExpandedHomePath) {
                    return {
                        ...element,
                        rootPath: elementPath
                    };
                }
                return element;
            }
        }
    }

    public existsRemoteWithRootPath(uri: Uri): Project {
        for (const element of this.projects) {
            if (!isRemotePath(element.rootPath)) { continue; }

            const uriElement = Uri.parse(element.rootPath);
            if (uriElement.path === uri.path) {
                return element;
            }
        }
    }

    public length(): number {
        return this.projects.length;
    }

    public load(): string {
        try {
            const config = vscode.workspace.getConfiguration("projectManager");
            const items = config.get<Array<Partial<Project>>>("projects", []);

            this.projects = items
                .map(item => ({
                    name: item.name ?? "",
                    rootPath: item.rootPath ?? "",
                    paths: item.paths ?? [],
                    profile: item.profile ?? "",
                    group: item.group ?? ""
                }))
                .filter(p => p.name !== "" && p.rootPath !== "");

            this.updatePaths();
            return "";
        } catch (error) {
            console.log(error);
            return error.toString();
        }
    }

    public async save(): Promise<void> {
        try {
            const config = vscode.workspace.getConfiguration("projectManager");
            await config.update("projects", this.projects, vscode.ConfigurationTarget.Global);
        } catch (error) {
            vscode.window.showErrorMessage(
                l10n.t("Failed to save projects: {0}", error.toString())
            );
            throw error;
        }
    }

    public getProjects(): Project[] {
        return [...this.projects];
    }

    public map(): ProjectListItem[] {
        return this.projects.map(item => ({
            label: item.name,
            description: item.rootPath,
            profile: item.profile,
            group: item.group
        }));
    }

    private updatePaths(): void {
        for (const project of this.projects) {
            if (!isRemotePath(project.rootPath)) {
                project.rootPath = PathUtils.updateWithPathSeparatorStr(project.rootPath);
            }
        }
    }

}
