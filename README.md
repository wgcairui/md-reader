# MDReader

[![build-android](https://github.com/wgcairui/md-reader/actions/workflows/build.yml/badge.svg)](https://github.com/wgcairui/md-reader/actions/workflows/build.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](./LICENSE)
[![Platform: Android](https://img.shields.io/badge/Platform-Android-3DDC84?logo=android&logoColor=white)](./)
[![Expo SDK 52](https://img.shields.io/badge/Expo-SDK%2052-000020?logo=expo)](./)

一个 GitHub 风格的 Markdown 阅读器，主打 Android（也支持 iOS / Web），基于 **Expo + React Native** 开发。

使用场景：把 GitHub 项目 `git clone`（或者直接贴 URL）到平板上，想用干净、像 GitHub 一样的 UI 离线读文档。

**[⬇ 下载最新版本](https://github.com/wgcairui/md-reader/releases/latest)** ·
[截图](#screenshots) ·
[更新日志](https://github.com/wgcairui/md-reader/releases) ·
[贡献指南](#contributing)

## 主要特性

- **GitHub Primer 设计** — Inter / JetBrains Mono 字体、native color tokens、自动暗色模式
- **两种导入方式**
  - 粘贴 GitHub URL —— app 通过 `codeload.github.com` 下载 tarball，用纯 JS（`fflate` + 一个微型 USTAR 解析器）解压 `.tar.gz`，缓存到 `expo-file-system`
  - **多选本地文件** —— 通过系统文件选择器一次选多个文件。Markdown 文件（`.md` / `.markdown` / `.mdx`）变成可导航页面（带 TOC、上下页、anchor 跳转）；源码文件（`.ts` / `.tsx` / `.js` / `.py` / `.json` / `.yaml` / `.sh` / `.go` / `.rs` / `.sql`）在同一个阅读器里打开，通过 `src/lib/highlight.ts` 提供完整语法高亮。文件被组装成虚拟仓库放在 `cacheDirectory/local-imports/<id>/` 下，保留子目录结构，复用与 GitHub 导入完全相同的文件树 / 阅读器路径。**无需 prebuild，可在 Expo Go 里直接跑**
- **三栏布局**（小屏自动折叠）
  - 左侧：可折叠文件树（所有文件，不止 markdown）
  - 中间：渲染好的 markdown，带面包屑 + 上下页翻页
  - 右侧：基于 heading 的目录
- **markdown 里的链接和图片**
  - 相对链接（`./README.md`、`../other.md`）跳到同仓库的对应文件
  - 页内 anchor 链接（`#some-heading`）使用和右侧 TOC 一样的滚动逻辑
  - 外部 `http(s)://` 和 `mailto:` 链接用系统浏览器打开
  - 图片用系统 `Image` 组件渲染，支持 `file://`、`http(s)://`、`data:` 和相对路径
- **实时 TOC** —— 点击右侧 heading 跳转（带动画，顶部 24dp 留白），滚动时 active heading 跟随位置更新（用 `onLayout` + `onScroll`，不需要 DOM 那种 `getBoundingClientRect`，任何 RN 版本都工作）
- **平板优化**（针对 **OPPO Pad 4 Pro** 13.2" 3392×2400 7:5 144Hz 调优）
  - 文件树和 TOC 用 FlatList 虚拟化，滚动顺滑
  - 布局断点：≥1100dp 三个栏全显示；720–1099dp 文件树 + 中间（TOC 藏在 header 按钮后面）；<720dp（竖屏 / 手机）只显示中间，文件树 / TOC 都藏在 header 按钮后面
  - header 按钮触控目标 ≥ 44pt（Android Material 规范）
  - 横竖屏字体大小 / 行高自动缩放
  - 主页仓库卡片在 ≥900dp 宽时切到 2 列网格
  - 滚动用 `removeClippedSubviews` + `overScrollMode="never"`
- **语法高亮** —— 自写正则词法分析器，覆盖 JS/TS/Python/Go/Rust/Bash/JSON/YAML/SQL（无 native module，零额外运行时成本）
- **离线优先** —— 内容存在 `FileSystem.cacheDirectory/repos/`，app 重启不丢，3 天后失效
- **持久化仓库列表** —— AsyncStorage + Zustand 存

## Tech stack

| | |
| --- | --- |
| Runtime | Expo SDK 52, React Native 0.76, React 18 |
| Routing | `expo-router` v4 (typed routes) |
| State | `zustand` + `AsyncStorage` persist |
| FS | `expo-file-system` |
| MD | `react-native-markdown-display` + 自定义 rule 覆盖 |
| Highlight | `src/lib/highlight.ts` (自实现) |
| Tarball | `fflate` (gzip) + 手写 USTAR 解析器 |

## Run

```bash
bun install            # 或 npm/yarn/pnpm
bun start              # 启动 Expo dev server
```

然后：
- 按 `a` 启动 Android 模拟器
- 按 `i` 启动 iOS 模拟器
- 用 Expo Go 扫 QR 码在真机上跑

### 仅类型检查

```bash
bun run typecheck
```

### 本地 Android release 构建（不依赖 Expo Go）

`expo prebuild` 生成原生 `android/` 项目（已经 commit）。在本地构建签名 release APK：

```bash
# 1. JDK 17 (推荐 Temurin 17.0.13+). macOS:
brew install --cask temurin@17
# 或者从 https://adoptium.net/ 下载

# 2. Android SDK 34 + build-tools 36.1.0 + platform-tools.
#    推荐: 装 Android Studio, 然后用它的 cmdline-tools 里的 sdkmanager.
export ANDROID_HOME="$HOME/Library/Android/sdk"
export PATH="$ANDROID_HOME/platform-tools:$ANDROID_HOME/cmdline-tools/latest/bin:$PATH"

# 3. 生成本地签名 keystore (只跑一次, 不入 git):
keytool -genkeypair -v -storetype PKCS12 -keystore android/app/release.keystore \
  -alias mdreader -keyalg RSA -keysize 2048 -validity 9125 \
  -storepass mdreader2025 -keypass mdreader2025 \
  -dname "CN=MDReader, OU=Local, O=Local, L=Local, S=Local, C=CN"

# 4. 构建:
cd android
./gradlew assembleRelease
# → android/app/build/outputs/apk/release/app-release.apk

# 5. 装到连着的设备上:
adb install -r app/build/outputs/apk/release/app-release.apk
```

**关于 `patch-package`**：`patches/expo-modules-core+2.2.3.patch` 绕过 Expo SDK 52 的 `expo-modules-core` Gradle 插件中 Kotlin 1.9.24 → 1.9.25 兼容问题。`package.json` 里的 `postinstall: patch-package` 会在每次 `bun install` / `npm install` 后重新打。如果重跑 prebuild，手动跑一次 `npx patch-package`。

**EAS Build**（云端构建，作为本地构建的替代）也配好了：`eas.json` 有 `dev` / `preview` / `production` 三个 profile。跑 `npx eas build -p android --profile preview` 把构建推到 EAS。

### CI / GitHub Actions

`.github/workflows/build.yml` 在每次 push 到 `main` 和 tag `v*` 时触发：

| 触发条件 | 行为 |
| --- | --- |
| `push` to `main`, `pull_request` | 构建未签名 debug APK + 跑 `tsc --noEmit`（lint 占位） |
| `push` tag `vX.Y.Z` | 同上，**额外**：上传 `app-release.apk` + R8 mapping 作为 workflow artifact，并自动生成 notes 创建 GitHub Release |

**Tag → release 流程：**

```bash
# 1. 改 app.json 里的 version
#    "version": "0.2.0"  → "versionCode": 2

# 2. 提交 + 打 tag
git add app.json
git commit -m "release: 0.2.0"
git tag v0.2.0
git push origin main --follow-tags

# 3. 等 CI 跑完（~4 分钟），然后:
gh release view v0.2.0 --repo wgcairui/md-reader
```

**CI 必需的 secrets**（在 GitHub repo 的 Settings → Secrets → Actions）：

| Secret | 说明 |
| --- | --- |
| `MDREADER_RELEASE_KEYSTORE_BASE64` | `base64 -i android/app/release.keystore` —— 跟本地 release 构建用的 keystore 一样。如果不设，CI 退回 debug 签名（只用来测试流水线）。 |
| `MDREADER_RELEASE_KEY_ALIAS` | `mdreader` |
| `MDREADER_RELEASE_KEY_PASSWORD` | `mdreader2025`（或你设的其他） |
| `MDREADER_RELEASE_STORE_PASSWORD` | 跟 key password 一样 |

### 应用内自动更新

App 每次启动时（字体加载完之后，不阻塞首帧）会查 GitHub Releases。如果 `releases/latest` 的 semver 比 `app.json.version` 新，就弹一个 modal 提示用户下载新 APK。详见 `src/lib/autoUpdate.ts`。

- **判断标准**：最新 GitHub Release 标签 `v*`，其 `tag_name` 解析为比当前 `version` 高的 semver
- **不做的事**：不会自动装 APK。用户点"下载"按钮用系统浏览器 / package installer 打开 APK。这样避免申请 `REQUEST_INSTALL_PACKAGES` 权限，也让安装流程跟 Android 标准一致
- **限流**：GitHub 未认证 API 是 60 req/hour/IP。每次启动只查一次（每次 session 至多一次），远低于上限。如果同一个出口 IP 日活超过 60，需要走带 token 的 serverless 代理

自动更新目标仓库通过 `app.json` → `extra.update.repo` 配置（默认 `wgcairui/md-reader`）。fork 之后改这一个地方就够了。

## Project layout

```
app/                      expo-router pages
  _layout.tsx             root stack, font loading, gesture handler
  index.tsx               home: repo list + Add button
  add.tsx                 modal: pick local file or paste GitHub URL
  repo/[id].tsx           three-pane reader
src/
  components/             FileTree, MarkdownView, TableOfContents, TopBar, CodeBlock
  lib/                    fileTree.ts, github.ts (tarball), highlight.ts, autoUpdate.ts
  store/                  repoStore.ts (zustand)
  theme/                  tokens.ts, useTheme.ts
  types.ts                Repo, RepoSource, FileNode, MarkdownMeta
```

## How GitHub import works

1. 解析 URL → `{ owner, name }`
2. `GET https://codeload.github.com/{owner}/{name}/tar.gz/refs/heads/main`（fallback `master`）
3. 把响应读成 base64，解码成字节，用 `fflate` 的 `gunzipSync` 解压（codeload 返回的是 raw gzip 格式——`inflateSync` 会报 "invalid block type"，因为它是 zlib 格式）
4. 按 512 字节块走 USTAR tar header，把文件抽到 `cacheDirectory/repos/{owner}__{name}/`
5. 写一个 `.mdreader-meta.json` 让下次打开瞬间完成（3 天 TTL）

不用 `git`、不用 native module、不用额外权限。

## Known limitations / next steps

- **本地整文件夹导入**：现在的多选流程从你选的文件构建一个 *虚拟* 仓库——它拿不到 Android 文件选择器没暴露的父目录结构。要做"选整个 `docs/` 文件夹"，得接 `@react-native-documents/picker`（有 `pickDirectory()` 走 SAF tree URI）或者 `@expo/react-native-action-sheet` + 自定义 Expo Module。两条路都要 `expo prebuild`，不能在 Expo Go 里跑
- **跨文件搜索**：文件树只能按名字过滤。全文搜索得在后台 worker 里建索引
- **图片离线缓存**：图片能渲染但还没离线缓存。相对路径解析没问题，但字节每次冷启动重新拉
- **React Native 0.76 bridgeless + `crypto` polyfill**（已经处理，但升级时注意）：`react-native-get-random-values` 必须在 `app/_layout.tsx` **最顶部**（所有 import 之前）import，并且 ProGuard 必须 keep `com.bitgo.random.**`。缺任何一个，任何用 `nanoid` 的代码（包括 `expo-router` 内部）启动时会报 `Property 'crypto' doesn't exist`
- **Zustand + effect 依赖陷阱**：`useRepoStore((s) => s.get(id))` 每次 store 更新都返回新对象引用，所以任何 `useEffect([repo])` 里调 store action 都会死循环。本仓库 useEffect 的 deps 用 `repo?.id`（稳定字符串）+ ref 读最新 repo 对象，见 `app/repo/[id].tsx`

## License

MIT —— 见 [LICENSE](./LICENSE)。

## Contributing

欢迎 PR。改大一点的功能：

1. 先开 issue 描述问题 / 提案
2. Fork + 建分支（`git checkout -b feature/my-change`）
3. `npm ci`（会自动通过 `postinstall` 重打 `patches/expo-modules-core+2.2.3.patch`）
4. 改代码，有需要就加测试
5. `npm run typecheck`（目前是 `tsc --noEmit`）
6. 本地构建在真机上验过：见 [本地 Android release 构建](#本地-android-release-构建不依赖-expo-go)
7. 推上去 + 对 `main` 开 PR

发版走上面的 [Tag → release 流程](#ci--github-actions)。只有 repo secrets 里配了 `MDREADER_RELEASE_KEYSTORE_BASE64` 的 maintainer 能发版。

## AI-assisted development

本仓库大量代码——包括 bridgeless `crypto` polyfill、R8 / `proguard-rules.pro` 里 `fflate` 和 `react-native-get-random-values` 的 keep 规则、`expo-file-system` 18.x 的 `readAsStringAsync` URI 处理、Zustand `useRepoStore((s) => s.get(id))` 那种 effect 依赖陷阱、React Native `react-native-markdown-display` 的 image / link rule 覆盖、以及 GitHub Releases 自动更新模块——是在 **MiniMax-M3**（一个大型语言模型）的协助下开发的。所有生成的代码都经过项目维护者 review、测试和适配。Bug 报告和能改进 / 修正 AI 生成代码的 PR 尤其欢迎。

具体哪些 commit 有 AI 参与，看 commit 末尾的 `Co-authored-by: MiniMax-M3` trailer。
