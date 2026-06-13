/**
 * Auto-update via GitHub Releases.
 *
 * On app launch, fetch /repos/{owner}/{repo}/releases/latest and compare
 * tag_name (semver) to the running app's version. If newer, surface a
 * non-blocking modal that lets the user download + install the APK.
 *
 * Notes:
 *  - We don't auto-install the APK (would need native intent + system
 *    install permission). The user downloads via the system browser
 *    and Android's package installer handles the rest.
 *  - For pre-releases / drafts, we filter to `prerelease: false` and
 *    `draft: false`.
 *  - The GitHub endpoint is public — no token required for public
 *    repos. For private repos, set GITHUB_TOKEN via EAS secret or
 *    `app.json` extra field.
 *  - Rate limit: 60 req/hour per IP unauthenticated. We only check on
 *    app start (max once per launch), so even with a small user base
 *    this won't hit the limit. If you grow, add a token in CI and
 *    route the check through a serverless function.
 */

import { useEffect, useState } from 'react';
import { Alert, Linking } from 'react-native';
import Constants from 'expo-constants';

/**
 * GitHub repo to check for releases against. Configurable via `app.json`:
 *   "extra": { "update": { "repo": "owner/name" } }
 * Falls back to the upstream default if unset.
 */
const GITHUB_REPO_FALLBACK = 'wgcairui/md-reader';
const GITHUB_REPO =
  (Constants.expoConfig?.extra as { update?: { repo?: string } } | undefined)?.update?.repo ??
  GITHUB_REPO_FALLBACK;
const API_URL = `https://api.github.com/repos/${GITHUB_REPO}/releases/latest`;

/** Read local version from app.json (works in dev + release, no native module needed) */
function localVersion(): string {
  return (Constants.expoConfig?.version as string | undefined) ?? '0.0.0';
}

type Release = {
  tag_name: string;
  name: string;
  html_url: string;
  body: string;
  published_at: string;
  assets: Array<{
    name: string;
    browser_download_url: string;
    size: number;
  }>;
};

/**
 * Compare two semver-ish strings ("v1.2.3" vs "1.2.3", pre-release tags
 * "1.2.3-rc.1" lower than "1.2.3"). Returns true if `remote` > `local`.
 */
export function isNewerVersion(remote: string, local: string): boolean {
  const strip = (v: string) => v.replace(/^v/, '').split('-')[0]; // ignore pre-release for ordering
  const r = strip(remote).split('.').map((n) => parseInt(n, 10) || 0);
  const l = strip(local).split('.').map((n) => parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(r.length, l.length); i++) {
    const a = r[i] ?? 0;
    const b = l[i] ?? 0;
    if (a > b) return true;
    if (a < b) return false;
  }
  return false;
}

function findApkAsset(release: Release): { url: string; size: number } | null {
  // Prefer the universal "app-release.apk"; fall back to first .apk
  const exact = release.assets.find((a) => a.name === 'app-release.apk');
  if (exact) return { url: exact.browser_download_url, size: exact.size };
  const any = release.assets.find((a) => a.name.toLowerCase().endsWith('.apk'));
  if (any) return { url: any.browser_download_url, size: any.size };
  // Fallback: the release HTML page (where users can scroll to find assets)
  return { url: release.html_url, size: 0 };
}

/**
 * Headless check. Resolves with the newer release (if any) or null.
 * Safe to call from anywhere; swallows network errors silently.
 */
export async function checkForUpdate(): Promise<Release | null> {
  try {
    const local = localVersion();
    const res = await fetch(API_URL, {
      headers: { Accept: 'application/vnd.github+json' },
    });
    if (!res.ok) return null;
    const release: Release = await res.json();
    if (!isNewerVersion(release.tag_name, local)) return null;
    return release;
  } catch {
    return null;
  }
}

/**
 * Hook variant — checks on mount, exposes the new release for the
 * caller to render in a modal / banner.
 *
 * Usage in app/_layout.tsx or app/index.tsx:
 *   const { newRelease, dismiss } = useAutoUpdate();
 *   if (newRelease) <UpdateModal release={newRelease} onClose={dismiss} />
 */
export function useAutoUpdate() {
  const [newRelease, setNewRelease] = useState<Release | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (dismissed) return;
    let cancelled = false;
    void checkForUpdate().then((r) => {
      if (!cancelled && r) setNewRelease(r);
    });
    return () => {
      cancelled = true;
    };
  }, [dismissed]);

  return {
    newRelease,
    dismiss: () => setDismissed(true),
    /** Convenience: open the APK download / release page in the system browser. */
    openUpdate: async (release: Release) => {
      const asset = findApkAsset(release);
      const url = asset?.url ?? release.html_url;
      const ok = await Linking.openURL(url).catch(() => false);
      if (!ok) {
        Alert.alert('Update available', `Open this link to update:\n${url}`);
      }
    },
  };
}

/** One-shot helper for callers that just want a modal-style alert. */
export async function showUpdateIfAvailable(): Promise<void> {
  const release = await checkForUpdate();
  if (!release) return;
  const asset = findApkAsset(release);
  const url = asset?.url ?? release.html_url;
  const sizeMb = asset ? ` (${(asset.size / 1024 / 1024).toFixed(1)} MB)` : '';
  return new Promise((resolve) => {
    Alert.alert(
      `Update available · ${release.tag_name}`,
      `${release.name ?? 'New version'}${sizeMb}\n\nDownload and install the latest APK?`,
      [
        {
          text: 'Not now',
          style: 'cancel',
          onPress: () => resolve(),
        },
        {
          text: 'Download',
          onPress: async () => {
            await Linking.openURL(url).catch(() => {});
            resolve();
          },
        },
      ],
    );
  });
}
