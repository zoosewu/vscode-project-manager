# Design: Migrate Project Storage from globalState to User-Level settings.json

**Date:** 2026-03-31
**Status:** Approved (rev 3)

## Summary

Move `projectManager.projects` from VS Code `globalState` to user-level `settings.json` via `contributes.configuration`. Remove Export/Import commands and all legacy migration code. This is a breaking change.

## Motivation

1. **Hand-editable** — Users can directly view and edit project data in settings.json, restoring the experience from the `projects.json` era.
2. **Native Settings Sync** — `application`-scoped settings sync automatically via VS Code Settings Sync, no `setKeysForSync()` needed.
3. **API access** — Other extensions and scripts can read project data via `vscode.workspace.getConfiguration("projectManager").get("projects")`.
4. **Export/Import becomes unnecessary** — Users manage data directly in settings.json; dedicated commands add no value.

## Scope

**In scope:**
- `projectManager.projects` moves to `contributes.configuration` with JSON schema
- `ProjectStorage` refactored from `Memento` to `WorkspaceConfiguration`
- `onDidChangeConfiguration` listener for automatic UI refresh
- Remove Export/Import commands and `src/commands/exportImport.ts`
- Remove migration logic and `src/storage/migration.ts`
- Remove deprecated `projectManager.projectsLocation` setting
- Remove `_projectManager.refreshFavorites` command (auto-refresh replaces it)
- Remove `projectManager.editProjects` command

**Out of scope:**
- UI state in globalState (`favoritesViewMode`, `filterByTags`, `recent`, `hideGitWelcome`, `tagsExpansionState`) — stays in globalState
- `vscode-whats-new` submodule — continues using globalState
- Automatic migration from globalState to settings.json — this is a breaking change

---

## 1. Configuration Schema

Register `projectManager.projects` in `package.json` under `contributes.configuration`:

```json
"projectManager.projects": {
    "type": "array",
    "scope": "application",
    "default": [],
    "description": "%projectManager.configuration.projects.description%",
    "items": {
        "type": "object",
        "required": ["name", "rootPath"],
        "properties": {
            "name": { "type": "string", "description": "Project display name" },
            "rootPath": { "type": "string", "description": "Absolute path or remote URI" },
            "paths": { "type": "array", "items": { "type": "string" }, "default": [] },
            "tags": { "type": "array", "items": { "type": "string" }, "default": [] },
            "enabled": { "type": "boolean", "default": true },
            "profile": { "type": "string", "default": "" },
            "group": { "type": "string", "default": "" }
        },
        "additionalProperties": true
    }
}
```

- **`scope: "application"`** ensures the setting is user-level only, not per-workspace.
- **`required: ["name", "rootPath"]`** — minimum for a valid project entry. Other fields have defaults.
- Settings Sync handles `application`-scoped settings natively — `setKeysForSync()` is removed.
- **`additionalProperties: true`** — prevents the JSON schema validator from rejecting unknown keys in the settings editor. Note: the runtime model only contains known `Project` fields after `load()` (the second `.map()` projects to known fields only). Any unknown keys added by hand in settings.json will remain in the file until the next `save()`, at which point only known fields are written back. This is an acceptable trade-off: the schema stays lenient for editor validation, while the runtime operates on a well-defined shape.

### Localization

Add to `package.nls.json`:

```json
"projectManager.configuration.projects.description": "The list of favorite projects"
```

---

## 2. ProjectStorage Refactoring

### Constructor Change

Before:
```typescript
constructor(globalState: Memento) {
    this.globalState = globalState;
    this.projects = [];
}
```

After:
```typescript
constructor() {
    this.projects = [];
}
```

No injected dependency. Reads/writes via `vscode.workspace.getConfiguration()` directly.

### load()

