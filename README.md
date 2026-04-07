> **This is a fork of [alefragnani/vscode-project-manager](https://github.com/alefragnani/vscode-project-manager) published as `zoosewu.project-manager-zoo`.**
> Original extension by [Alessandro Fragnani](https://github.com/alefragnani) — [View original on Marketplace](https://marketplace.visualstudio.com/items?itemName=alefragnani.project-manager).

[![GitHub Release](https://img.shields.io/github/v/release/zoosewu/vscode-project-manager)](https://github.com/zoosewu/vscode-project-manager/releases/latest)
[![GitHub Downloads](https://img.shields.io/github/downloads/zoosewu/vscode-project-manager/total)](https://github.com/zoosewu/vscode-project-manager/releases)
[![License: GPL-3.0](https://img.shields.io/badge/license-GPL--3.0-blue)](LICENSE.md)

<p align="center">
  <br />
  <a title="Learn more about Project Manager" href="https://github.com/zoosewu/vscode-project-manager"><img src="https://raw.githubusercontent.com/alefragnani/vscode-project-manager/master/images/vscode-project-manager-logo-readme.png" alt="Project Manager Logo" width="70%" /></a>
</p>

# What's new in Project Manager 13.2

* **Auto-update** — detects the latest GitHub release on startup and installs automatically
* Distributed via **GitHub Releases** (VSIX) instead of the VS Code Marketplace
* Organize projects with **Group hierarchy** using slash notation (e.g., `Work/Frontend/my-app`)
* **View as Groups** mode in the Favorites Side Bar
* Edit project **Group** from the Side Bar context menu
* Projects stored in **settings.json** — shareable via Settings Sync
* Faster startup via parallel and progressive autodetect provider loading

# Installation

This extension is distributed as a VSIX file via [GitHub Releases](https://github.com/zoosewu/vscode-project-manager/releases/latest). The extension checks for updates automatically on startup.

**Manual install:**

1. Download the latest `.vsix` from the [Releases page](https://github.com/zoosewu/vscode-project-manager/releases/latest)
2. In VS Code, open the Command Palette and run **Extensions: Install from VSIX...**
3. Select the downloaded file

# Project Manager

It helps you to easily access your **projects**, no matter where they are located. _Don't miss those important projects anymore_.

You can define your own **Projects** (also called **Favorites**), or choose for auto-detect **Git**, **Mercurial** or **SVN** repositories, **VSCode** folders, or **any** other folder.

Here are some of the features that **Project Manager** provides:

* Save any folder or workspace as a **Project**
* Auto-detect **Git**, **Mercurial** or **SVN** repositories
* Organize your projects using **Tags** and **Groups**
* Open projects in the same or new window
* Identify _deleted/renamed_ projects
* A **Status Bar** which identifies the current project
* A dedicated **Side Bar**

# Features

## Available Commands

* `Project Manager: Save Project` — Save the current folder/workspace as a new project
* `Project Manager: List Projects to Open` — List all saved/detected projects and pick one
* `Project Manager: List Projects to Open in New Window` — Open a project in a new window
* `Project Manager: Filter Projects by Tag` — Filter the Favorites by selected tags
* `Project Manager: Add Project to Workspace` — Add a project as a workspace folder
* `Project Manager: Refresh Projects` — Force-refresh all auto-detected projects

## Manage your projects

### Save Project

You can save the current folder/workspace as a **Project** at any time. You just need to type its name.

![Save](images/project-manager-save.png)

> It suggests a name to you _automatically_ :)

Use a slash in the name to assign a **Group** at the same time:

```
Work/Frontend/my-app
```

This saves the project under the `Work › Frontend` group hierarchy.

### Project Storage

Projects are stored directly in **settings.json** under the `projectManager.projects` key. This means your project list is automatically shared via **Settings Sync** without any extra configuration.

```json
"projectManager.projects": [
    {
        "name": "Pascal MI",
        "rootPath": "c:\\PascalProjects\\pascal-menu-insight",
        "tags": [],
        "group": "",
        "enabled": true,
        "profile": "Delphi"
    },
    {
        "name": "my-app",
        "rootPath": "$home\\Documents\\GitHub\\my-app",
        "tags": ["Personal", "VS Code"],
        "group": "Work/Frontend",
        "enabled": true
    }
]
```

> You can use `~` or `$home` in any path — it will be replaced by your HOME folder.

## Access

### List Projects to Open

Shows your projects and lets you select one to open.

### List Projects to Open in New Window

Just like **List Projects** but always opening in **New Window**.

## Side Bar

The **Project Manager** extension has its own **Side Bar**, with a variety of commands to improve your productivity.

![Side Bar](images/vscode-project-manager-side-bar.png)

### View Modes for Favorites

The Favorites view supports three display modes, cycling with the toolbar button:

* **List** — flat list of all projects
* **Tags** — projects grouped by tag
* **Groups** — projects organized by their group hierarchy (e.g., `Work › Frontend`)

### Project Tags — View and Filter

You can define your custom tags (via `projectManager.tags` setting), assign multiple **tags** to each project, and filter projects by their **tags**.

![Side Bar Tags](images/vscode-project-manager-side-bar-tags.gif)

### Project Groups — Hierarchy

Assign a group path to any project (via the context menu **Edit Group** or the slash notation when saving). Groups nest arbitrarily deep and are rendered as a tree in the **Groups** view mode.

## Keyboard Focused Users

If you are a keyboard focused user and use _Vim-like_ keyboard navigation, you can navigate through the project list with your own keybindings.

Just use the `when` clause `"inProjectManagerList"`, like:

```json
{
    "key": "cmd+j",
    "command": "workbench.action.quickOpenSelectNext",
    "when": "inProjectManagerList && isMac"
},
{
    "key": "cmd+shift+j",
    "command": "workbench.action.quickOpenSelectPrevious",
    "when": "inProjectManagerList && isMac"
},
{
    "key": "ctrl+j",
    "command": "workbench.action.quickOpenSelectNext",
    "when": "inProjectManagerList && (isWindows || isLinux)"
},
{
    "key": "ctrl+shift+j",
    "command": "workbench.action.quickOpenSelectPrevious",
    "when": "inProjectManagerList && (isWindows || isLinux)"
}
```

## Working with Remotes

The extension supports [Remote Development](https://code.visualstudio.com/docs/remote/remote-overview) scenarios.

### I access Remotes, but most of my work is Local

This is the _regular_ scenario — the extension works out of the box. When installed locally, you can save any Container, SSH, WSL or Codespaces projects as Favorites. Each has its own icon and VS Code opens the remote automatically when you select it.

### But what if I do most of my work on Remotes

If you normally connect to remotes (SSH/WSL) and want to save Favorite projects on that remote, or auto-detect repos there, install the extension on the remote side by adding:

```json
"remote.extensionKind": {
    "zoosewu.project-manager-zoo": [
        "workspace"
    ]
}
```

> More details on [VS Code documentation](https://code.visualstudio.com/docs/remote/containers#_advanced-forcing-an-extension-to-run-locally-or-remotely)

## Available Settings

* Sort the project list

  * `Saved` — the order you saved the projects
  * `Name` — alphabetically by name
  * `Path` — by full path
  * `Recent` — most recently used first

```json
"projectManager.sortList": "Name"
```

![List](images/project-manager-list-sort-by-name.png)

* Group the project list by its _kind_ (**Favorites**, **Git**, **Mercurial**, **SVN**, **VS Code**)

```json
"projectManager.groupList": true
```

* Remove the current project from the list (`false` by default)

```json
"projectManager.removeCurrentProjectFromList": true
```

* Identify _invalid paths_ in the project list (`true` by default)

```json
"projectManager.checkInvalidPathsBeforeListing": false
```

* Support symlinks in `baseFolders` (`false` by default)

```json
"projectManager.supportSymlinksOnBaseFolders": true
```

* Show parent folder info for duplicate project names (`false` by default)

```json
"projectManager.showParentFolderInfoOnDuplicates": true
```

* Filter projects through the full path (`false` by default)

```json
"projectManager.filterOnFullPath": true
```

* Automatic Detection of Projects (**Git**, **Mercurial**, **SVN**, **VSCode**, **Any**)

```json
"projectManager.git.baseFolders": [
    "c:\\Projects\\code",
    "d:\\MoreProjects\\code-*",
    "$home\\personal-coding"
]
```

> Indicates folders or [glob patterns](https://code.visualstudio.com/docs/editor/glob-patterns) to search for projects

```json
"projectManager.git.ignoredFolders": [
    "node_modules",
    "out",
    "typings",
    "test",
    "fork*"
]
```

> Indicates folders or glob patterns to be ignored when searching for projects

```json
"projectManager.git.maxDepthRecursion": 4
```

> Defines how deep to search for projects

* Exclude base folders themselves from auto-detected results (`false` by default)

```json
"projectManager.any.excludeBaseFoldersFromResults": true
```

* Ignore projects found inside other projects (`false` by default)

```json
"projectManager.ignoreProjectsWithinProjects": true
```

* Cache automatically detected projects (`true` by default)

```json
"projectManager.cacheProjectsBetweenSessions": false
```

* Display the Project Name in Status Bar (`true` by default)

```json
"projectManager.showProjectNameInStatusBar": true
```

* Open projects in _New Window_ when clicking in the Status Bar (`false` by default)

```json
"projectManager.openInNewWindowWhenClickingInStatusBar": true
```

* Behavior of the **Open in New Window** command when the current window is empty (`always` by default)

  * `always` — opens in the current window if empty
  * `onlyUsingCommandPalette` — only when using the Command Palette
  * `onlyUsingSideBar` — only when using the Side Bar
  * `never` — always opens a new window

```json
"projectManager.openInCurrentWindowIfEmpty": "always"
```

* Custom tags for organizing projects (`Personal` and `Work` by default)

```json
"projectManager.tags": [
    "Personal",
    "Work",
    "VS Code",
    "Learning"
]
```

* Controls how tag groups in the Favorites view expand/collapse (`startExpanded` by default)

  * `alwaysExpanded` — always expanded
  * `alwaysCollapsed` — always collapsed
  * `startExpanded` — start expanded, remember state
  * `startCollapsed` — start collapsed, remember state

```json
"projectManager.tags.collapseItems": "startExpanded"
```

## Available Colors

* Foreground color to highlight the current project in the Side Bar

```json
"workbench.colorCustomizations": {
    "projectManager.sideBar.currentProjectHighlightForeground": "#e13015"
}
```

# License

[GPL-3.0](LICENSE.md) &copy; Alessandro Fragnani
