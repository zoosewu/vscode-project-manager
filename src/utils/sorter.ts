/*---------------------------------------------------------------------------------------------
*  Copyright (c) Alessandro Fragnani. All rights reserved.
*  Licensed under the GPLv3 License. See License.md in the project root for license information.
*--------------------------------------------------------------------------------------------*/

import { workspace } from "vscode";
import { Container } from "../core/container";
import { Stack } from "./stack";

interface SortableProject {
    label: string;
    description: string;
}

function sortByName<T extends SortableProject>(items: T[]): T[] {
    const itemsSorted = items.sort((n1, n2) => {
        if (n1.label.toLowerCase() > n2.label.toLowerCase()) {
            return 1;
        }

        if (n1.label.toLowerCase() < n2.label.toLowerCase()) {
            return -1;
        }

        return 0;
    });
    return itemsSorted;
}

function sortByPath<T extends SortableProject>(items: T[]): T[] {
    const itemsSorted = items.sort((n1, n2) => {
        if (n1.description > n2.description) {
            return 1;
        }

        if (n1.description < n2.description) {
            return -1;
        }

        return 0;
    });
    return itemsSorted;
}

function sortByRecent<T extends SortableProject>(items: T[], stack: Stack): T[] {

    if (stack.length() === 0) {
        return items;
    }

    const loadedProjects = items;

    for (let index = 0; index < stack.length(); index++) {
        const element: string = stack.getItem(index);

        let found = -1;
        for (let i = 0; i < loadedProjects.length; i++) {
            const itemElement = loadedProjects[ i ];
            if (itemElement.label === element) {
                found = i;
                break;
            }
        }

        if (found > -1) {
            const removedProject = loadedProjects.splice(found, 1);
            loadedProjects.unshift(removedProject[ 0 ]);
        }
    }

    return loadedProjects;
}

export function sortProjects<T extends SortableProject>(itemsToShow: T[]): T[] {
    const criteria = workspace.getConfiguration("projectManager").get<string>("sortList", "Name");
    switch (criteria) {
        case "Path":
            return sortByPath(itemsToShow);

        case "Saved":
            return itemsToShow;

        case "Recent":
            return sortByRecent(itemsToShow, Container.stack);

        default:
            return sortByName(itemsToShow);
    }
}
