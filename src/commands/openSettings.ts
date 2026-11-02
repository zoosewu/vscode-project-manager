/*---------------------------------------------------------------------------------------------
*  Copyright (c) Alessandro Fragnani. All rights reserved.
*  Licensed under the GPLv3 License. See License.md in the project root for license information.
*--------------------------------------------------------------------------------------------*/

import { commands } from "vscode";
import { Container } from "../core/container";

function openSettings() {
    commands.executeCommand("workbench.action.openSettings", "projectManager");
}


export function registerOpenSettings() {
    Container.context.subscriptions.push(commands.registerCommand("projectManager.openSettings#sideBarFavorites", () => openSettings()));
}
