/*---------------------------------------------------------------------------------------------
*  Copyright (c) Alessandro Fragnani. All rights reserved.
*  Licensed under the GPLv3 License. See License.md in the project root for license information.
*--------------------------------------------------------------------------------------------*/

import * as vscode from "vscode";
import { Uri, l10n } from "vscode";
import { PathUtils } from "../utils/path";
import { isRemotePath } from "../utils/remote";
import { createProject, normalizeGroupPath, Project } from "../core/project";

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

    public toggleEnabled(name: string): boolean | undefined {
        for (const element of this.projects) {
            if (element.name.toLowerCase() === name.toLowerCase()) {
                element.enabled = !element.enabled;
                return element.enabled;
            }
        }
    }

    public disabled(): Array<Project> | undefined {
        return this.projects.filter(project => !project.enabled);
    }

    public updateRootPath(name: string, path: string): void {
        for (const element of this.projects) {
            if (element.name.toLowerCase() === name.toLowerCase()) {
                element.rootPath = path;
            }
        }
    }

    public exists(name: string): boolean {
        let found = false;

        for (const element of this.projects) {
            if (element.name.toLocaleLowerCase() === name.toLocaleLowerCase()) {
                found = true;
            }
        }
        return found;
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

            this.projects = items.map(item => ({
                name: "",
                rootPath: "",
                paths: [],
                enabled: true,
                profile: "",
                group: "",
                ...item
            }));

            this.projects = this.projects.map(project => ({
                name: project.name,
                rootPath: project.rootPath,
                paths: project.paths,
                enabled: project.enabled,
                profile: project.profile,
                group: project.group
            }));

            this.projects = this.projects.filter(p => p.name !== "" && p.rootPath !== "");

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

    public setProjects(projects: Project[]): void {
        this.projects = projects;
    }

    public map(): any {
        const newItems = this.projects.filter(item => item.enabled).map(item => {
            return {
                label: item.name,
                description: item.rootPath,
                profile: item.profile,
                group: item.group
            };
        });
        return newItems;
    }

    private updatePaths(): void {
        for (const project of this.projects) {
            if (!isRemotePath(project.rootPath)) {
                project.rootPath = PathUtils.updateWithPathSeparatorStr(project.rootPath);
            }
        }
    }

}
