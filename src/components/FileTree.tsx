import { useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useThemeTokens } from '../theme/useTheme';
import { radii, space } from '../theme/tokens';
import type { FileNode } from '../types';

type Props = {
  root: FileNode;
  currentPath: string | null;
  onSelect: (path: string) => void;
};

type FlatRow = {
  node: FileNode;
  depth: number;
};

/**
 * 把展开后的文件树展平成一个数组供 FlatList 渲染。
 * 性能上：单一大 list 比嵌套 View 滚动顺滑得多——尤其在 144Hz 屏上。
 */
export function FileTree({ root, currentPath, onSelect }: Props) {
  const { width } = useWindowDimensions();
  const { colors } = useThemeTokens();
  const isTablet = width >= 600;
  const nameFont = isTablet ? 14 : 13;
  const rowVPadding = isTablet ? 6 : 4;

  const [expanded, setExpanded] = useState<Set<string>>(() => {
    // 默认展开前两层
    const s = new Set<string>(['']);
    const walk = (n: FileNode, depth: number) => {
      if (depth < 2) s.add(n.path);
      for (const c of n.children ?? []) walk(c, depth + 1);
    };
    for (const c of root.children ?? []) walk(c, 1);
    return s;
  });

  const flat = useMemo(() => flatten(root, expanded), [root, expanded]);

  const toggle = (path: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });

  return (
    <FlatList
      style={{ backgroundColor: colors.canvas.subtle }}
      data={flat}
      keyExtractor={(r) => r.node.path}
      initialNumToRender={60}
      windowSize={9}
      maxToRenderPerBatch={30}
      removeClippedSubviews
      contentContainerStyle={{ paddingVertical: space[2] }}
      renderItem={({ item }) => (
        <TreeRow
          row={item}
          expanded={expanded}
          onToggle={toggle}
          onSelect={onSelect}
          currentPath={currentPath}
          nameFont={nameFont}
          rowVPadding={rowVPadding}
          isTablet={isTablet}
        />
      )}
    />
  );
}

function flatten(root: FileNode, expanded: Set<string>): FlatRow[] {
  const out: FlatRow[] = [];
  const walk = (node: FileNode, depth: number) => {
    if (node.path !== '') out.push({ node, depth });
    if (node.isDir && expanded.has(node.path)) {
      for (const c of node.children ?? []) walk(c, depth + 1);
    }
  };
  walk(root, 0);
  return out;
}

function TreeRow({
  row,
  expanded,
  onToggle,
  onSelect,
  currentPath,
  nameFont,
  rowVPadding,
  isTablet,
}: {
  row: FlatRow;
  expanded: Set<string>;
  onToggle: (path: string) => void;
  onSelect: (path: string) => void;
  currentPath: string | null;
  nameFont: number;
  rowVPadding: number;
  isTablet: boolean;
}) {
  const { colors } = useThemeTokens();
  const { node, depth } = row;
  const isOpen = node.isDir && expanded.has(node.path);
  const isActive = !node.isDir && currentPath === node.path;
  const isMd = !node.isDir && /\.(md|markdown|mdx)$/i.test(node.name);

  return (
    <Pressable
      onPress={() => {
        if (node.isDir) onToggle(node.path);
        else onSelect(node.path);
      }}
      style={({ pressed }) => [
        styles.row,
        {
          paddingLeft: space[2] + depth * (isTablet ? 16 : 14),
          paddingVertical: rowVPadding,
          backgroundColor: isActive
            ? colors.accent.muted
            : pressed
              ? colors.canvas.subtle
              : 'transparent',
        },
      ]}
    >
      <Text style={[styles.chevron, { color: colors.fg.subtle }]}>
        {node.isDir ? (isOpen ? '▾' : '▸') : ' '}
      </Text>
      <Text style={[styles.icon, { color: node.isDir ? colors.fg.muted : colors.fg.subtle }]}>
        {node.isDir ? '📁' : isMd ? '📄' : '·'}
      </Text>
      <Text
        style={[
          styles.name,
          {
            color: isActive ? colors.accent.fg : colors.fg.default,
            fontWeight: isActive ? '600' : '400',
            fontSize: nameFont,
          },
        ]}
        numberOfLines={1}
      >
        {node.name}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingRight: space[2],
    borderRadius: radii.small,
    marginHorizontal: space[1],
  },
  chevron: { width: 14, fontSize: 11, textAlign: 'center' },
  icon: { width: 18, fontSize: 13, textAlign: 'center', marginRight: 2 },
  name: { flex: 1 },
});