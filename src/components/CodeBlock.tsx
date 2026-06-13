import { useThemeTokens } from '../theme/useTheme';
import type { HLToken } from '../lib/highlight';
import { colorFor, highlight } from '../lib/highlight';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useMemo } from 'react';
import { space } from '../theme/tokens';

type Props = {
  code: string;
  lang: string;
};

export function CodeBlock({ code, lang }: Props) {
  const { isDark, code: palette } = useThemeTokens();
  const tokens = useMemo(() => highlight(code, lang), [code, lang]);
  return (
    <View
      style={[
        styles.box,
        { backgroundColor: palette.background, borderColor: palette.border },
      ]}
    >
      {lang ? (
        <View
          style={[
            styles.langBar,
            { borderBottomColor: palette.border, backgroundColor: palette.background },
          ]}
        >
          <Text style={{ color: colorFor('comment', isDark ? 'dark' : 'light'), fontSize: 11 }}>
            {lang}
          </Text>
        </View>
      ) : null}
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <Text style={[styles.code, { fontFamily: 'JetBrainsMono_400Regular' }]}>
          {tokens.map((t, i) => (
            <Text
              key={i}
              style={{
                color: colorFor(t.kind, isDark ? 'dark' : 'light'),
                fontStyle: t.kind === 'comment' ? 'italic' : 'normal',
              }}
            >
              {t.text}
            </Text>
          ))}
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    borderRadius: 6,
    borderWidth: 1,
    marginVertical: space[3],
    overflow: 'hidden',
  },
  langBar: {
    paddingHorizontal: space[3],
    paddingVertical: space[1],
    borderBottomWidth: 1,
  },
  code: {
    fontSize: 13,
    lineHeight: 20,
    paddingHorizontal: space[3],
    paddingVertical: space[3],
  },
});

export type { HLToken };