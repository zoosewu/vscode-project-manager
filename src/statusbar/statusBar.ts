/*---------------------------------------------------------------------------------------------
*  Copyright (c) Alessandro Fragnani. All rights reserved.
*  Licensed under the GPLv3 License. See License.md in the project root for license information.
*--------------------------------------------------------------------------------------------*/

import { StatusBarAlignment, StatusBarItem, window, workspace } from "vscode";
import { getCodiconFromUri } from "../utils/icons";
import { getCurrentWorkspaceUri } from "../utils/uri";
import { Project } from "../core/project";

let statusItem: StatusBarItem;

export function showStatusBar(currentProject: Project | undefined): void {
    const showStatusConfig = workspace.getConfiguration("projectManager").get("showProjectNameInStatusBar");
    const workspace0 = getCurrentWorkspaceUri();

    if (!showStatusConfig || !workspace0 || !currentProject) {
        statusItem?.hide();
        return;
    }

    if (!statusItem) {
        statusItem = window.createStatusBarItem("projectManager.statusBar", StatusBarAlignment.Left);
        statusItem.name = "Project Manager";
    }
    statusItem.text = getCodiconFromUri(workspace0) + " " + currentProject.name;
    statusItem.tooltip = workspace0.fsPath;

    const openInNewWindow: boolean = workspace.getConfiguration("projectManager").get("openInNewWindowWhenClickingInStatusBar", false);
    statusItem.command = openInNewWindow ? "projectManager.listProjectsNewWindow" : "projectManager.listProjects";
    statusItem.show();
}
