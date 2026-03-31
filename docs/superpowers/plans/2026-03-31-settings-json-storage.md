# Settings JSON Storage Migration — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move `projectManager.projects` from globalState to user-level settings.json, remove Export/Import and legacy migration, as a breaking change.

**Architecture:** `ProjectStorage` switches from `Memento` to `vscode.workspace.getConfiguration()`. Configuration schema added to `package.json`. `onDidChangeConfiguration` replaces manual refresh. All migration and export/import code is deleted.

**Tech Stack:** TypeScript, VS Code Extension API, Mocha tests

**Spec:** `docs/superpowers/specs/2026-03-31-settings-json-storage-design.md`

---

### Task 1: Delete Obsolete Files

**Files:**
- Delete: `src/commands/exportImport.ts`
- Delete: `src/storage/migration.ts`

- [ ] **Step 1: Delete export/import module**

Delete `src/commands/exportImport.ts`.

- [ ] **Step 2: Delete migration module**

Delete `src/storage/migration.ts`.

- [ ] **Step 3: Verify build fails expectedly**

Run: `npm run compile 2>&1 | head -30`
Expected: Compilation errors in `extension.ts` referencing deleted modules (import errors for `exportProjects`, `importProjects`, `needsMigration`, `migrateFromFile`). This confirms the files were properly referenced.

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "chore: delete exportImport.ts and migration.ts"
```

---

### Task 2: Update package.json — Add Configuration Schema, Remove Deprecated Items

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Add `projectManager.projects` configuration property**

In `package.json`, inside the `"projectManager-general"` configuration section's `"properties"` object, add the following after the existing properties (e.g. after `projectManager.groupList`):

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

- [ ] **Step 2: Remove `projectManager.projectsLocation` configuration property**

Delete the entire `projectManager.projectsLocation` block (lines ~787-792 in `package.json`):

```json
"projectManager.projectsLocation": {
    "type": "string",
    "default": "",
    "description": "%projectManager.configuration.projectsLocation.description%",
    "deprecationMessage": "Projects are now stored in synced global state. Use Export/Import commands instead."
},
```

- [ ] **Step 3: Remove command contributions for deleted commands**

Remove these command objects from the `"commands"` array in `contributes`:

1. `projectManager.editProjects` (lines ~130-134)
2. `projectManager.exportProjects` (lines ~135-139)
3. `projectManager.importProjects` (lines ~140-144)
4. `_projectManager.refreshFavorites` (lines ~193-198)

- [ ] **Step 4: Remove menu contributions for deleted commands**

Remove these entries from `"menus"`:

In `"commandPalette"`:
- `{ "command": "_projectManager.refreshFavorites", "when": "false" }` (lines ~503-505)

In `"view/title"`:
- `{ "command": "_projectManager.refreshFavorites", ... }` (lines ~514-517)
- `{ "command": "projectManager.editProjects", ... }` (lines ~519-522)

- [ ] **Step 5: Verify JSON is valid**

Run: `node -e "JSON.parse(require('fs').readFileSync('package.json','utf8')); console.log('OK')"`
Expected: `OK`

- [ ] **Step 6: Commit**

```bash
git add package.json && git commit -m "feat: add projectManager.projects config schema, remove deprecated items"
```

---

### Task 3: Update Localization Files

**Files:**
- Modify: `package.nls.json`
- Modify: `package.nls.zh-tw.json`, `package.nls.zh-cn.json`, `package.nls.pt-br.json`, `package.nls.fr.json`, `package.nls.cs.json`, `package.nls.ru.json`, `package.nls.uk.json`

- [ ] **Step 1: Update `package.nls.json`**

Remove these keys:
- `"projectManager.commands.editProjects.title"`
- `"projectManager.commands.exportProjects.title"`
- `"projectManager.commands.importProjects.title"`
- `"projectManager.commands.refreshFavorites.title"`
- `"projectManager.configuration.projectsLocation.description"`

Add this key:
- `"projectManager.configuration.projects.description": "The list of favorite projects"`

- [ ] **Step 2: Update all `package.nls.*.json` translation files**

For each of the 7 translation files, remove the same 5 keys listed in Step 1. Add the `projectManager.configuration.projects.description` key with the English value as placeholder (translations can be updated later).

- [ ] **Step 3: Commit**

```bash
git add package.nls*.json && git commit -m "chore: update localization keys for storage migration"
```

---

### Task 4: Refactor ProjectStorage

**Files:**
- Modify: `src/storage/storage.ts`

- [ ] **Step 1: Update imports**

Replace:
```typescript
import { Memento, Uri } from "vscode";
```

With:
```typescript
import * as vscode from "vscode";
import { Uri, l10n } from "vscode";
```

- [ ] **Step 2: Remove Memento from constructor**

Replace:
```typescript
export class ProjectStorage {

    private projects: Project[];
    private globalState: Memento;

