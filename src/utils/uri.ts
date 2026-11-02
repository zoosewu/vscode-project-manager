/*---------------------------------------------------------------------------------------------
*  Copyright (c) Alessandro Fragnani. All rights reserved.
*  Licensed under the GPLv3 License. See License.md in the project root for license information.
*--------------------------------------------------------------------------------------------*/

import { Uri, workspace } from "vscode";
import { isRemotePath } from "./remote";

export function buildProjectUri(rootPath: string): Uri {
    return isRemotePath(rootPath) ? Uri.parse(rootPath) : Uri.file(rootPath);
}

/**
 * The URI that identifies the open window as a project: the .code-workspace file, or the
 * first folder of a multi-root window.
 */
export function getCurrentWorkspaceUri(): Uri | undefined {
    return workspace.workspaceFile ?? workspace.workspaceFolders?.[ 0 ].uri;
}
