/*---------------------------------------------------------------------------------------------
*  Copyright (c) Alessandro Fragnani. All rights reserved.
*  Licensed under the GPLv3 License. See License.md in the project root for license information.
*--------------------------------------------------------------------------------------------*/

import fs = require("fs");
import { commands, l10n, MessageItem, QuickInputButton, QuickPickItem, ThemeIcon, Uri, window, workspace } from "vscode";
import { codicons, ThemeIcons } from "vscode-ext-codicons";
import { Container } from "../core/container";
import { ProjectListItem, ProjectStorage } from "../storage/storage";
import { PathUtils } from "../utils/path";
import { isRemotePath, isRemoteUri } from "../utils/remote";
import { sortProjects } from "../utils/sorter";
import { buildProjectUri, getCurrentWorkspaceUri } from "../utils/uri";
import { CommandLocation, ConfirmSwitchOnActiveWindowMode, OpenInCurrentWindowIfEmptyMode } from "../core/constants";

interface ProjectPickItem extends QuickPickItem {
    description: string;
    profile: string;
}

export interface PickedProject {
    name: string;
    rootPath: string;
    profile: string;
}

export interface Picked {
    item: PickedProject;
    button: QuickInputButton | undefined;
}

function removeCurrentProject(items: ProjectListItem[]): ProjectListItem[] {
    const workspace0 = getCurrentWorkspaceUri();

    if (!workspace0 || !workspace.getConfiguration("projectManager").get("removeCurrentProjectFromList")) {
        return items;
    }

    if (isRemoteUri(workspace0)) {
        return items.filter(value => !isRemotePath(value.description) || Uri.parse(value.description).path !== workspace0.path);
    }
    return items.filter(value => value.description.toLowerCase() !== workspace0.fsPath.toLowerCase());
}

function pathIsMissing(projectPath: string): boolean {
    return !isRemotePath(projectPath) && !fs.existsSync(projectPath);
}

export function buildPickItems(items: ProjectListItem[], showOpenInNewWindowButton: boolean): ProjectPickItem[] {
    const expanded = items.map(item => ({ ...item, description: PathUtils.expandHomePath(item.description) }));
    const checkInvalidPaths = workspace.getConfiguration("projectManager").get("checkInvalidPathsBeforeListing", true);

    return sortProjects(removeCurrentProject(expanded)).map(item => ({
        label: item.label,
        description: item.description,
        detail: checkInvalidPaths && pathIsMissing(item.description)
            ? codicons.circle_slash + " Path does not exist"
            : item.group || undefined,
        profile: item.profile,
        buttons: showOpenInNewWindowButton ? [ openInNewWindowButton ] : []
    }));
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

class OpenInNewWindowButton implements QuickInputButton {
    constructor(public iconPath: ThemeIcon, public tooltip: string) { }
}

const openInNewWindowButton = new OpenInNewWindowButton(ThemeIcons.link_external, l10n.t('Open in New Window'));

export function pickProjects(projectStorage: ProjectStorage, showOpenInNewWindowButton: boolean): Promise<Picked | undefined> {
    return new Promise<Picked | undefined>((resolve) => {
        const projects = projectStorage.map();
        if (projects.length === 0) {
            window.showInformationMessage(l10n.t("No projects saved yet!"));
            return resolve(undefined);
        }

        const input = window.createQuickPick<ProjectPickItem>();
        input.placeholder = l10n.t("Loading projects (pick one)...");
        input.matchOnDescription = workspace.getConfiguration("projectManager").get("filterOnFullPath", false);
        input.matchOnDetail = false;
        input.items = buildPickItems(projects, showOpenInNewWindowButton);

        const accept = (item: ProjectPickItem, button: QuickInputButton | undefined) => {
            if (pathIsMissing(item.description)) {
                folderNotFound(item.label, projectStorage);
                resolve(undefined);
            } else {
                resolve({
                    item: {
                        name: item.label,
                        rootPath: PathUtils.normalizePath(item.description),
                        profile: item.profile
                    },
                    button
                });
            }
            input.hide();
        };

        input.onDidChangeSelection(items => {
            if (items[ 0 ]) {
                accept(items[ 0 ], undefined);
            }
        });
        input.onDidTriggerItemButton(event => accept(event.item, event.button));
        input.onDidHide(() => {
            resolve(undefined);
            input.dispose();
        });
        input.show();
    });
}

export function shouldOpenInNewWindow(openInNewWindow: boolean, calledFrom: CommandLocation): boolean {
    if (!openInNewWindow) {
        return false;
    }

    if (workspace.workspaceFolders || window.activeTextEditor) {
        return openInNewWindow;
    }

    const config = workspace.getConfiguration("projectManager").get<string>("openInCurrentWindowIfEmpty");

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

export async function openPickedProject(picked: Picked | undefined, forceNewWindow: boolean, calledFrom: CommandLocation) {
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