```typescript
public load(): string {
    try {
        const config = vscode.workspace.getConfiguration("projectManager");
        const items = config.get<Array<Partial<Project>>>("projects", []);

        this.projects = items.map(item => ({
            name: "",
            rootPath: "",
            paths: [],
            tags: [],
            enabled: true,
            profile: "",
            group: "",
            ...item
        }));

        this.projects = this.projects.map(project => ({
            name: project.name,
            rootPath: project.rootPath,
            paths: project.paths,
            tags: project.tags,
            enabled: project.enabled,
            profile: project.profile,
            group: project.group
        }));

        this.projects = this.projects.filter(p => p.name !== "" && p.rootPath !== "");

        this.updatePaths();
        return "";
    } catch (error) {
        console.log(error);
        return error.toString();
    }
}
```

### save()

```typescript
public async save(): Promise<void> {
    try {
        const config = vscode.workspace.getConfiguration("projectManager");
        await config.update("projects", this.projects, vscode.ConfigurationTarget.Global);
    } catch (error) {
        vscode.window.showErrorMessage(
            l10n.t("Failed to save projects: {0}", error.toString())
        );
        throw error;
    }
}
```

Error handling is required: `config.update()` can fail if the settings file is read-only or inaccessible. The in-memory `projects` array may already reflect the change, so callers must be aware that a failed save means data is not persisted.

Writes to user-level settings.json via `ConfigurationTarget.Global`.

### Removed Members

- `private globalState: Memento` — removed
- Constructor parameter — removed

### Unchanged

All business logic methods remain identical: `push`, `pop`, `rename`, `editTags`, `editGroup`, `toggleEnabled`, `exists`, `existsWithRootPath`, `existsRemoteWithRootPath`, `getProjects`, `setProjects`, `map`, `getAvailableTags`, `getProjectsByTag`, `getProjectsByTags`, `disabled`, `updateRootPath`, `length`.

---

## 3. Extension Activation Changes (`extension.ts`)

### Construction

Before:
```typescript
const projectStorage: ProjectStorage = new ProjectStorage(context.globalState);
```

After:
```typescript
const projectStorage: ProjectStorage = new ProjectStorage();
```

### onDidChangeConfiguration

Add to the existing `onDidChangeConfiguration` handler:

```typescript
if (cfg.affectsConfiguration("projectManager.projects")) {
    loadProjectsFile();
    providerManager.storageProvider.refresh();
    providerManager.updateTreeViewStorage();
}
```

This enables automatic UI refresh when the user edits settings.json directly.

### Removals from extension.ts

| Item | Reason |
|------|--------|
| `context.globalState.setKeysForSync(["projectManager.projects"])` | Settings Sync handles `application`-scoped settings natively |
| `needsMigration` / `migrateFromFile` import and call block | No migration |
| `projectManager.exportProjects` command registration | Export removed |
| `projectManager.importProjects` command registration | Import removed |
| `projectManager.editProjects` command and `editProjects()` function | Was forwarding to export; both removed |
| `_projectManager.refreshFavorites` command registration | Replaced by `onDidChangeConfiguration` auto-refresh |
| `import { exportProjects, importProjects }` | Module deleted |
| `import { needsMigration, migrateFromFile }` | Module deleted |

---

## 4. File Deletions

| File | Reason |
|------|--------|
| `src/commands/exportImport.ts` | Export/Import functionality removed |
| `src/storage/migration.ts` | Legacy migration removed |

---

## 5. Package Manifest Changes (`package.json`)

### Add

- `projectManager.projects` configuration property with JSON schema (see Section 1)

### Remove

| Item | Type |
|------|------|
| `projectManager.projectsLocation` | Configuration property (deprecated) |
| `projectManager.exportProjects` | Command contribution |
| `projectManager.importProjects` | Command contribution |
| `projectManager.editProjects` | Command contribution |
| `_projectManager.refreshFavorites` | Command contribution |
| Related `menus` entries for removed commands | Menu contributions |
| Related `keybindings` for removed commands (if any) | Keybinding contributions |

### Localization Files

