/*---------------------------------------------------------------------------------------------
*  Copyright (c) Alessandro Fragnani. All rights reserved.
*  Licensed under the GPLv3 License. See License.md in the project root for license information.
*--------------------------------------------------------------------------------------------*/

"use strict";

import fs = require("fs");
import os = require("os");
import path = require("path");
import { codicons } from "vscode-ext-codicons";
import { isRemotePath } from "./remote";

export const homeDir = os.homedir();
export const HOME_PATH_VARIABLE = "$home";
export const HOME_PATH_TILDE = "~";

export class PathUtils {
    /**
     * Indicates if a path is a UNC path
     * 
     * @param path The path to check
     */
    public static pathIsUNC(path: string) {
        return path.indexOf("\\\\") === 0;
    }

    /**
     * If the project path is in the user's home directory then store the home directory as a
     * parameter. This will help in situations when the user works with the same projects on
     * different machines, under different user names.
     */
    public static compactHomePath(path: string) {
        if (path.startsWith(homeDir)) {
            return path.replace(homeDir, HOME_PATH_VARIABLE);
        }

        return path;
    }

    /**
     * Expand $home parameter from path to real os home path
     * 
     * @param path The path to expand
     */
    public static expandHomePath(inputPath: string) {
        if (inputPath.startsWith(HOME_PATH_VARIABLE)) {
            const relativePath = inputPath.substring(HOME_PATH_VARIABLE.length);
            return path.normalize(path.join(homeDir, relativePath));
        }

        if (inputPath.startsWith(HOME_PATH_TILDE)) {
            const relativePath = inputPath.substring(HOME_PATH_TILDE.length);
            return path.normalize(path.join(homeDir, relativePath));
        }

        return inputPath;
    }

    /**
     * Expand $home parameter from path to real os home path
     * 
     * @param items The array of items <QuickPickItem> to expand
     */
    public static expandHomePaths(items: any[]) {
        return items.map(item => {
            item.description = this.expandHomePath(item.description);
            return item;
        });
    }

    /**
     * Update a path to use the proper path separator, based on the Host OS
     * 
     * @param item The path <string> to update
     */
    public static updateWithPathSeparatorStr(item: string): string {
        if (path.sep === "\\") {
            return item.replace(/\//g, "\\");
        } else {
            return item.replace(/\\/g, "/");
        }
    }

    /**
     * Normalizes a path (fix \ -> \\\\)
     * 
     * @param path The path <string> to be normalized
     */
    public static normalizePath(path: string): string {
        let normalizedPath: string = path;

        if (!PathUtils.pathIsUNC(normalizedPath)) {
            const replaceable = normalizedPath.split("\\");
            normalizedPath = replaceable.join("\\\\");
        }

        return normalizedPath;
    }

    /**
     * Indicates if a path is invalid, which means "does not exists"
     * "
     * @param items The items <QuickPickItems> to check for invalid paths
     */
    public static indicateInvalidPaths(items: any[]): any[] {
        for (const element of items) {
            if (!element.detail && (!isRemotePath(element.description)) && (!fs.existsSync(element.description.toString()))) {
                element.detail = codicons.circle_slash + " Path does not exist";
            }
        }

        return items;
    }
}
