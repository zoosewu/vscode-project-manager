/*---------------------------------------------------------------------------------------------
*  Copyright (c) Alessandro Fragnani. All rights reserved.
*  Licensed under the GPLv3 License. See License.md in the project root for license information.
*--------------------------------------------------------------------------------------------*/

import { ExtensionContext } from "vscode";
import { HelpAndFeedbackView, Link, StandardLinksProvider } from "vscode-ext-help-and-feedback-view";

export function registerHelpAndFeedbackView(context: ExtensionContext) {
    // Links are built from the "homepage" and "bugs.url" fields in package.json
    const predefinedProvider = new StandardLinksProvider('zoosewu.project-manager-zoo');
    const items: Link[] = [
        predefinedProvider.getGetStartedLink(),
        predefinedProvider.getReviewIssuesLink(),
        predefinedProvider.getReportIssueLink(),
    ];
    new HelpAndFeedbackView(context, "projectManagerHelpAndFeedback", items);
}
