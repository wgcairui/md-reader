# MDReader

A GitHub-flavored Markdown reader for Android (and iOS / web) built with **Expo + React Native**.

Designed for the scenario where you `git clone` (or paste a URL) a project onto your tablet
and want to read the docs offline with a clean, GitHub-like UI.

## Highlights

- **GitHub Primer design** — Inter / JetBrains Mono, native color tokens, automatic dark mode
- **Two import modes**
  - Paste a GitHub URL — app downloads the tarball via `codeload.github.com`, parses `.tar.gz`
    in pure JS (`fflate` + a tiny USTAR parser), and caches to `expo-file-system`
  - **Multi-pick local files** — pick one or more files via the system file picker
    (multi-select supported). Markdown files (`.md` / `.markdown` / `.mdx`) become
    navigable pages with TOC, prev/next pager and anchor jumps; source-code files
    (`.ts` / `.tsx` / `.js` / `.py` / `.json` / `.yaml` / `.sh` / `.go` / `.rs` / `.sql`)
    open in the same reader with full syntax highlighting via `src/lib/highlight.ts`.
    Files are bundled into a virtual repo under `cacheDirectory/local-imports/<id>/`,
    preserving subdirectory structure, then reuse the exact same file-tree / reader
    path as the GitHub import. Works inside Expo Go without any native build.
- **Three-pane layout** (auto-collapses on small screens)
  - Left: collapsible file tree (all files, not just markdown)
  - Center: rendered markdown with breadcrumb + prev/next pager
  - Right: heading-based table of contents
- **Links + images in markdown**
  - Relative links (`./README.md`, `../other.md`) jump to the target file in the same repo
  - In-page anchor links (`#some-heading`) use the same TOC scroll logic as the side pane
  - External `http(s)://` and `mailto:` links open in the system browser
  - Images render with the system `Image` component, supports `file://`, `http(s)://`,
    `data:`, and relative paths
- **Live TOC**: tap a heading in the right pane to jump (animated, 24dp top inset),
  and the active heading follows your scroll position via `onLayout` + `onScroll` —
  no DOM-based `getBoundingClientRect` needed, works on every RN version
