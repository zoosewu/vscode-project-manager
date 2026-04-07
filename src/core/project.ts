/*---------------------------------------------------------------------------------------------
*  Copyright (c) Alessandro Fragnani. All rights reserved.
*  Licensed under the GPLv3 License. See License.md in the project root for license information.
*--------------------------------------------------------------------------------------------*/

export interface Project {
    name: string;     // the name that the user defines for the project
    rootPath: string; // the root path of this project
    paths: string[];  // the 'other paths' when you have multifolder project
    enabled: boolean; // the project should be displayed in the project list
    profile: string;  // the profile to assign to the project
    group: string;    // hierarchical group path, "/" separated (e.g. "Work/Frontend")
}

export function createProject(name: string, rootPath: string, group: string = ""): Project {

    const newProject: Project = {
        name,
        rootPath,
        paths: [],
        enabled: true,
        profile: "",
        group
    };
    return newProject;
}

export function normalizeGroupPath(group: string): string {
    return group
        .trim()
        .replace(/\/+/g, "/")
        .replace(/^\/|\/$/g, "");
}

export function parseProjectInput(input: string): { name: string; group: string } {
    const lastSlash = input.lastIndexOf("/");
    if (lastSlash === -1) {
        return { name: input, group: "" };
    }
    return {
        name: input.substring(lastSlash + 1),
        group: normalizeGroupPath(input.substring(0, lastSlash))
    };
}
