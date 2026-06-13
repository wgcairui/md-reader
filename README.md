# MDReader

A GitHub-flavored Markdown reader for Android (and iOS / web) built with **Expo + React Native**.

Designed for the scenario where you `git clone` (or paste a URL) a project onto your tablet
and want to read the docs offline with a clean, GitHub-like UI.

## Highlights

- **GitHub Primer design** — Inter / JetBrains Mono, native color tokens, automatic dark mode
- **Two import modes**
  - Paste a GitHub URL — app downloads the tarball via `codeload.github.com`, parses `.tar.gz`
    in pure JS (`fflate` + a tiny USTAR parser), and caches to `expo-file-system`
  - **Multi-pick local files** — pick one or more `.md` files via the system file picker
    (multi-select supported). We bundle them into a virtual repo under
    `cacheDirectory/local-imports/<id>/`, preserving subdirectory structure, then reuse the
    exact same file-tree / reader path as the GitHub import. Works inside Expo Go without
    any native build.
- **Three-pane layout** (auto-collapses on small screens)
  - Left: collapsible file tree
  - Center: rendered markdown with breadcrumb + prev/next pager
  - Right: heading-based table of contents
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
3. Read the file as base64, decode to bytes, `inflateRaw` from `fflate`.
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
- **Image rendering**: remote images inside markdown are rendered but not cached offline yet.

## License

MIT