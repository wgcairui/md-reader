import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useThemeTokens } from '../theme/useTheme';
import { radii, space } from '../theme/tokens';

type Props = {
  title: string;
  subtitle?: string;
  /** 是否显示返回按钮（默认 false = 无） */
  canGoBack?: boolean;
  rightSlot?: React.ReactNode;
};

export function TopBar({ title, subtitle, canGoBack, rightSlot }: Props) {
  const router = useRouter();
  const { colors } = useThemeTokens();
  return (
    <View
      style={[
        styles.bar,
        {
          backgroundColor: colors.canvas.overlay,
          borderBottomColor: colors.border.muted,
        },
      ]}
    >
      {canGoBack ? (
        <Pressable
          onPress={() => router.back()}
          hitSlop={10}
          style={({ pressed }) => [
            styles.back,
            { backgroundColor: pressed ? colors.canvas.subtle : 'transparent' },
          ]}
        >
          <Text style={{ color: colors.fg.default, fontSize: 16 }}>←</Text>
        </Pressable>
      ) : null}
      <View style={{ flex: 1 }}>
        <Text style={[styles.title, { color: colors.fg.default }]} numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? (
          <Text style={[styles.subtitle, { color: colors.fg.muted }]} numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {rightSlot}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: space[4],
    paddingVertical: space[3],
    borderBottomWidth: 1,
    gap: space[2],
  },
  back: {
    width: 32,
    height: 32,
    borderRadius: radii.medium,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { fontSize: 16, fontWeight: '600' },
  subtitle: { fontSize: 12, marginTop: 1 },
});