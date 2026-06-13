import { useEffect } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRepoStore } from '../src/store/repoStore';
import { useThemeTokens } from '../src/theme/useTheme';
import { radii, space } from '../src/theme/tokens';
import type { Repo } from '../src/types';

export default function HomeScreen() {
  const repos = useRepoStore((s) => s.repos);
  const remove = useRepoStore((s) => s.remove);
  const router = useRouter();
  const { colors, isDark } = useThemeTokens();
  const { width } = useWindowDimensions();

  // 大屏上 2 列网格，避免卡片太宽失去信息密度
  const numColumns = width >= 900 ? 2 : 1;

  useEffect(() => {
    /* ssr-ish scaffold */
  }, []);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.canvas.default }} edges={['top']}>
      <View
        style={[
          styles.header,
          { borderBottomColor: colors.border.muted, backgroundColor: colors.canvas.overlay },
        ]}
      >
        <View style={{ flex: 1 }}>
          <Text style={[styles.brand, { color: colors.fg.default }]}>MDReader</Text>
          <Text style={[styles.tagline, { color: colors.fg.muted }]}>
            Read GitHub docs offline, in style.
          </Text>
        </View>
        <Pressable
          onPress={() => router.push('/add')}
          style={({ pressed }) => [
            styles.addBtn,
            {
              backgroundColor: pressed ? colors.accent.emphasis : colors.accent.fg,
            },
          ]}
        >
          <Text style={{ color: '#fff', fontWeight: '600', fontSize: 14 }}>+ Add</Text>
        </Pressable>
      </View>

      <FlatList
        data={repos}
        keyExtractor={(r) => r.id}
        numColumns={numColumns}
        key={numColumns /* 切换列数强制重渲 */}
        columnWrapperStyle={numColumns > 1 ? { gap: space[3] } : undefined}
        contentContainerStyle={{ padding: space[4] }}
        ItemSeparatorComponent={() => <View style={{ height: space[3] }} />}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={[styles.emptyTitle, { color: colors.fg.default }]}>No repos yet</Text>
            <Text style={[styles.emptyHint, { color: colors.fg.muted }]}>
              Tap "+ Add" to import a local folder or paste a GitHub URL.
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <RepoCard
            repo={item}
            onPress={() => router.push(`/repo/${item.id}`)}
            onRemove={() => remove(item.id)}
            isDark={isDark}
            colors={colors}
          />
        )}
      />
    </SafeAreaView>
  );
}

function RepoCard({
  repo,
  onPress,
  onRemove,
  colors,
  isDark,
}: {
  repo: Repo;
  onPress: () => void;
  onRemove: () => void;
  colors: ReturnType<typeof useThemeTokens>['colors'];
  isDark: boolean;
}) {
  const subtitle =
    repo.source.kind === 'remote'
      ? `${repo.source.owner}/${repo.source.name}`
      : repo.source.kind === 'local'
        ? `${repo.source.fileCount} file${repo.source.fileCount === 1 ? '' : 's'} · ${repo.source.displayName}`
        : '';
  const kindLabel = repo.source.kind === 'remote' ? 'GitHub' : 'Local';
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        {
          backgroundColor: colors.canvas.overlay,
          borderColor: colors.border.default,
          opacity: pressed ? 0.85 : 1,
        },
      ]}
    >
      <View style={styles.cardHead}>
        <Text style={[styles.repoName, { color: colors.fg.default }]} numberOfLines={1}>
          {repo.source.kind === 'remote' ? repo.source.name : repo.source.displayName}
        </Text>
        <View
          style={[
            styles.kindBadge,
            {
              backgroundColor:
                repo.source.kind === 'remote'
                  ? colors.accent.muted
                  : isDark
                    ? 'rgba(110, 118, 129, 0.2)'
                    : 'rgba(110, 118, 129, 0.12)',
            },
          ]}
        >
          <Text
            style={{
              color: repo.source.kind === 'remote' ? colors.accent.fg : colors.fg.muted,
              fontSize: 11,
              fontWeight: '600',
            }}
          >
            {kindLabel}
          </Text>
        </View>
      </View>
      <Text style={[styles.sub, { color: colors.fg.muted }]} numberOfLines={1}>
        {subtitle}
      </Text>
      <View style={styles.cardFoot}>
        <Text style={[styles.meta, { color: colors.fg.subtle }]}>
          Added {formatRelative(repo.addedAt)}
        </Text>
        <Pressable
          hitSlop={10}
          onPress={onRemove}
          style={({ pressed }) => [
            styles.removeBtn,
            { backgroundColor: pressed ? colors.danger.muted : 'transparent' },
          ]}
        >
          <Text style={{ color: colors.danger.fg, fontSize: 12, fontWeight: '600' }}>Remove</Text>
        </Pressable>
      </View>
    </Pressable>
  );
}

function formatRelative(ts: number): string {
  const diff = Date.now() - ts;
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d ago`;
  return new Date(ts).toLocaleDateString();
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: space[4],
    paddingVertical: space[3],
    borderBottomWidth: 1,
  },
  brand: { fontSize: 22, fontWeight: '700' },
  tagline: { fontSize: 12, marginTop: 2 },
  addBtn: {
    paddingHorizontal: space[4],
    paddingVertical: space[2],
    borderRadius: radii.medium,
  },
  card: {
    padding: space[4],
    borderRadius: radii.large,
    borderWidth: 1,
    flex: 1,
  },
  cardHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  repoName: { fontSize: 16, fontWeight: '600', flex: 1 },
  kindBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: radii.pill, marginLeft: 8 },
  sub: { fontSize: 13, marginTop: 4 },
  cardFoot: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: space[3],
  },
  meta: { fontSize: 11 },
  removeBtn: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: radii.small },
  empty: { alignItems: 'center', paddingTop: space[12] },
  emptyTitle: { fontSize: 16, fontWeight: '600' },
  emptyHint: { fontSize: 13, marginTop: 4 },
});