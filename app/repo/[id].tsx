import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRepoStore } from '../../src/store/repoStore';
import { useThemeTokens } from '../../src/theme/useTheme';
import { radii, space } from '../../src/theme/tokens';
import { buildFileTree, listAllFiles, listMarkdownFiles, readRepoRoot, readText } from '../../src/lib/fileTree';
import { FileTree } from '../../src/components/FileTree';
import { MarkdownView } from '../../src/components/Markdown';
import { CodeBlock } from '../../src/components/CodeBlock';
import { TableOfContents, type TocItem } from '../../src/components/TableOfContents';
import type { FileNode, MarkdownMeta } from '../../src/types';

/**
 * 平板三栏布局断点（基于 OPPO Pad 4 Pro 13.2" 3392×2400 7:5 屏幕调优）：
 *   width ≥ 1100  →  FileTree + Markdown + TOC（全三栏）
 *   width ≥ 720   →  FileTree + Markdown + TOC 抽屉（横屏）
 *   width <  720  →  Markdown 单栏（竖屏/窄屏），FileTree / TOC 改用底部 sheet
 *
 * 关键改动：中间 Markdown 栏 flex:1，左右栏用固定 dp 宽度，
 * 不再以"屏宽是否够"硬塞固定宽度。
 */
const FILE_TREE_WIDTH_LAND = 280;
const FILE_TREE_WIDTH_PORT = 320;
const TOC_WIDTH_LAND = 240;
const TOC_WIDTH_PORT = 280;