    constructor(globalState: Memento) {
        this.globalState = globalState;
        this.projects = [];
    }
```

With:
```typescript
export class ProjectStorage {

    private projects: Project[];

    constructor() {
        this.projects = [];
    }
```

- [ ] **Step 3: Update `load()` method**

Replace the `load()` method body to read from configuration:

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

- [ ] **Step 4: Update `save()` method**

Replace:
```typescript
public async save(): Promise<void> {
    await this.globalState.update(STORAGE_KEY, this.projects);
}
```

With:
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

- [ ] **Step 5: Remove unused constant**

Delete this line near the top of the file:
```typescript
const STORAGE_KEY = "projectManager.projects";
```

- [ ] **Step 6: Commit**

```bash
git add src/storage/storage.ts && git commit -m "feat: refactor ProjectStorage from Memento to WorkspaceConfiguration"
```

---

### Task 5: Update extension.ts

**Files:**
- Modify: `src/extension.ts`

- [ ] **Step 1: Remove deleted imports**

Remove these import lines:
```typescript
import { needsMigration, migrateFromFile } from "./storage/migration";
import { exportProjects, importProjects } from "./commands/exportImport";
```

- [ ] **Step 2: Remove `setKeysForSync` call**

Delete this line (around line 54):
```typescript
context.globalState.setKeysForSync(["projectManager.projects"]);
```

- [ ] **Step 3: Remove migration block**

Delete the entire migration block (around lines 56-70):
```typescript
if (needsMigration(context.globalState)) {
    try {
        const projectsLocation = vscode.workspace.getConfiguration("projectManager").get<string>("projectsLocation", "");
        const result = await migrateFromFile(context.globalState, projectsLocation);
        if (result.migrated) {
            vscode.window.showInformationMessage(
                l10n.t("Projects migrated from projects.json to synced storage. ({0} projects)", result.count)
            );
        }
    } catch {
        vscode.window.showErrorMessage(
            l10n.t("Failed to migrate projects.json. You can use Import Projects to load them manually.")
        );
    }
}
```

- [ ] **Step 4: Update ProjectStorage construction**

Replace:
```typescript
const projectStorage: ProjectStorage = new ProjectStorage(context.globalState);
```

With:
```typescript
const projectStorage: ProjectStorage = new ProjectStorage();
```

- [ ] **Step 5: Remove export/import command registrations**

Delete the `editProjects` command registration:
```typescript
vscode.commands.registerCommand("projectManager.editProjects", () => editProjects());
```

Delete the `exportProjects` command registration:
```typescript
vscode.commands.registerCommand("projectManager.exportProjects", async () => { await exportProjects(projectStorage); });
```

Delete the `importProjects` command registration (multi-line block):
```typescript
vscode.commands.registerCommand("projectManager.importProjects", async () => { await importProjects(projectStorage, () => {
    loadProjectsFile();
    providerManager.storageProvider.refresh();
    providerManager.updateTreeViewStorage();
}); });
```

- [ ] **Step 6: Remove `_projectManager.refreshFavorites` command registration**

Delete:
```typescript
vscode.commands.registerCommand("_projectManager.refreshFavorites", () => {
    loadProjectsFile();
    providerManager.refreshStorageTreeView();
});
```

- [ ] **Step 7: Remove `editProjects()` function**

Delete:
```typescript
function editProjects() {
    vscode.commands.executeCommand("projectManager.exportProjects");
}
```

- [ ] **Step 8: Add `onDidChangeConfiguration` handler for projects**

Inside the existing `context.subscriptions.push(vscode.workspace.onDidChangeConfiguration(async cfg => {` block, add:

```typescript
if (cfg.affectsConfiguration("projectManager.projects")) {
    loadProjectsFile();
    providerManager.storageProvider.refresh();
    providerManager.updateTreeViewStorage();
}
```

- [ ] **Step 9: Verify compilation**

Run: `npm run compile`
Expected: No errors.

- [ ] **Step 10: Commit**

```bash
git add src/extension.ts && git commit -m "feat: wire ProjectStorage to settings.json, remove migration and export/import"
```

---

### Task 6: Update projectsPicker.ts

**Files:**
- Modify: `src/quickpick/projectsPicker.ts`

- [ ] **Step 1: Replace `editProjects` command call**

In `folderNotFound()` function (around line 44), replace:
```typescript
commands.executeCommand("projectManager.editProjects");
```

With:
```typescript
commands.executeCommand("workbench.action.openSettings", "projectManager.projects");
```

- [ ] **Step 2: Commit**

```bash
git add src/quickpick/projectsPicker.ts && git commit -m "fix: replace editProjects with openSettings in folderNotFound"
```

---

### Task 7: Update Tests

**Files:**
- Modify: `src/test/suite/storage.test.ts`
- Modify: `src/test/suite/mocks/MockMemento.ts`

- [ ] **Step 1: Create MockConfiguration helper in MockMemento.ts**

Add a `MockConfiguration` class and patch utilities to `src/test/suite/mocks/MockMemento.ts`. The mock records `ConfigurationTarget` on `update()` to allow assertions.

**Critical:** Save the real `getConfiguration` reference **once** at module level before any patching. Use `suiteSetup`/`suiteTeardown` (not per-test `setup`) to avoid re-patching with a stale reference.

```typescript
import * as vscode from "vscode";

export class MockConfiguration {
    private store = new Map<string, any>();
    public lastUpdateTarget: any = undefined;

    get<T>(key: string, defaultValue?: T): T | undefined {
        return this.store.has(key) ? this.store.get(key) : defaultValue;
    }

    update(key: string, value: any, target?: any): Thenable<void> {
        this.lastUpdateTarget = target;
        if (value === undefined) {
            this.store.delete(key);
        } else {
            this.store.set(key, value);
        }
        return Promise.resolve();
    }

    inspect() { return undefined; }
    has(section: string) { return this.store.has(section); }
}

const realGetConfiguration = vscode.workspace.getConfiguration.bind(vscode.workspace);

export function patchGetConfiguration(mockConfig: MockConfiguration): void {
    (vscode.workspace as any).getConfiguration = (section?: string) => {
        if (section === "projectManager") {
            return mockConfig;
        }
        return realGetConfiguration(section);
    };
}

export function restoreGetConfiguration(): void {
    (vscode.workspace as any).getConfiguration = realGetConfiguration;
}
```

- [ ] **Step 2: Update storage.test.ts — replace MockMemento with MockConfiguration**

Update all test cases to use the new mock. Use `suiteSetup`/`suiteTeardown` for the patch lifecycle, and `setup` to create a fresh `MockConfiguration` per test.

Replace the imports and add suite hooks:
```typescript
import { MockConfiguration, patchGetConfiguration, restoreGetConfiguration } from "./mocks/MockMemento";

suite("ProjectStorage", () => {
    let mockConfig: MockConfiguration;

    suiteSetup(() => {
        mockConfig = new MockConfiguration();
        patchGetConfiguration(mockConfig);
    });

    setup(() => {
        mockConfig = new MockConfiguration();
        patchGetConfiguration(mockConfig);
    });

    suiteTeardown(() => {
        restoreGetConfiguration();
    });
```

Then update every `new ProjectStorage(new MockMemento())` → `new ProjectStorage()` and every `new ProjectStorage(memento)` → `new ProjectStorage()`.

For tests that pre-populate data (like "load fills missing fields with defaults"), replace:
```typescript
const memento = new MockMemento();
await memento.update("projectManager.projects", [
    { name: "Legacy", rootPath: "/legacy" }
]);
const storage = new ProjectStorage(memento);
```

With:
```typescript
await mockConfig.update("projects", [
    { name: "Legacy", rootPath: "/legacy" }
]);
const storage = new ProjectStorage();
```

For "save and load" round-trip tests, the shared `mockConfig` replaces the shared `memento`:
```typescript
const storage = new ProjectStorage();
storage.push("A", "/path/a");
await storage.save();

const storage2 = new ProjectStorage();
storage2.load();
// assertions...
```

- [ ] **Step 2.5: Add ConfigurationTarget.Global assertion**

Add one test that verifies `save()` writes to `ConfigurationTarget.Global`:

```typescript
test("save writes to ConfigurationTarget.Global", async () => {
    const storage = new ProjectStorage();
    storage.push("A", "/path/a");
    await storage.save();
    assert.strictEqual(mockConfig.lastUpdateTarget, vscode.ConfigurationTarget.Global);
});
```

- [ ] **Step 3: Verify tests compile**

Run: `npm run test-compile`
Expected: No compilation errors.

- [ ] **Step 4: Run tests**

Run: `npm run test`
Expected: All tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/test/ && git commit -m "test: update storage tests for WorkspaceConfiguration"
```

---

### Task 8: Build, Lint, and Final Validation

**Files:** None (validation only)

- [ ] **Step 1: Run lint**

Run: `npm run lint`
Expected: No errors.

- [ ] **Step 2: Run full build**

Run: `npm run build`
Expected: Successful build with no errors.

- [ ] **Step 3: Run test compilation**

Run: `npm run test-compile`
Expected: No errors.

- [ ] **Step 4: Verify package.json is valid**

Run: `node -e "const p = JSON.parse(require('fs').readFileSync('package.json','utf8')); console.log('commands:', p.contributes.commands.length, 'config sections:', p.contributes.configuration.length)"`
Expected: Numbers reflecting the removed commands (4 fewer than before).

- [ ] **Step 5: Final commit if any fixes were needed**

```bash
git add -A && git commit -m "chore: fix lint and build issues from storage migration"
```
