/*---------------------------------------------------------------------------------------------
*  Copyright (c) Alessandro Fragnani. All rights reserved.
*  Licensed under the GPLv3 License. See License.md in the project root for license information.
*--------------------------------------------------------------------------------------------*/

import fs = require("fs");
import { commands, Disposable, l10n, MessageItem, QuickInputButton, QuickPickItem, ThemeIcon, Uri, window, workspace } from "vscode";
import { ThemeIcons } from "vscode-ext-codicons";
import { Container } from "../core/container";
import { Project } from "../core/project";
import { ProjectStorage } from "../storage/storage";
import { PathUtils } from "../utils/path";
import { isRemotePath, isRemoteUri } from "../utils/remote";
import { sortProjects } from "../utils/sorter";
import { buildProjectUri } from "../utils/uri";
import { CommandLocation, ConfirmSwitchOnActiveWindowMode, OpenInCurrentWindowIfEmptyMode } from "../core/constants";

function removeCurrentProject(items: any[]): any[] {
    const workspace0 = workspace.workspaceFile ? workspace.workspaceFile :
        workspace.workspaceFolders ? workspace.workspaceFolders[ 0 ].uri :
            undefined;

    if (!workspace0 || !workspace.getConfiguration("projectManager").get("removeCurrentProjectFromList")) {
        return items;
    }

    if (isRemoteUri(workspace0)) {
        return items.filter(value => !isRemotePath(value.description) || Uri.parse(value.description).path !== workspace0.path);
    }
    return items.filter(value => value.description.toString().toLowerCase() !== workspace0.fsPath.toLowerCase());
}

function prepareProjectList(items: any[]): any[] {
    let itemsToShow = PathUtils.expandHomePaths(items);
    itemsToShow = removeCurrentProject(itemsToShow);
    if (workspace.getConfiguration("projectManager").get("checkInvalidPathsBeforeListing", true)) {
        itemsToShow = PathUtils.indicateInvalidPaths(itemsToShow);
    }
    return sortProjects(itemsToShow);
}

async function folderNotFound(name: string, projectStorage: ProjectStorage) {

    const optionUpdateProject = <MessageItem>{
        title: l10n.t("Update Project")
    };
    const optionDeleteProject = <MessageItem>{
        title: l10n.t("Delete Project")
    };

    const option = await window.showErrorMessage(l10n.t("The project has an invalid path. What would you like to do?"), optionUpdateProject, optionDeleteProject);

    if (typeof option === "undefined") {
        return;
    }

    if (option.title === l10n.t("Update Project")) {
        commands.executeCommand("workbench.action.openSettings", "projectManager.projects");
    } else {
        projectStorage.pop(name);
        await projectStorage.save();
    }
}

function canPickSelectedProject(item: QuickPickItem, projectStorage: ProjectStorage): boolean {

    if (isRemotePath(item.description)) {
        return true;
    }

    if (fs.existsSync(item.description.toString())) {
        return true;
    }

    if (item.label.substr(0, 2) === "$(") {
        window.showErrorMessage(l10n.t("Path does not exist or is unavailable."));
        return false;
    }

    folderNotFound(item.label, projectStorage);
    return false;
}

class OpenInNewWindowButton implements QuickInputButton {
    constructor(public iconPath: ThemeIcon, public tooltip: string) { }
}

const openInNewWindowButton = new OpenInNewWindowButton(ThemeIcons.link_external, l10n.t('Open in New Window'));

export interface Picked<T> {
    item: T;
    button: QuickInputButton | undefined
}

export async function pickProjects(projectStorage: ProjectStorage, showOpenInNewWindowButton: boolean): Promise<Picked<Project> | undefined> {
    const disposables: Disposable[] = [];

    try {
        return await new Promise<Picked<Project> | undefined>((resolve) => {
            const projects = projectStorage.map();
            if (projects.length === 0) {
                window.showInformationMessage(l10n.t("No projects saved yet!"));
                return resolve(undefined);
            }

            commands.executeCommand("setContext", "inProjectManagerList", true);

            const folders = prepareProjectList(projects).map(folder => {
                return {
                    label: folder.label,
                    description: folder.description,
                    detail: folder.group || undefined,
                    profile: folder.profile,
                    buttons: showOpenInNewWindowButton ? [ openInNewWindowButton ] : []
                };
            });
            const input = window.createQuickPick();
            input.placeholder = l10n.t("Loading projects (pick one)...");
            input.matchOnDescription = workspace.getConfiguration("projectManager").get("filterOnFullPath", false);
            input.matchOnDetail = false;
            input.items = <any[]>folders;
            input.onDidChangeSelection(items => {
                const item = <any>items[ 0 ];
                if (item) {
                    if (!canPickSelectedProject(item, projectStorage)) {
                        resolve(undefined);
                        input.hide();
                        return;
                    }

                    resolve(<Picked<Project>>{
                        item: {
                            name: item.label,
                            rootPath: PathUtils.normalizePath(item.description),
                            profile: item.profile,
                        }, button: undefined
                    });
                    input.hide();
                    return;
                }
            }),
            input.onDidTriggerItemButton(item => {
                if (item) {
                    if (!canPickSelectedProject(item.item, projectStorage)) {
                        resolve(undefined);
                        input.hide();
                        return;
                    }

                    resolve(<Picked<Project>>{
                        item: {
                            name: item.item.label,
                            rootPath: PathUtils.normalizePath(item.item.description)
                        }, button: item.button
                    });
                    input.hide();
                    return;
                }
            }),
            input.onDidHide(() => {
                commands.executeCommand("setContext", "inProjectManagerList", false);
                resolve(undefined);
                input.dispose();
                return;
            });
            input.show();
        });

    } finally {
        disposables.forEach(d => d.dispose());
    }

}