- **Tablet-optimized** (tuned for **OPPO Pad 4 Pro** 13.2" 3392×2400 7:5, 144 Hz):
  - File tree + TOC use FlatList virtualization for buttery scrolling
  - Layout breakpoints: ≥1100dp shows all three panes, 720–1099dp shows tree + center
    (TOC behind a header button), <720dp (portrait / phone) shows center only with
    tree / TOC behind header buttons
  - Touch targets ≥ 44pt on header buttons (Android Material guideline)
  - Font sizes + line heights auto-scale in landscape vs portrait
  - Home repo cards switch to 2-column grid at ≥900dp width
  - Scrolling uses `removeClippedSubviews` + `overScrollMode="never"`
- **Syntax highlighting** — handwritten regex-based lexer covering
  JS/TS/Python/Go/Rust/Bash/JSON/YAML/SQL (no native modules, no extra runtime cost)
- **Offline-first** — content lives in `FileSystem.cacheDirectory/repos/`, survives app restarts,
  invalidated after 3 days
- **Persistent library** — AsyncStorage-backed Zustand store of repos

## Tech stack

| | |
| --- | --- |
| Runtime | Expo SDK 52, React Native 0.76, React 18 |
| Routing | `expo-router` v4 (typed routes) |
| State | `zustand` + `AsyncStorage` persist |
| FS | `expo-file-system` |
| MD | `react-native-markdown-display` + custom rule overrides |
| Highlight | `src/lib/highlight.ts` (own implementation) |
| Tarball | `fflate` (gzip) + hand-rolled USTAR parser |

## Run

```bash
bun install            # or npm/yarn/pnpm
bun start              # opens Expo dev server
```

Then:
- press `a` for Android emulator
- press `i` for iOS simulator
- scan the QR code with Expo Go on a physical device

### Type-check only

```bash
bun run typecheck
```

### Local Android release build (no Expo Go)

`expo prebuild` generates the native `android/` project (already committed). To build a
signed release APK on your machine:

```bash
# 1. JDK 17 (Temurin 17.0.13+ recommended). macOS:
brew install --cask temurin@17
# Or download from https://adoptium.net/

# 2. Android SDK 34 + build-tools 36.1.0 + platform-tools.
#    Recommended: install Android Studio, then `sdkmanager` from its cmdline-tools.
export ANDROID_HOME="$HOME/Library/Android/sdk"
export PATH="$ANDROID_HOME/platform-tools:$ANDROID_HOME/cmdline-tools/latest/bin:$PATH"

# 3. Generate a local signing keystore (only once, kept out of git):
keytool -genkeypair -v -storetype PKCS12 -keystore android/app/release.keystore \
  -alias mdreader -keyalg RSA -keysize 2048 -validity 9125 \
  -storepass mdreader2025 -keypass mdreader2025 \
  -dname "CN=MDReader, OU=Local, O=Local, L=Local, S=Local, C=CN"

# 4. Build:
cd android
./gradlew assembleRelease
# → android/app/build/outputs/apk/release/app-release.apk

# 5. Install on a connected device:
adb install -r app/build/outputs/apk/release/app-release.apk
```

**Note on `patch-package`**: `patches/expo-modules-core+2.2.3.patch` works around a Kotlin
1.9.24 → 1.9.25 compatibility issue in Expo SDK 52's `expo-modules-core` Gradle plugin.
`postinstall: patch-package` in `package.json` reapplies it after every `bun install` /
`npm install`. If you re-prebuild, run `npx patch-package` once to re-apply.

**EAS Build** (cloud, alternative to local build) is also configured: `eas.json` has
`dev` / `preview` / `production` profiles. Run `npx eas build -p android --profile preview`
to push a build to EAS.

## Project layout

```
app/                      expo-router pages
  _layout.tsx             root stack, font loading, gesture handler
  index.tsx               home: repo list + Add button
  add.tsx                 modal: pick local file or paste GitHub URL
  repo/[id].tsx           three-pane reader
src/
  components/             FileTree, MarkdownView, TableOfContents, TopBar, CodeBlock
  lib/                    fileTree.ts, github.ts (tarball), highlight.ts
  store/                  repoStore.ts (zustand)
  theme/                  tokens.ts, useTheme.ts
  types.ts                Repo, RepoSource, FileNode, MarkdownMeta
```

## How GitHub import works

1. Parse the URL → `{ owner, name }`.
2. `GET https://codeload.github.com/{owner}/{name}/tar.gz/refs/heads/main` (fallback `master`).
3. Read the response as base64, decode to bytes, `gunzipSync` from `fflate` (raw gzip stream
   from `codeload.github.com` — `inflateSync` would fail with "invalid block type" because
   codeload returns gzip-wrapped data, not zlib-wrapped).
4. Walk the USTAR tar headers in 512-byte blocks, extract files into
   `cacheDirectory/repos/{owner}__{name}/`.
5. Write a `.mdreader-meta.json` so subsequent opens are instant (3-day TTL).

No `git`, no native modules, no extra permissions.

## Known limitations / next steps

- **Local whole-folder import**: the multi-pick flow builds a *virtual* repo from the files you
  select — it doesn't have access to the parent folder structure beyond what Android's file
  picker exposes. For an actual directory picker (e.g. "pick this whole `docs/` folder"),
  integrate `@react-native-documents/picker` (it has `pickDirectory()` via SAF tree URIs) or
  `@expo/react-native-action-sheet` + a custom Expo Module. Both paths require `expo prebuild`
  and won't work in Expo Go.
- **Search across files**: file tree filters by name only. A full-text search would index files
  in a background worker.
- **Image offline cache**: images are rendered but not cached offline yet. Relative image
  paths resolve correctly, but the bytes are re-fetched on every cold start.
- **React Native 0.76 bridgeless + `crypto` polyfill** (already applied in the repo, but worth
  noting if you upgrade): `react-native-get-random-values` must be imported at the very top of
  `app/_layout.tsx` (before any other import), and ProGuard must keep
  `com.bitgo.random.**`. Without either, any `nanoid`-using code (including `expo-router`
  internally) throws `Property 'crypto' doesn't exist` at app startup.
- **Zustand + effect dependency footgun**: `useRepoStore((s) => s.get(id))` returns a new
  object reference on every store update, so any `useEffect([repo])` that calls a store
  action will infinite-loop. `useEffect` deps in this repo use `repo?.id` (a stable string)
  + a ref to read the latest repo, see `app/repo/[id].tsx`.

## License

MIT