/*---------------------------------------------------------------------------------------------
*  Copyright (c) Alessandro Fragnani. All rights reserved.
*  Licensed under the GPLv3 License. See License.md in the project root for license information.
*--------------------------------------------------------------------------------------------*/

import path = require("path");
import * as vscode from "vscode";

import { ProjectStorage } from "./storage/storage";

import { Providers } from "./sidebar/providers";

import { showStatusBar } from "./statusbar/statusBar";
import { getProjectDetails } from "./utils/suggestion";
import { CommandLocation } from "./core/constants";
import { isMacOS, isRemoteUri, isWindows } from "./utils/remote";
import { buildProjectUri } from "./utils/uri";
import { Container } from "./core/container";
import { registerHelpAndFeedbackView } from "./sidebar/helpAndFeedbackView";
import { registerRevealFileInOS } from "./commands/revealFileInOS";
import { registerOpenSettings } from "./commands/openSettings";
import { ViewFavoritesAs } from "./sidebar/constants";
import { registerSortBy, updateSortByContext } from "./commands/sortBy";
import { canSwitchOnActiveWindow, openPickedProject, pickProjects, shouldOpenInNewWindow } from "./quickpick/projectsPicker";
import { l10n } from "vscode";
import { registerWalkthrough } from "./commands/walkthrough";
import { registerAutoUpdate } from "./updater/githubUpdater";
import { registerSideBarDecorations } from "./sidebar/decoration";
import { GroupNode, ProjectNode } from "./sidebar/nodes";
import { registerMoveProjectCommands } from "./sidebar/favoritesReorder";
import { parseProjectInput, Project } from "./core/project";

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export async function activate(context: vscode.ExtensionContext) {

    Container.initialize(context);

    // load the projects
    const projectStorage: ProjectStorage = new ProjectStorage();

    const providerManager: Providers = new Providers(projectStorage);

    registerRevealFileInOS();
    registerOpenSettings();
    registerHelpAndFeedbackView(context);
    registerSortBy();
    registerMoveProjectCommands(projectStorage, () => providerManager.refreshStorageTreeView());
    registerSideBarDecorations();
    registerWalkthrough();

    // Defer the update check — it hits the network on activation.
    setImmediate(() => registerAutoUpdate(context));

    context.subscriptions.push(vscode.commands.registerCommand("_projectManager.openFolderWelcome", () => {
        const openFolderCommand = isWindows || isMacOS ? "workbench.action.files.openFolder" : "workbench.action.files.openFileFolder";
        vscode.commands.executeCommand(openFolderCommand);
    }));

    vscode.commands.registerCommand("_projectManager.open", async (projectPath: string, projectName: string, profile: string) => {
        const uri = buildProjectUri(projectPath);
        if (!await canSwitchOnActiveWindow(CommandLocation.SideBar)) {
            return;
        }
        vscode.commands.executeCommand("vscode.openFolder", uri, { forceProfile: profile , forceNewWindow: false } )
            .then(
                () => ({}),  // done
                () => vscode.window.showInformationMessage(l10n.t("Could not open the project!")));
    });
    vscode.commands.registerCommand("_projectManager.openInNewWindow", (node) => {
        const uri = buildProjectUri(node.command.arguments[0]);
        const openInNewWindow = shouldOpenInNewWindow(true, CommandLocation.SideBar);
        vscode.commands.executeCommand("vscode.openFolder", uri, { forceProfile: node.command.arguments[2] , forceNewWindow: openInNewWindow } )
            .then(
                () => ({}),  // done
                () => vscode.window.showInformationMessage(l10n.t("Could not open the project!")));
    });

    // register commands (here, because it needs to be used right below if an invalid JSON is present)
    vscode.commands.registerCommand("projectManager.saveProject", () => saveProject());
    vscode.commands.registerCommand("projectManager.listProjects", () => listProjects(false));
    vscode.commands.registerCommand("projectManager.listProjectsNewWindow", () => listProjects(true));
    
    vscode.commands.registerCommand("projectManager.listFavoriteProjects#sideBarFavorites", () => listStorageProjects());

    // new commands (ActivityBar)
    vscode.commands.registerCommand("projectManager.addToWorkspace#sideBar", (node) => addProjectToWorkspace(node));
    vscode.commands.registerCommand("projectManager.addToWorkspace", () => addProjectToWorkspace(undefined));
    vscode.commands.registerCommand("_projectManager.deleteProject", (node) => deleteProject(node));
    vscode.commands.registerCommand("_projectManager.renameProject", (node) => renameProject(node));
    vscode.commands.registerCommand("_projectManager.editGroup", async (node: ProjectNode) => {
        const project = projectStorage.existsWithRootPath(node.command.arguments[0]);
        if (!project) {
            return;
        }

        const currentGroup = project.group || "";
        const ibo = <vscode.InputBoxOptions>{
            prompt: l10n.t("Group Path (e.g. Work/Frontend)"),
            placeHolder: l10n.t("Type a group path, or leave empty for root level"),
            value: currentGroup
        };

        const newGroup = await vscode.window.showInputBox(ibo);
        if (newGroup === undefined) {
            return;
        }

        projectStorage.editGroup(project.name, newGroup);
        await projectStorage.save();
        providerManager.refreshStorageTreeView();
        vscode.window.showInformationMessage(l10n.t("Project group updated!"));
    });
    vscode.commands.registerCommand("_projectManager.renameGroup", async (node: GroupNode) => {
        const currentGroup = node.groupPath;
        const ibo: vscode.InputBoxOptions = {
            prompt: l10n.t("New Group Path (e.g. Work/Frontend)"),
            placeHolder: l10n.t("Type a new group path"),
            value: currentGroup
        };

        const newGroup = await vscode.window.showInputBox(ibo);
        if (newGroup === undefined || newGroup.trim() === "") {
            return;
        }

        projectStorage.renameGroup(currentGroup, newGroup);
        await projectStorage.save();
        providerManager.refreshStorageTreeView();
        vscode.window.showInformationMessage(l10n.t("Group renamed!"));
    });
    function getViewMode(): string {
        const stored = Container.context.globalState.get<string>("favoritesViewMode", undefined);
        if (stored !== undefined && stored !== "tags") {
            return stored;
        }
        return "list";
    }

    function setViewModeContext(mode: string) {
        vscode.commands.executeCommand("setContext", "projectManager.favoritesViewMode", mode);
        vscode.commands.executeCommand("setContext", "projectManager.viewAsList", mode === "list");
    }

    async function setViewMode(mode: string) {
        await Container.context.globalState.update("favoritesViewMode", mode);
        setViewModeContext(mode);
        providerManager.refreshTreeViews();
    }

    async function toggleViewAsFavoriteProjects(view: ViewFavoritesAs) {
        switch (view) {
            case ViewFavoritesAs.VIEW_AS_LIST:
                await setViewMode("list");
                break;
            case ViewFavoritesAs.VIEW_AS_GROUPS:
                await setViewMode("groups");
                break;
        }
    }

    const viewMode = getViewMode();
    setViewModeContext(viewMode);
    vscode.commands.registerCommand("_projectManager.viewAsList#sideBarFavorites", () => toggleViewAsFavoriteProjects(ViewFavoritesAs.VIEW_AS_LIST));
    vscode.commands.registerCommand("_projectManager.viewAsGroups#sideBarFavorites", () => toggleViewAsFavoriteProjects(ViewFavoritesAs.VIEW_AS_GROUPS));

    loadProjectsFile();

    Container.currentProject = showStatusBar(projectStorage);
    providerManager.updateTreeViewStorage();

    context.subscriptions.push(vscode.workspace.onDidChangeConfiguration(async cfg => {
        if (cfg.affectsConfiguration("workbench.iconTheme")) {
            providerManager.refreshTreeViews();
        }

        if (cfg.affectsConfiguration("projectManager.sortList")) {
            updateSortByContext();
            providerManager.storageProvider.refresh();
            providerManager.updateTreeViewStorage();
        }

        if (cfg.affectsConfiguration("projectManager.projects")) {
            loadProjectsFile();
            providerManager.storageProvider.refresh();
            providerManager.updateTreeViewStorage();
        }

    }));

    async function saveProject() {
        const projectDetails = await getProjectDetails();
        if (!projectDetails) {
            return;
        }
        const rootPath = projectDetails.path;
        const wpath = projectDetails.name;

        const saveProjectInternal = async (rawInput: string): Promise<boolean> => {
            const { name: projectName, group } = parseProjectInput(rawInput);

            if (projectName === "") {
                vscode.window.showWarningMessage(l10n.t("You must define a name for the project."));
                return false;
            }

            if (!projectStorage.exists(projectName)) {
                Container.stack.push(projectName);
                context.globalState.update("recent", Container.stack.toString());
                projectStorage.push(projectName, rootPath, group);
                await projectStorage.save();
                providerManager.updateTreeViewStorage();
                vscode.window.showInformationMessage(l10n.t("Project saved!"));
                showStatusBar(projectStorage, projectName);
                updateCurrentProject();
                return true;
            } else {
                const optionUpdate = <vscode.MessageItem> {
                    title: l10n.t("Update")
                };
                const optionCancel = <vscode.MessageItem> {
                    title: l10n.t("Cancel")
                };

                const option = await vscode.window.showInformationMessage(l10n.t("Project already exists!"), optionUpdate, optionCancel);

                // nothing selected or canceled
                if (typeof option === "undefined" || option.title === l10n.t("Cancel")) {
                    return false;
                }

                if (option.title === l10n.t("Update")) {
                    Container.stack.push(projectName);
                    context.globalState.update("recent", Container.stack.toString());
                    projectStorage.updateRootPath(projectName, rootPath);
                    if (group) {
                        projectStorage.editGroup(projectName, group);
                    }
                    await projectStorage.save();
                    providerManager.updateTreeViewStorage();
                    vscode.window.showInformationMessage(l10n.t("Project saved!"));
                    showStatusBar(projectStorage, projectName);
                    return true;
                }

                return false;
            }
        };

        const input = vscode.window.createInputBox();
        input.title = l10n.t("Save Project");
        input.prompt = l10n.t("Project Name");
        input.placeholder = l10n.t("Type a name for your project (e.g. Work/Frontend/my-app)");
        input.value = wpath;

        input.onDidAccept(async () => {
            const saved = await saveProjectInternal(input.value);
            if (saved) {
                input.hide();
                input.dispose();
            }
        });

        input.onDidHide(() => {
            input.dispose();
        });

        input.show();
    }

    function updateCurrentProject() {
        const workspace0 = vscode.workspace.workspaceFile ? vscode.workspace.workspaceFile :
            vscode.workspace.workspaceFolders ? vscode.workspace.workspaceFolders[ 0 ].uri :
                undefined;
        const currentProjectPath = workspace0 ? workspace0.fsPath : undefined;

        let foundProject: Project;
        if (workspace0 && isRemoteUri(workspace0)) {
            foundProject = projectStorage.existsRemoteWithRootPath(workspace0);
        } else {
            foundProject = projectStorage.existsWithRootPath(currentProjectPath, true);
        }
        Container.currentProject = foundProject;
    }

    async function listProjects(forceNewWindow: boolean) {
        const pick = await pickProjects(projectStorage, !forceNewWindow); 
        openPickedProject(pick, forceNewWindow, CommandLocation.CommandPalette);
    }

    async function listStorageProjects() {
        const pick = await pickProjects(projectStorage, true); 
        openPickedProject(pick, false, CommandLocation.SideBar);
    }

    function loadProjectsFile() {
        const errorLoading: string = projectStorage.load();
        if (errorLoading !== "") {
            vscode.window.showErrorMessage(
                l10n.t("Error loading projects: {0}", errorLoading)
            );
        }
    }

    function addProjectPathToWorkspace(projectPath: string) {
        if (path.extname(projectPath) === ".code-workspace") {
            vscode.window.showWarningMessage(l10n.t("You can't add a Workspace to another Workspace."));
            return;
        }
        vscode.workspace.updateWorkspaceFolders(vscode.workspace.workspaceFolders ? 
            vscode.workspace.workspaceFolders.length : 0, null, { uri: vscode.Uri.file(projectPath)});
    }

    async function addProjectToWorkspace(node: ProjectNode) {
        if (node) {
            addProjectPathToWorkspace(node.command.arguments[0]);
            return;
        }

        const pick = await pickProjects(projectStorage, false); 
        if (pick) {
            addProjectPathToWorkspace(pick.item.rootPath);
        }
    }

    async function deleteProject(node: ProjectNode) {
        Container.stack.pop(node.command.arguments[1]);
        projectStorage.pop(node.command.arguments[1]);
        await projectStorage.save();
        providerManager.updateTreeViewStorage();
        vscode.window.showInformationMessage(l10n.t("Project successfully deleted!"));
    }

    async function renameProject(node: ProjectNode) {
        const oldName: string = node.command.arguments[1];
        const ibo = <vscode.InputBoxOptions> {
            prompt: l10n.t("New Project Name"),
            placeHolder: l10n.t("Type a new name for the project"),
            value: oldName
        };

        const newName = await vscode.window.showInputBox(ibo);
        if (typeof newName === "undefined" || newName === oldName) {
            return;
        }

        if (newName === "") {
            vscode.window.showWarningMessage(l10n.t("You must define a new name for the project."));
            return;
        }

        if (!projectStorage.exists(newName) || newName.toLowerCase() === oldName.toLowerCase()) {
            Container.stack.rename(oldName, newName);
            projectStorage.rename(oldName, newName);
            await projectStorage.save();
            vscode.window.showInformationMessage(l10n.t("Project renamed!"));
            Container.currentProject = showStatusBar(projectStorage);
        } else {
            vscode.window.showErrorMessage(l10n.t("Project already exists!"));
        }
    }
}