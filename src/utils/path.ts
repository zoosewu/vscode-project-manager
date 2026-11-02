/*---------------------------------------------------------------------------------------------
*  Copyright (c) Alessandro Fragnani. All rights reserved.
*  Licensed under the GPLv3 License. See License.md in the project root for license information.
*--------------------------------------------------------------------------------------------*/

"use strict";

import os = require("os");
import path = require("path");

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
}
