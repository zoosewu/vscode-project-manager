/*---------------------------------------------------------------------------------------------
*  Copyright (c) Alessandro Fragnani. All rights reserved.
*  Licensed under the GPLv3 License. See License.md in the project root for license information.
*--------------------------------------------------------------------------------------------*/

import { Command, IconPath, MarkdownString, ThemeColor, ThemeIcon, TreeItem, TreeItemCollapsibleState, Uri } from "vscode";
import { ThemeIcons } from "vscode-ext-codicons";
import { currentIconThemeHasFolderIcon, getProjectIcon, getIconDetailsFromProjectPath } from "../utils/icons";
import { getRemoteKind, VIRTUAL_WORKSPACE_PREFIX } from "../utils/remote";

export interface ProjectPreview {
    name: string;
    path: string;
    detail?: string;
}

export class ProjectNode extends TreeItem {

    constructor(
        public readonly label: string,
        public readonly collapsibleState: TreeItemCollapsibleState,
        public readonly icon: string,
        public readonly preview: ProjectPreview,
        public readonly command?: Command
    ) {
        super(label, collapsibleState);

        this.iconPath = this.getIconPath(icon, preview.path);
        this.contextValue = "ProjectNodeKind";

        this.resourceUri = Uri.from({
            scheme: 'projectManager-view',
            path: preview.path
        });

        const tooltipIcon = getIconDetailsFromProjectPath(preview.path);
        this.tooltip = new MarkdownString(
            `${label}\n\n_${preview.path}_\n\n${tooltipIcon.icon} ${tooltipIcon.title}`, true);
        this.description = preview.detail;
    }

    private getIconPath(icon: string, projectPath: string): string | IconPath {
        if (currentIconThemeHasFolderIcon()) {
            return getProjectIcon(icon, projectPath);
        } else {
            switch (icon) {
                case "favorites":
                    return ThemeIcons.folder;

                case "favorites-workspace":
                    return ThemeIcons.root_folder;

                case "favorites-remote": {
                    if (projectPath.startsWith(`${VIRTUAL_WORKSPACE_PREFIX}://`)) {
                        return ThemeIcons.remote;
                    }
                    const remoteKind = getRemoteKind(Uri.parse(projectPath));
                    // Symbol icons such as symbol-method are tinted by default; keep every icon neutral
                    return remoteKind
                        ? new ThemeIcon(remoteKind.codicon, new ThemeColor("icon.foreground"))
                        : ThemeIcons.remote_explorer;
                }

                default:
                    return getProjectIcon(icon, projectPath);
            }
        }
    }

}


export class GroupNode extends TreeItem {

    constructor(
        public readonly label: string,
        public readonly groupPath: string,
        public readonly collapsibleState: TreeItemCollapsibleState,
    ) {
        super(label, collapsibleState);
        this.iconPath = getProjectIcon("group", "");
        this.contextValue = "GroupNodeKind";
    }
}