Remove keys for deleted commands/settings from `package.nls.json` and all `package.nls.*.json` files. Add the new `projectManager.configuration.projects.description` key.

---

## 6. Additional Affected File: `src/quickpick/projectsPicker.ts`

The `folderNotFound()` function calls `commands.executeCommand("projectManager.editProjects")` when a project has an invalid path and the user chooses "Update Project". Since `editProjects` is removed, this must be replaced.

Replacement: open VS Code settings focused on `projectManager.projects`:

```typescript
commands.executeCommand("workbench.action.openSettings", "projectManager.projects");
```

This takes the user directly to the relevant setting where they can fix the path.

---

## 7. Unchanged Components

| Component | Why Unchanged |
|-----------|---------------|
| `src/sidebar/` (`StorageProvider`, `providers.ts`, `autodetectProvider.ts`, `nodes.ts`) | Only calls `ProjectStorage` public methods; interface unchanged |
| `src/quickpick/tagsPicker.ts` | No storage dependency |
| `src/statusbar/` | Does not touch storage directly |
| `src/autodetect/` | Independent of favorites storage |
| `src/core/project.ts` | `Project` interface unchanged |
| `src/core/container.ts` | Still uses `globalState` for `recent` (UI state) |
| `src/utils/` | No storage dependency |
| `vscode-whats-new/` | Stays on globalState |

---

## 8. Testing Strategy

### Unit Tests

- **`ProjectStorage`**: Update tests to mock `vscode.workspace.getConfiguration()` instead of `Memento`. All existing business logic tests remain valid with the new mock.
- **Remove**: Migration tests, export/import tests.
- **Add**: Test that `load()` reads from configuration and `save()` writes to `ConfigurationTarget.Global`.

### Manual Validation

1. Fresh install — empty `projectManager.projects` in settings, sidebar shows empty state.
2. Save a project — verify it appears in user settings.json under `projectManager.projects`.
3. Edit settings.json directly (add/remove/rename a project) — sidebar auto-refreshes.
4. Settings Sync — verify projects sync to another machine via standard Settings Sync.
5. All sidebar operations (rename, delete, edit tags, edit group, toggle enabled) — verify each writes to settings.json correctly.
6. Status bar, Quick Pick, auto-detected projects — unaffected, still work.

---

## 9. Breaking Changes (Explicit List)

This is a major version breaking change. The following must be documented in the changelog and What's New:

1. **Project data reset** — Existing projects stored in globalState are not migrated. Users must re-add their projects or manually copy the data into `settings.json`. The release notes must prominently warn about this and provide instructions.
2. **Removed commands** — `projectManager.exportProjects`, `projectManager.importProjects`, `projectManager.editProjects`, `_projectManager.refreshFavorites`. Users with custom keybindings to these commands will see "command not found" errors.
3. **Removed setting** — `projectManager.projectsLocation` is fully removed. Users referencing this in settings will see an "unknown setting" warning.
4. **External integrations** — Other extensions or scripts calling `executeCommand("projectManager.exportProjects")` etc. will break.

---

## 10. Risk Assessment

| Risk | Mitigation |
|------|------------|
| settings.json size with large project lists | Typical project lists (hundreds of entries) are well within practical limits for settings.json |
| Breaking change for existing users | Major version bump; document in changelog and What's New |
| Settings Sync conflicts | VS Code handles settings.json merge; acceptable for project lists |
| `onDidChangeConfiguration` firing during programmatic saves | `affectsConfiguration` check is lightweight; redundant reload is harmless |
| Users accidentally break JSON syntax in settings.json | VS Code's settings editor provides validation and error highlighting via the registered JSON schema |
| Very large project lists degrade settings.json editability | Hundreds of projects is practical; for extreme cases (1000+), recommend periodic cleanup. Settings Sync merge conflicts become more likely with very large arrays |
| `onDidChangeConfiguration` fires during programmatic `save()` | The reload is idempotent (re-reads what was just written); minor redundant work but no correctness issue |
