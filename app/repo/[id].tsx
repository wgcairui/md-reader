import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
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
import { buildFileTree, listMarkdownFiles, readRepoRoot, readText } from '../../src/lib/fileTree';
import { FileTree } from '../../src/components/FileTree';
import { MarkdownView } from '../../src/components/Markdown';
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
  useEffect(() => {
    if (!repo) return;
    void (async () => {
      setLoading(true);
      setErr('');
      try {
        touch(repo.id);
        const root = await readRepoRoot(repo);
        const t = await buildFileTree(root, repo.source.kind === 'local' ? repo.source.displayName : repo.source.name);
        const mds = await listMarkdownFiles(root);
        setTree(t);
        setAllMd(mds);
        // 默认打开 README
        const readme = pickReadme(mds);
        setCurrent(readme);
      } catch (e) {
        setErr(String((e as Error).message ?? e));
      } finally {
        setLoading(false);
      }
    })();
  }, [repo, touch]);

  // 加载当前文件内容
  useEffect(() => {
    if (!repo || !current) return;
    void (async () => {
      try {
        const root = await readRepoRoot(repo);
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
  }, [repo, current]);

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
              <MarkdownView
                source={content}
                onHeadingLayout={onHeadingLayout}
                onMeta={(m) => setMeta({ ...m, currentPath: current, siblingMarkdowns: allMd })}
              />
              <Pager
                allMd={allMd}
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