export function shouldOpenInNewWindow(openInNewWindow: boolean, calledFrom: CommandLocation): boolean {
    if (!openInNewWindow) {
        return false;
    }

    if (workspace.workspaceFolders || window.activeTextEditor) {
        return openInNewWindow;
    }

    // Check for setting name before and after typo was corrected
    const oldValue = workspace.getConfiguration("projectManager").inspect("openInCurrenWindowIfEmpty");
    const newValue = workspace.getConfiguration("projectManager").inspect("openInCurrentWindowIfEmpty");

    let config: string | unknown;
    if (oldValue.globalValue) {
        config = newValue.globalValue === undefined ? oldValue.globalValue : newValue.globalValue;
    } else {
        config = workspace.getConfiguration("projectManager").get<string>("openInCurrentWindowIfEmpty");
    }

    if (config === OpenInCurrentWindowIfEmptyMode.always) {
        return false;
    }
    if (config === OpenInCurrentWindowIfEmptyMode.never) {
        return openInNewWindow;
    }

    switch (config) {
        case OpenInCurrentWindowIfEmptyMode.always:
            return false;
        case OpenInCurrentWindowIfEmptyMode.never:
            return openInNewWindow;
        case OpenInCurrentWindowIfEmptyMode.onlyUsingCommandPalette:
            return calledFrom !== CommandLocation.CommandPalette;
        case OpenInCurrentWindowIfEmptyMode.onlyUsingSideBar:
            return calledFrom !== CommandLocation.SideBar;
    }
}

function shouldConfirmSwitchOnActiveWindow(calledFrom: CommandLocation): boolean {
    if (!workspace.workspaceFolders || !window.activeTextEditor) {
        return false;
    }

    const config = workspace.getConfiguration("projectManager").get<string>("confirmSwitchOnActiveWindow", ConfirmSwitchOnActiveWindowMode.never);

    switch (config) {
        case ConfirmSwitchOnActiveWindowMode.never:
            return false;
        case ConfirmSwitchOnActiveWindowMode.onlyUsingCommandPalette:
            return calledFrom === CommandLocation.CommandPalette;
        case ConfirmSwitchOnActiveWindowMode.onlyUsingSideBar:
            return calledFrom === CommandLocation.SideBar;
        case ConfirmSwitchOnActiveWindowMode.always:
            return true;
    }
}

export async function canSwitchOnActiveWindow(calledFrom: CommandLocation): Promise<boolean> {
    const showConfirmation = shouldConfirmSwitchOnActiveWindow(calledFrom);
    if (!showConfirmation) {
        return true;
    }

    const optionOpenProject = <MessageItem>{
        title: l10n.t("Open Project")
    };
    const answer = await window.showWarningMessage(l10n.t("Do you want to open the project in the active window?"), { modal: true }, optionOpenProject);
    return answer === optionOpenProject;
}

export async function openPickedProject(picked: Picked<Project>, forceNewWindow: boolean, calledFrom: CommandLocation) {
    if (!picked) { return; }

    if (!picked.button) {
        if (!forceNewWindow && !await canSwitchOnActiveWindow(calledFrom)) {
            return;
        }
    }

    Container.stack.push(picked.item.name);
    Container.context.globalState.update("recent", Container.stack.toString());

    const openInNewWindow = shouldOpenInNewWindow(forceNewWindow || !!picked.button, calledFrom);
    const uri = buildProjectUri(picked.item.rootPath);
    commands.executeCommand("vscode.openFolder", uri, { forceProfile: picked.item.profile, forceNewWindow: openInNewWindow })
        .then(
            () => ({}),  // done
            () => window.showInformationMessage(l10n.t("Could not open the project!")));
}