import { Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useThemeTokens } from '../theme/useTheme';
import { space } from '../theme/tokens';

export type TocItem = { id: string; text: string; depth: number };

type Props = {
  items: TocItem[];
  activeId?: string;
  onJump?: (id: string) => void;
};

export function TableOfContents({ items, activeId, onJump }: Props) {
  const { colors } = useThemeTokens();
  const { width } = useWindowDimensions();
  const isTablet = width >= 600;
  const itemFont = isTablet ? 13 : 12;

  // 过滤过深的标题（GitHub 只展示 h2/h3）
  const shown = items.filter((i) => i.depth >= 1 && i.depth <= 3);

  if (shown.length === 0) {
    return (
      <View style={styles.empty}>
        <Text style={{ color: colors.fg.subtle, fontSize: 12 }}>No headings</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={{ backgroundColor: colors.canvas.subtle }}
      contentContainerStyle={{ padding: space[3] }}
      showsVerticalScrollIndicator={false}
    >
      <Text style={[styles.title, { color: colors.fg.muted }]}>On this page</Text>
      {shown.map((it) => {
        const active = it.id === activeId;
        return (
          <Pressable
            key={it.id}
            onPress={() => onJump?.(it.id)}
            style={({ pressed }) => [
              styles.item,
              {
                paddingLeft: space[2] + (it.depth - 1) * (isTablet ? 12 : 10),
                paddingVertical: isTablet ? 6 : 4,
                backgroundColor: pressed ? colors.canvas.inset : 'transparent',
              },
            ]}
          >
            <View
              style={[
                styles.bar,
                {
                  backgroundColor: active ? colors.accent.fg : 'transparent',
                },
              ]}
            />
            <Text
              style={[
                styles.text,
                {
                  color: active ? colors.accent.fg : colors.fg.muted,
                  fontWeight: active ? '600' : '400',
                  fontSize: itemFont,
                  lineHeight: isTablet ? 20 : 18,
                },
              ]}
              numberOfLines={2}
            >
              {it.text}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  empty: { padding: space[4] },
  title: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: space[2],
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    borderRadius: 4,
  },
  bar: { width: 2, alignSelf: 'stretch', marginRight: 6, borderRadius: 1 },
  text: { fontSize: 12, lineHeight: 18, flex: 1 },
});