> **This is a fork of [alefragnani/vscode-project-manager](https://github.com/alefragnani/vscode-project-manager) published as `zoosewu.project-manager-zoo`.**
> Original extension by [Alessandro Fragnani](https://github.com/alefragnani) — [View original on Marketplace](https://marketplace.visualstudio.com/items?itemName=alefragnani.project-manager).

[![GitHub Release](https://img.shields.io/github/v/release/zoosewu/vscode-project-manager)](https://github.com/zoosewu/vscode-project-manager/releases/latest)
[![GitHub Downloads](https://img.shields.io/github/downloads/zoosewu/vscode-project-manager/total)](https://github.com/zoosewu/vscode-project-manager/releases)
[![License: GPL-3.0](https://img.shields.io/badge/license-GPL--3.0-blue)](LICENSE.md)

<p align="center">
  <br />
  <a title="Learn more about Project Manager" href="https://github.com/zoosewu/vscode-project-manager"><img src="https://raw.githubusercontent.com/zoosewu/vscode-project-manager/master/images/vscode-project-manager-logo-readme.png" alt="Project Manager Logo" width="70%" /></a>
</p>

# What's new in Project Manager 13.5

* **Reorder Favorites** by drag and drop (or **Move Up** / **Move Down**), including moving projects between groups
* **Auto-update** — checks the latest GitHub release once a week and installs it silently (takes effect after the next window reload)
* **No What's New page** — updates stay silent; release notes live in the [CHANGELOG](CHANGELOG.md)
* **Favorites only** — auto-detection of Git, Mercurial, SVN, VSCode and Any projects has been removed
* **Help and Feedback** links only point to this fork's repository
* Activity Bar icon now follows the selected/unselected state
* Distributed via **GitHub Releases** (VSIX) instead of the VS Code Marketplace
* Organize projects with **Group hierarchy** using slash notation (e.g., `Work/Frontend/my-app`)
* **View as Groups** mode in the Favorites Side Bar
* Edit or **Rename Group** from the Side Bar context menu
* Projects stored in **settings.json** — shareable via Settings Sync

# Installation

This extension is distributed as a VSIX file via [GitHub Releases](https://github.com/zoosewu/vscode-project-manager/releases/latest). Once a week the extension checks for a newer release and installs it silently; the new version takes effect after the next window reload.

**Manual install:**

1. Download the latest `.vsix` from the [Releases page](https://github.com/zoosewu/vscode-project-manager/releases/latest)
2. In VS Code, open the Command Palette and run **Extensions: Install from VSIX...**
3. Select the downloaded file

# Project Manager

It helps you to easily access your **projects**, no matter where they are located. _Don't miss those important projects anymore_.

You can define your own **Projects** (also called **Favorites**) and organize them with **Groups**.

Here are some of the features that **Project Manager** provides:

* Save any folder or workspace as a **Project**
* Organize your projects using **Groups**
* Open projects in the same or new window
* Identify _deleted/renamed_ projects
* A **Status Bar** which identifies the current project
* A dedicated **Side Bar**

# Features

## Available Commands

* `Project Manager: Save Project` — Save the current folder/workspace as a new project
* `Project Manager: List Projects to Open` — List all saved projects and pick one
* `Project Manager: List Projects to Open in New Window` — Open a project in a new window
* `Project Manager: Add Project to Workspace` — Add a project as a workspace folder

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
        "group": "",
        "enabled": true,
        "profile": "Delphi"
    },
    {
        "name": "my-app",
        "rootPath": "$home\\Documents\\GitHub\\my-app",
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

The Favorites view supports two display modes, cycling with the toolbar button:

* **List** — flat list of all projects
* **Groups** — projects organized by their group hierarchy (e.g., `Work › Frontend`)

### Project Groups — Hierarchy

Assign a group path to any project (via the context menu **Edit Group** or the slash notation when saving). Groups nest arbitrarily deep and are rendered as a tree in the **Groups** view mode.

Right-click any group node in the **Groups** view and choose **Rename Group** to rename it (and all sub-groups) in one step.

### Reorder Projects

Drag a project and drop it on another project to take its place. You can also right-click a project and choose **Move Up** / **Move Down**.

* **List** view — reordering requires `Sort by Saved` (`"projectManager.sortList": "Saved"`), because other sort modes would immediately reorder the list again
* **Groups** view — drop a project on another project to move it into that project's group at that position, on a group node to move it to the end of that group, or on empty space to move it to the root level. **Move Up** / **Move Down** only move within the same group

The new order is saved in the `projectManager.projects` setting, so it is shared via Settings Sync.

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

If you normally connect to remotes (SSH/WSL) and want to save Favorite projects on that remote, install the extension on the remote side by adding:

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

* Remove the current project from the list (`false` by default)

```json
"projectManager.removeCurrentProjectFromList": true
```

* Identify _invalid paths_ in the project list (`true` by default)

```json
"projectManager.checkInvalidPathsBeforeListing": false
```

* Filter projects through the full path (`false` by default)

```json
"projectManager.filterOnFullPath": true
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

## Available Colors

* Foreground color to highlight the current project in the Side Bar

```json
"workbench.colorCustomizations": {
    "projectManager.sideBar.currentProjectHighlightForeground": "#e13015"
}
```

# License

[GPL-3.0](LICENSE.md) &copy; Alessandro Fragnani
