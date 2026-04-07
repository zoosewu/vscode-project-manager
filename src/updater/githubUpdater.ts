/*---------------------------------------------------------------------------------------------
*  Copyright (c) Alessandro Fragnani. All rights reserved.
*  Licensed under the GPLv3 License. See License.md in the project root for license information.
*--------------------------------------------------------------------------------------------*/

import * as fs from 'fs';
import * as https from 'https';
import * as os from 'os';
import * as path from 'path';
import * as vscode from 'vscode';
import { l10n } from 'vscode';

const EXTENSION_ID = 'zoosewu.project-manager-zoo';
const REPO = 'zoosewu/vscode-project-manager';
const GITHUB_API_LATEST = `https://api.github.com/repos/${REPO}/releases/latest`;
const UPDATE_CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000;
const LAST_UPDATE_CHECK_KEY = 'lastUpdateCheck';

interface GitHubRelease {
    tag_name: string;
    assets: Array<{ name: string; browser_download_url: string }>;
}

function httpsGetFollowRedirects(url: string): Promise<string> {
    return new Promise((resolve, reject) => {
        const options = { headers: { 'User-Agent': `vscode-extension-${EXTENSION_ID}` } };
        const request = (requestUrl: string) => {
            https.get(requestUrl, options, (res) => {
                if ((res.statusCode === 301 || res.statusCode === 302) && res.headers.location) {
                    request(res.headers.location);
                    return;
                }
                let data = '';
                res.on('data', chunk => (data += chunk));
                res.on('end', () => resolve(data));
            }).on('error', reject);
        };
        request(url);
    });
}

function downloadFileFollowRedirects(url: string, dest: string): Promise<void> {
    return new Promise((resolve, reject) => {
        const file = fs.createWriteStream(dest);
        const options = { headers: { 'User-Agent': `vscode-extension-${EXTENSION_ID}` } };
        const request = (requestUrl: string) => {
            https.get(requestUrl, options, (res) => {
                if ((res.statusCode === 301 || res.statusCode === 302) && res.headers.location) {
                    request(res.headers.location);
                    return;
                }
                res.pipe(file);
                file.on('finish', () => file.close(() => resolve()));
                file.on('error', err => {
                    fs.unlink(dest, () => undefined);
                    reject(err);
                });
            }).on('error', err => {
                fs.unlink(dest, () => undefined);
                reject(err);
            });
        };
        request(url);
    });
}

function isNewerVersion(current: string, candidate: string): boolean {
    const normalize = (v: string) => v.replace(/^v/, '').split('.').map(Number);
    const [cMaj, cMin, cPat] = normalize(current);
    const [lMaj, lMin, lPat] = normalize(candidate);
    if (lMaj !== cMaj) return lMaj > cMaj;
    if (lMin !== cMin) return lMin > cMin;
    return lPat > cPat;
}

async function fetchLatestRelease(): Promise<GitHubRelease | null> {
    try {
        const body = await httpsGetFollowRedirects(GITHUB_API_LATEST);
        return JSON.parse(body) as GitHubRelease;
    } catch {
        return null;
    }
}

export async function checkForUpdates(context: vscode.ExtensionContext): Promise<void> {
    const lastChecked = context.globalState.get<number>(LAST_UPDATE_CHECK_KEY, 0);
    if (Date.now() - lastChecked < UPDATE_CHECK_INTERVAL_MS) {
        return;
    }
    await context.globalState.update(LAST_UPDATE_CHECK_KEY, Date.now());

    const release = await fetchLatestRelease();
    if (!release?.tag_name) {
        return;
    }

    const currentVersion: string | undefined = vscode.extensions.getExtension(EXTENSION_ID)?.packageJSON?.version;
    if (!currentVersion || !isNewerVersion(currentVersion, release.tag_name)) {
        return;
    }

    const vsixAsset = release.assets.find(a => a.name.endsWith('.vsix'));
    if (!vsixAsset) {
        return;
    }

    const latestVersion = release.tag_name.replace(/^v/, '');
    const updateAction = l10n.t('Update to v{0}', latestVersion);
    const laterAction = l10n.t('Later');

    const choice = await vscode.window.showInformationMessage(
        l10n.t('Project Manager (Zoo) v{0} is available (installed: v{1}).', latestVersion, currentVersion),
        updateAction,
        laterAction
    );

    if (choice !== updateAction) {
        return;
    }

    const vsixPath = path.join(os.tmpdir(), vsixAsset.name);

    try {
        await vscode.window.withProgress(
            {
                location: vscode.ProgressLocation.Notification,
                title: l10n.t('Downloading Project Manager (Zoo) v{0}...', latestVersion),
                cancellable: false,
            },
            () => downloadFileFollowRedirects(vsixAsset.browser_download_url, vsixPath)
        );
    } catch {
        vscode.window.showErrorMessage(l10n.t('Failed to download the update. Please try again later.'));
        return;
    }

    await vscode.commands.executeCommand(
        'workbench.extensions.installExtension',
        vscode.Uri.file(vsixPath)
    );
}
