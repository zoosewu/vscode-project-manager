/*---------------------------------------------------------------------------------------------
*  Copyright (c) Alessandro Fragnani. All rights reserved.
*  Licensed under the GPLv3 License. See License.md in the project root for license information.
*--------------------------------------------------------------------------------------------*/

import { env, Uri } from "vscode";

export const REMOTE_PREFIX = "vscode-remote";
export const VIRTUAL_WORKSPACE_PREFIX = "vscode-vfs";

export const isWindows = process.platform === "win32";
export const isMacOS = process.platform === "darwin";

export function isRemotePath(projectPath: string): boolean {
    return projectPath.startsWith(REMOTE_PREFIX) || projectPath.startsWith(VIRTUAL_WORKSPACE_PREFIX);
}

export function isRemoteUri(uri: Uri): boolean {
    return uri.scheme === REMOTE_PREFIX || uri.scheme === VIRTUAL_WORKSPACE_PREFIX;
}

export function isRunningOnCodespaces(): boolean {
    return env.remoteName?.toLocaleLowerCase() === 'codespaces';
}

export interface RemoteKind {
    label: string;
    codicon: string;
}

/** Keyed by the remote type, the part of a vscode-remote authority before "+". */
const REMOTE_KINDS: Record<string, RemoteKind> = {
    "codespaces": { label: "Codespaces", codicon: "github" },
    "dev-container": { label: "Container", codicon: "symbol-method" },
    "attached-container": { label: "Container", codicon: "symbol-method" },
    "ssh-remote": { label: "SSH", codicon: "terminal" },
    "wsl": { label: "WSL", codicon: "terminal-linux" },
    "tunnel": { label: "Tunnel", codicon: "remote" },
};

export function getRemoteType(uri: Uri): string {
    return uri.authority.split("+")[ 0 ];
}

export function getRemoteKind(uri: Uri): RemoteKind | undefined {
    return uri.scheme === REMOTE_PREFIX ? REMOTE_KINDS[ getRemoteType(uri) ] : undefined;
}
