/*---------------------------------------------------------------------------------------------
*  Copyright (c) Alessandro Fragnani. All rights reserved.
*  Licensed under the GPLv3 License. See License.md in the project root for license information.
*--------------------------------------------------------------------------------------------*/

import { commands, l10n, Uri, window, workspace } from "vscode";
import path = require("path");
import { isRunningOnCodespaces } from "./remote";

const REMOTE_TYPE_LABELS: Record<string, string> = {
    "ssh-remote": "SSH",
    "wsl": "WSL",
    "attached-container": "Container",
    "dev-container": "Container",
    "codespaces": "Codespaces",
    "tunnel": "Tunnel",
};

function getRemoteTypeLabel(uri: Uri): string {
    const remoteType = uri.authority.split("+")[0];
    return REMOTE_TYPE_LABELS[remoteType] ?? remoteType;
}

function prefixedName(baseName: string, prefix: string): string {
    return `${prefix}/${baseName}`;
}

export interface ProjectDetails {
    path: string;
    name: string;
}

export async function getProjectDetails(): Promise<ProjectDetails> {

    // workspaceFile - .code-workspace
    if (workspace.workspaceFile) {
        if (workspace.workspaceFile.scheme === "untitled") {
            window.showInformationMessage(l10n.t("Save the workspace first to save a project"));
            return null;
        }

        if (workspace.workspaceFile.scheme === "file") {
            return {
                path: workspace.workspaceFile.fsPath,
                name: prefixedName(path.basename(workspace.workspaceFile.fsPath, ".code-workspace"), "Local")
            };
        }

        if (workspace.workspaceFile.scheme === "vscode-remote") {
            const label = getRemoteTypeLabel(workspace.workspaceFile);
            return {
                path: `${workspace.workspaceFile.scheme}://${workspace.workspaceFile.authority}${workspace.workspaceFile.path}`,
                name: prefixedName(path.basename(workspace.workspaceFile.fsPath, ".code-workspace"), label)
            };
        }
    }

    if (!workspace.workspaceFolders) {
        window.showInformationMessage(l10n.t("Open a folder first to save a project"));
        return null;
    }

    if (workspace.workspaceFolders[ 0 ].uri.scheme === "file") {

        if (isRunningOnCodespaces()) {
            const info = await commands.executeCommand<{ name: string } | undefined>('github.codespaces.getCurrentCodespace');
            if (info) {
                return {
                    path: `vscode-remote://codespaces+${info.name}${workspace.workspaceFolders[ 0 ].uri.fsPath}`,
                    name: prefixedName(path.basename(workspace.workspaceFolders[ 0 ].uri.fsPath), "Codespaces")
                };
            }
        }

        return {
            path: workspace.workspaceFolders[ 0 ].uri.fsPath,
            name: prefixedName(path.basename(workspace.workspaceFolders[ 0 ].uri.fsPath), "Local")
        };
    }

    if (workspace.workspaceFolders[ 0 ].uri.scheme === "vscode-remote") {
        const label = getRemoteTypeLabel(workspace.workspaceFolders[ 0 ].uri);
        return {
            path: `${workspace.workspaceFolders[ 0 ].uri.scheme}://${workspace.workspaceFolders[ 0 ].uri.authority}${workspace.workspaceFolders[ 0 ].uri.path}`,
            name: prefixedName(path.basename(workspace.workspaceFolders[ 0 ].uri.fsPath), label)
        };
    }

    if (workspace.workspaceFolders[ 0 ].uri.scheme === "vscode-vfs") {
        const label = getRemoteTypeLabel(workspace.workspaceFolders[ 0 ].uri);
        return {
            path: `${workspace.workspaceFolders[ 0 ].uri.scheme}://${workspace.workspaceFolders[ 0 ].uri.authority}${workspace.workspaceFolders[ 0 ].uri.path}`,
            name: prefixedName(path.basename(workspace.workspaceFolders[ 0 ].uri.fsPath), label)
        };
    }
}