export default function RepoScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { colors } = useThemeTokens();
  const { width, height } = useWindowDimensions();
  const repo = useRepoStore((s) => s.get(id ?? ''));
  const touch = useRepoStore((s) => s.touch);

  // 7:5 屏幕判断：横屏 w >= 1000、竖屏 w < 1000
  const isLandscape = width >= height;
  const isWide = width >= 720; // 文件树显示阈值
  const isVeryWide = width >= 1100; // TOC 同屏显示阈值

  const fileTreeWidth = isLandscape ? FILE_TREE_WIDTH_LAND : FILE_TREE_WIDTH_PORT;
  const tocWidth = isLandscape ? TOC_WIDTH_LAND : TOC_WIDTH_PORT;

  // 竖屏抽屉状态
  const [treeOpen, setTreeOpen] = useState(false);
  const [tocOpen, setTocOpen] = useState(false);

  // TOC 联动：heading id → 相对 ScrollView 内容区的 y 坐标
  const [headingPositions, setHeadingPositions] = useState<Map<string, number>>(new Map());
  const scrollRef = useRef<ScrollView>(null);
  const lastActiveRef = useRef<string | undefined>(undefined);

  const onHeadingLayout = (id: string, y: number) => {
    setHeadingPositions((prev) => {
      if (prev.get(id) === y) return prev;
      const next = new Map(prev);
      next.set(id, y);
      return next;
    });
  };

  const [tree, setTree] = useState<FileNode | null>(null);
  const [allMd, setAllMd] = useState<string[]>([]);
  const [allFiles, setAllFiles] = useState<string[]>([]);
  const [current, setCurrent] = useState<string | null>(null);
  const [content, setContent] = useState('');
  const [meta, setMeta] = useState<MarkdownMeta>({
    headings: [],
    siblingMarkdowns: [],
    currentPath: '',
  });
  const [activeId, setActiveId] = useState<string | undefined>();
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string>('');

  // 初始化：解析根、构建文件树
  // 关键：deps 必须用 `repo?.id`（字符串）而不是 `repo`（对象）。
  // 原因：touch() 会更新 lastOpenedAt 触发 zustand 状态变化，
  // 下次 render 时 `useRepoStore((s) => s.get(id))` 返回的 repo 对象引用变了，
  // 如果用 `repo` 当 deps 会无限循环（effect 跑 → touch → setState → re-render → 新 repo 引用 → 又跑）。
  // 用 id 字符串就稳了。repo 对象本身用 ref 拿最新值。
  const repoRef = useRef(repo);
  repoRef.current = repo;
  const touchRef = useRef(touch);
  touchRef.current = touch;

  useEffect(() => {
    const id = repoRef.current?.id;
    if (!id) return;
    void (async () => {
      setLoading(true);
      setErr('');
      try {
        const currentRepo = repoRef.current!;
        touchRef.current(id);
        const root = await readRepoRoot(currentRepo);
        const t = await buildFileTree(
          root,
          currentRepo.source.kind === 'local'
            ? currentRepo.source.displayName
            : currentRepo.source.name,
        );
        const mds = await listMarkdownFiles(root);
        const all = await listAllFiles(root);
        setTree(t);
        setAllMd(mds);
        setAllFiles(all);
        // 默认打开 README
        const readme = pickReadme(mds);
        setCurrent(readme);
      } catch (e) {
        setErr(String((e as Error).message ?? e));
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [repo?.id]);

  // 加载当前文件内容
  // 同样用 repo.id 字符串当 deps（不能直接用 repo 对象，touch() 会让它换引用）。
  useEffect(() => {
    const id = repoRef.current?.id;
    if (!id || !current) return;
    void (async () => {
      try {
        const currentRepo = repoRef.current!;
        const root = await readRepoRoot(currentRepo);
        const text = await readText(`${root}/${current}`);
        setContent(text);
        // 切文件：清位置缓存 + 滚到顶 + 重置 activeId
        setHeadingPositions(new Map());
        lastActiveRef.current = undefined;
        setActiveId(undefined);
        scrollRef.current?.scrollTo({ y: 0, animated: false });
      } catch (e) {
        setErr(String((e as Error).message ?? e));
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [repo?.id, current]);

  // 接收 MarkdownView 报上来的 headings/sibling。
  // 关键：用 content key 守护，只在 headings 真变时才 setState。
  // MarkdownView 端的 setMeta({ ...m, currentPath, siblingMarkdowns }) 每次都新对象引用，
  // 不守护的话会 setMeta → re-render → MarkdownView 重 mount → setMeta 死循环。
  const lastMetaKeyRef = useRef<string>('');
  const onMarkdownMeta = (m: MarkdownMeta) => {
    const headingsKey = m.headings.map((h) => `${h.depth}:${h.id}`).join('|');
    const fullKey = `${current}|${headingsKey}`;
    if (lastMetaKeyRef.current === fullKey) return;
    lastMetaKeyRef.current = fullKey;
    setMeta({ ...m, currentPath: current ?? '', siblingMarkdowns: allFiles });
  };

  const onSelect = (path: string) => {
    setCurrent(path);
    setActiveId(undefined);
  };

  const onJump = (anchorId: string) => {
    setActiveId(anchorId);
    const target = headingPositions.get(anchorId);
    if (target == null || !scrollRef.current) return;
    // 滚动到 heading 位置，留 24dp 头部空白，让 heading 看着不顶天
    const SCROLL_TOP_OFFSET = 24;
    scrollRef.current.scrollTo({ y: Math.max(0, target - SCROLL_TOP_OFFSET), animated: true });
    // 移动端关掉竖屏抽屉，体验更聚焦
    if (!isVeryWide) setTocOpen(false);
  };

  /**
   * Markdown 里的链接点击 — 分流三路：
   *  1. 内部 anchor (`#xxx`) → 用 onJump 走 TOC 滚动逻辑
   *  2. 相对路径 (`./other.md` 或 `other.md`) → 切到对应文件
   *  3. 外部 URL (http/https/mailto) → 系统浏览器
   * 注意：相对路径必须基于当前 current 文件的目录解析
   */
  const onMarkdownLinkPress = (href: string) => {
    // 1. 内部 anchor
    if (href.startsWith('#')) {
      const id = href.slice(1);
      onJump(id);
      return;
    }
    // 2. 相对路径
    if (!/^[a-z]+:\/\//i.test(href) && !href.startsWith('mailto:')) {
      // 基于 current 所在目录解析 `./xxx` 或 `xxx`
      const baseDir = current?.includes('/') ? current.slice(0, current.lastIndexOf('/')) : '';
      const stripped = href.replace(/^\.\//, '');
      const resolved = baseDir ? `${baseDir}/${stripped}` : stripped;
      // 简单归一化（处理 ../）
      const parts: string[] = [];
      for (const seg of resolved.split('/')) {
        if (seg === '..') parts.pop();
        else if (seg !== '.' && seg !== '') parts.push(seg);
      }
      const finalPath = parts.join('/');
      // 检查该文件是否在 allFiles 里，是的话切过去
      if (allFiles.includes(finalPath)) {
        onSelect(finalPath);
        return;
      }
      // 不在文件列表里（可能 allFiles 还没加载完），仍尝试 setCurrent
      onSelect(finalPath);
      return;
    }
    // 3. 外部 URL
    Linking.openURL(href).catch(() => {});
  };

  /**
   * 滚动时计算当前 activeId：
   *   - 把当前 visible 范围内（offset ~ offset+height）的 headings 列出来
   *   - 取最靠近顶部、且已经露出至少 30% 的那个
   *   - 没有任何 heading 露出时，保留上一个
   */
  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (headingPositions.size === 0) return;
    const { y } = e.nativeEvent.contentOffset;
    const headerHeight = 56; // Header 高度，heading 露出阈值
    let best: { id: string; y: number } | null = null;
    for (const [id, hY] of headingPositions) {
      // 距离顶部 ≤ 一屏距离 + 已经"过去"了（hY < y + headerHeight）
      if (hY <= y + headerHeight) {
        if (!best || hY > best.y) best = { id, y: hY };
      }
    }
    if (best && best.id !== lastActiveRef.current) {
      lastActiveRef.current = best.id;
      setActiveId(best.id);
    }
  };

  const title = repo?.source.kind === 'remote' ? `${repo.source.name}` : repo?.source.displayName ?? '—';
  const subtitle =
    repo?.source.kind === 'remote' ? `${repo.source.owner}/${repo.source.name}` : 'Local';

  if (!repo) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.canvas.default }}>
        <View style={styles.center}>
          <Text style={{ color: colors.fg.muted }}>Repo not found</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.canvas.default }} edges={['top']}>
      <Stack.Screen options={{ title }} />
      <Header
        title={title}
        subtitle={subtitle}
        onBack={() => router.back()}
        onTreeToggle={
          isWide || treeOpen ? undefined : () => setTreeOpen((v) => !v)
        }
        onTocToggle={
          isVeryWide || tocOpen ? undefined : () => setTocOpen((v) => !v)
        }
        colors={colors}
      />
      <View style={styles.body}>
        {/* 横屏或抽屉打开时显示 FileTree */}
        {(isWide || treeOpen) && tree ? (
          <View
            style={[
              styles.pane,
              {
                width: fileTreeWidth,
                borderRightColor: colors.border.muted,
                backgroundColor: colors.canvas.subtle,
              },
            ]}
          >
            <FileTree root={tree} currentPath={current} onSelect={onSelect} />
          </View>
        ) : null}

        <View style={[styles.pane, { flex: 1, backgroundColor: colors.canvas.default }]}>
          {loading ? (
            <View style={styles.center}>
              <ActivityIndicator color={colors.accent.fg} />
            </View>
          ) : err ? (
            <View style={styles.center}>
              <Text style={{ color: colors.danger.fg }}>{err}</Text>
            </View>
          ) : !current ? (
            <EmptyState allMd={allMd} colors={colors} onPick={onSelect} />
          ) : (
            <ScrollView
              ref={scrollRef}
              contentContainerStyle={{
                padding: isLandscape ? space[5] : space[4],
                // 大屏上让内容居中但更宽，平板体验更舒服
                maxWidth: 980,
                width: '100%',
                alignSelf: 'center',
              }}
              showsVerticalScrollIndicator={false}
              overScrollMode="never"
              removeClippedSubviews
              onScroll={onScroll}
              scrollEventThrottle={32}
            >
              {/* 当前文件路径面包屑 */}
              <Text style={{ color: colors.fg.subtle, fontSize: 11, marginBottom: space[2] }}>
                {current}
              </Text>
              {isMarkdown(current) ? (
                <MarkdownView
                  source={content}
                  onHeadingLayout={onHeadingLayout}
                  onMeta={onMarkdownMeta}
                  onLinkPress={onMarkdownLinkPress}
                />
              ) : (
                <CodeBlock code={content} lang={langFor(current)} />
              )}
              <Pager
                allMd={allFiles}
                current={current}
                onChange={onSelect}
                colors={colors}
              />
            </ScrollView>
          )}
        </View>

        {/* 横屏或抽屉打开时显示 TOC */}
        {(isVeryWide || tocOpen) ? (
          <View
            style={[
              styles.pane,
              {
                width: tocWidth,
                borderLeftColor: colors.border.muted,
                backgroundColor: colors.canvas.subtle,
              },
            ]}
          >
            <TableOfContents
              items={meta.headings as TocItem[]}
              activeId={activeId}
              onJump={onJump}
            />
          </View>
        ) : null}
      </View>
    </SafeAreaView>
  );
}

function pickReadme(mds: string[]): string | null {
  if (mds.length === 0) return null;
  const candidates = ['README.md', 'readme.md', 'Readme.md', 'index.md', 'docs/README.md'];
  for (const c of candidates) {
    const hit = mds.find((p) => p.toLowerCase() === c.toLowerCase());
    if (hit) return hit;
  }
  return mds[0];
}

/** 是否走 Markdown 渲染。.md / .markdown / .mdx 走 MarkdownView，其他走 CodeBlock */
function isMarkdown(path: string): boolean {
  return /\.(md|markdown|mdx)$/i.test(path);
}

/** 文件扩展名 → CodeBlock 的 lang。命中 highlight 支持的语言集才返回，否则传 '' 让高亮走 fallback */
function langFor(path: string): string {
  const ext = path.split('.').pop()?.toLowerCase() ?? '';
  const map: Record<string, string> = {
    ts: 'ts',
    tsx: 'ts',
    js: 'js',
    jsx: 'js',
    mjs: 'js',
    cjs: 'js',
    py: 'py',
    json: 'json',
    yaml: 'yaml',
    yml: 'yaml',
    sh: 'sh',
    bash: 'bash',
    zsh: 'sh',
    go: 'go',
    rs: 'rust',
    sql: 'sql',
  };
  return map[ext] ?? '';
}

function Header({
  title,
  subtitle,
  onBack,
  onTreeToggle,
  onTocToggle,
  colors,
}: {
  title: string;
  subtitle: string;
  onBack: () => void;
  onTreeToggle?: () => void;
  onTocToggle?: () => void;
  colors: ReturnType<typeof useThemeTokens>['colors'];
}) {
  // 平板触控目标 ≥ 44pt
  return (
    <View
      style={[
        styles.header,
        {
          backgroundColor: colors.canvas.overlay,
          borderBottomColor: colors.border.muted,
        },
      ]}
    >
      <Pressable
        onPress={onBack}
        hitSlop={12}
        style={({ pressed }) => [
          styles.headerBtn,
          { backgroundColor: pressed ? colors.canvas.subtle : 'transparent' },
        ]}
      >
        <Text style={{ color: colors.fg.default, fontSize: 18 }}>←</Text>
      </Pressable>
      <View style={{ flex: 1 }}>
        <Text style={{ color: colors.fg.default, fontSize: 15, fontWeight: '600' }} numberOfLines={1}>
          {title}
        </Text>
        <Text style={{ color: colors.fg.muted, fontSize: 11 }} numberOfLines={1}>
          {subtitle}
        </Text>
      </View>
      {onTreeToggle ? (
        <Pressable
          onPress={onTreeToggle}
          hitSlop={12}
          style={({ pressed }) => [
            styles.headerBtn,
            { backgroundColor: pressed ? colors.canvas.subtle : 'transparent' },
          ]}
        >
          <Text style={{ color: colors.fg.default, fontSize: 14, fontWeight: '600' }}>Files</Text>
        </Pressable>
      ) : null}
      {onTocToggle ? (
        <Pressable
          onPress={onTocToggle}
          hitSlop={12}
          style={({ pressed }) => [
            styles.headerBtn,
            { backgroundColor: pressed ? colors.canvas.subtle : 'transparent' },
          ]}
        >
          <Text style={{ color: colors.fg.default, fontSize: 14, fontWeight: '600' }}>Toc</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function EmptyState({
  allMd,
  colors,
  onPick,
}: {
  allMd: string[];
  colors: ReturnType<typeof useThemeTokens>['colors'];
  onPick: (p: string) => void;
}) {
  if (allMd.length === 0) {
    return (
      <View style={styles.center}>
        <Text style={{ color: colors.fg.muted }}>No markdown files found in this repo.</Text>
      </View>
    );
  }
  return (
    <ScrollView contentContainerStyle={{ padding: space[4] }}>
      <Text style={[styles.sectionTitle, { color: colors.fg.muted }]}>FILES</Text>
      {allMd.map((p) => (
        <Pressable
          key={p}
          onPress={() => onPick(p)}
          style={({ pressed }) => [
            styles.mdItem,
            {
              borderBottomColor: colors.border.muted,
              backgroundColor: pressed ? colors.canvas.subtle : 'transparent',
            },
          ]}
        >
          <Text style={{ color: colors.fg.default, fontSize: 14 }} numberOfLines={1}>
            📄 {p}
          </Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}

function Pager({
  allMd,
  current,
  onChange,
  colors,
}: {
  allMd: string[];
  current: string;
  onChange: (p: string) => void;
  colors: ReturnType<typeof useThemeTokens>['colors'];
}) {
  // 跨所有文件（不只是 markdown）：按 allMd 顺序 prev/next
  const idx = allMd.indexOf(current);
  const prev = idx > 0 ? allMd[idx - 1] : null;
  const next = idx >= 0 && idx < allMd.length - 1 ? allMd[idx + 1] : null;
  if (!prev && !next) return null;
  return (
    <View
      style={[
        styles.pager,
        {
          borderTopColor: colors.border.muted,
          backgroundColor: colors.canvas.subtle,
        },
      ]}
    >
      <Pressable
        disabled={!prev}
        onPress={() => prev && onChange(prev)}
        style={({ pressed }) => [styles.pagerBtn, { opacity: prev ? (pressed ? 0.6 : 1) : 0.3 }]}
      >
        <Text style={{ color: colors.fg.muted, fontSize: 11 }}>← Previous</Text>
        <Text style={{ color: colors.fg.default, fontSize: 13 }} numberOfLines={1}>
          {prev ? prev.split('/').pop() : '—'}
        </Text>
      </Pressable>
      <Pressable
        disabled={!next}
        onPress={() => next && onChange(next)}
        style={({ pressed }) => [styles.pagerBtn, { opacity: next ? (pressed ? 0.6 : 1) : 0.3 }]}
      >
        <Text style={{ color: colors.fg.muted, fontSize: 11, textAlign: 'right' }}>Next →</Text>
        <Text
          style={{ color: colors.fg.default, fontSize: 13, textAlign: 'right' }}
          numberOfLines={1}
        >
          {next ? next.split('/').pop() : '—'}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: space[3],
    paddingVertical: space[3],
    borderBottomWidth: 1,
    gap: space[2],
  },
  headerBtn: {
    minWidth: 44,
    height: 44,
    paddingHorizontal: space[3],
    borderRadius: radii.medium,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: { flex: 1, flexDirection: 'row' },
  pane: { borderRightWidth: 0 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: space[4] },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginBottom: space[2],
  },
  mdItem: { paddingVertical: space[3], borderBottomWidth: 1 },
  pager: {
    marginTop: space[8],
    paddingTop: space[4],
    borderTopWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: space[3],
  },
  pagerBtn: { flex: 1 },
});