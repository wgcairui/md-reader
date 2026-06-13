import { useEffect, useMemo, useRef } from 'react';
import Markdown, { type ASTNode } from 'react-native-markdown-display';
import {
  Image,
  Linking,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { useThemeTokens } from '../theme/useTheme';
import { space } from '../theme/tokens';
import { CodeBlock } from './CodeBlock';
import type { MarkdownMeta } from '../types';

type Props = {
  source: string;
  /** 滚动事件回调：把每个 heading 的 y 坐标交出去 */
  onHeadingLayout?: (id: string, y: number) => void;
  onMeta?: (meta: MarkdownMeta) => void;
  /**
   * 链接点击 — 父组件决定如何处理：
   *  - 内部 anchor (#xxx)：onAnchorJump(id)
   *  - 相对路径 ./other.md：onSelect(absPath)
   *  - 外部 http(s)://：Linking.openURL
   * 我们在父组件做了分流，这里只透传。
   */
  onLinkPress?: (href: string) => void;
};

/**
 * GitHub 风 Markdown 渲染：
 *   - 标题层级留白、字重
 *   - 段落 line-height 1.6
 *   - 引用块左侧色条
 *   - 链接、列表、表格全部按 Primer 调色
 *   - 代码块走我们自己的 CodeBlock（带语言标签 + 自写 lexer）
 *   - 同时解析 headings 返给 TOC
 *   - 每个 heading Text 节点挂 onLayout，把 y 坐标透出
 */
export function MarkdownView({ source, onHeadingLayout, onMeta, onLinkPress }: Props) {
  const { colors, isDark } = useThemeTokens();
  const { width, height } = useWindowDimensions();
  const isLandscape = width >= height;
  const meta = useMemo(() => extractMeta(source), [source]);

  // 触发外层接收。
  // 必须用 useEffect 而不是 useMemo — useMemo 会在每次 render 同步执行
  // （包括 StrictMode double-invoke + parent 触发的 re-render），
  // 而 meta 对象每次都新引用，会让 setMeta 死循环 → 父组件 re-render → 又触发。
  // 用 useEffect 只在 deps 内容真正变化时执行一次。
  // 父组件那边也得用稳定 key 做 content diff（heading id 列表），否则会循环。
  const headingsKey = useMemo(
    () => meta.headings.map((h) => `${h.depth}:${h.id}`).join('|'),
    [meta],
  );
  const lastKeyRef = useRef<string>('');
  useEffect(() => {
    if (lastKeyRef.current === headingsKey) return;
    lastKeyRef.current = headingsKey;
    onMeta?.(meta);
  }, [headingsKey, meta, onMeta]);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        body: { color: colors.fg.default, fontFamily: 'Inter_400Regular' },
        heading1: {
          fontSize: isLandscape ? 32 : 28,
          fontWeight: '700',
          lineHeight: isLandscape ? 42 : 36,
          color: colors.fg.default,
          marginTop: space[6],
          marginBottom: space[3],
          paddingBottom: space[2],
          borderBottomWidth: 1,
          borderBottomColor: colors.border.default,
        },
        heading2: {
          fontSize: isLandscape ? 25 : 22,
          fontWeight: '600',
          lineHeight: isLandscape ? 34 : 30,
          color: colors.fg.default,
          marginTop: space[6],
          marginBottom: space[2],
          paddingBottom: space[2],
          borderBottomWidth: 1,
          borderBottomColor: colors.border.muted,
        },
        heading3: {
          fontSize: isLandscape ? 20 : 18,
          fontWeight: '600',
          lineHeight: isLandscape ? 28 : 26,
          color: colors.fg.default,
          marginTop: space[5],
          marginBottom: space[2],
        },
        heading4: {
          fontSize: isLandscape ? 17 : 16,
          fontWeight: '600',
          lineHeight: isLandscape ? 26 : 24,
          color: colors.fg.default,
          marginTop: space[4],
          marginBottom: space[1],
        },
        paragraph: {
          fontSize: isLandscape ? 17 : 16,
          lineHeight: isLandscape ? 28 : 26,
          color: colors.fg.default,
          marginTop: 0,
          marginBottom: space[3],
        },
        strong: { fontWeight: '600' },
        em: { fontStyle: 'italic' },
        link: { color: colors.fg.link, textDecorationLine: 'underline' },
        bullet_list: { marginBottom: space[3] },
        ordered_list: { marginBottom: space[3] },
        list_item: { marginVertical: 2, color: colors.fg.default },
        bullet_list_icon: { color: colors.fg.muted, marginRight: space[2] },
        code_inline: {
          fontFamily: 'JetBrainsMono_400Regular',
          fontSize: 13,
          backgroundColor: isDark ? '#161b22' : '#f6f8fa',
          color: isDark ? '#ff7b72' : '#cf222e',
          paddingHorizontal: 4,
          paddingVertical: 1,
          borderRadius: 4,
        },
        fence: {
          marginVertical: space[3],
          padding: 0,
          backgroundColor: 'transparent',
          borderWidth: 0,
        },
        blockquote: {
          marginVertical: space[3],
          paddingLeft: space[3],
          borderLeftWidth: 3,
          borderLeftColor: colors.border.default,
          color: colors.fg.muted,
        },
        table: {
          borderWidth: 1,
          borderColor: colors.border.default,
          borderRadius: 6,
          marginVertical: space[3],
        },
        thead: { backgroundColor: colors.canvas.subtle },
        th: {
          padding: space[2],
          fontWeight: '600',
          borderBottomWidth: 1,
          borderBottomColor: colors.border.default,
          color: colors.fg.default,
        },
        tr: { borderBottomWidth: 1, borderBottomColor: colors.border.muted },
        td: { padding: space[2], color: colors.fg.default },
        hr: {
          backgroundColor: colors.border.muted,
          height: 1,
          marginVertical: space[5],
        },
        image: { marginVertical: space[3] },
      }),
    [colors, isDark, isLandscape],
  );

  return (
    <View style={{ width: '100%' }}>
      <Markdown
        style={styles}
        rules={{
          fence: (node) => {
            const content = (node as unknown as { content: string }).content ?? '';
            const lang =
              (node as unknown as { info?: string }).info?.trim().split(/\s+/)[0] ?? '';
            return <CodeBlock code={content} lang={lang} />;
          },
          code_block: (node) => {
            const content = (node as unknown as { content: string }).content ?? '';
            return <CodeBlock code={content} lang="" />;
          },
          // 每个 heading 用一个 Text 包装，挂在 nativeID + onLayout
          heading1: makeHeadingRule(1, styles.heading1, onHeadingLayout),
          heading2: makeHeadingRule(2, styles.heading2, onHeadingLayout),
          heading3: makeHeadingRule(3, styles.heading3, onHeadingLayout),
          heading4: makeHeadingRule(4, styles.heading4, onHeadingLayout),
          heading5: makeHeadingRule(5, undefined, onHeadingLayout),
          heading6: makeHeadingRule(6, undefined, onHeadingLayout),
          // 自定义 link：透传 href 给父组件处理（外部/内部/相对路径）
          link: (node, children) => {
            const href = (node as unknown as { attributes: { href: string } }).attributes.href;
            return (
              <Text
                style={styles.link}
                onPress={() => {
                  if (onLinkPress) onLinkPress(href);
                  else Linking.openURL(href).catch(() => {});
                }}
              >
                {children}
              </Text>
            );
          },
          // 自定义 image：放行所有 src（含 file:// / 相对路径 / data:），
          // 用 RN Image 渲染。远程 URL + 本地文件都能用。
          image: (node) => {
            const { src, alt } = (node as unknown as { attributes: { src: string; alt?: string } })
              .attributes;
            // 拿不到宽高时给个占位高度，避免布局塌
            const fallbackW = 320;
            const fallbackH = 200;
            return (
              <View style={{ marginVertical: space[3] }}>
                <Image
                  source={
                    src.startsWith('file://') || src.startsWith('content://') || src.startsWith('data:')
                      ? { uri: src }
                      : src.startsWith('http://') || src.startsWith('https://')
                        ? { uri: src }
                        : // 相对路径原样塞，RN Image 不一定能渲染但不会让整个 markdown 崩
                          { uri: src }
                  }
                  style={{ width: '100%', minHeight: fallbackH, backgroundColor: 'transparent' }}
                  resizeMode="contain"
                  accessibilityLabel={alt}
                />
                {alt ? (
                  <Text style={{ color: colors.fg.muted, fontSize: 12, marginTop: 4, textAlign: 'center' }}>
                    {alt}
                  </Text>
                ) : null}
              </View>
            );
            // fallbackW 占位避免 lint
            void fallbackW;
          },
        }}
      >
        {source}
      </Markdown>
    </View>
  );
}

import type { TextStyle } from 'react-native';

type HeadingStyle = TextStyle | undefined;

function makeHeadingRule(
  _depth: number,
  baseStyle: HeadingStyle,
  onLayout?: (id: string, y: number) => void,
) {
  return (node: ASTNode, children: React.ReactNode) => {
    const text = collectText(node as unknown as { children?: unknown[] });
    const id = slugify(text);
    return (
      <Text
        // 用 nativeID 唯一标识；react-native Text 上的 nativeID 等同于内部 view 的 id
        // ScrollView.scrollResponderScrollNativeHandleToKeyboardDidHide 等 API
        // 通过这个 ID 找节点
        nativeID={id}
        // 暴露的 ref 用 onLayout 拿 y 坐标——RN 没有 DOM 那种 getBoundingClientRect，
        // 但 onLayout 会给出相对父节点的 (x, y)，对 ScrollView 来说就是 contentOffset 内的位置
        onLayout={(e) => {
          if (!onLayout) return;
          onLayout(id, e.nativeEvent.layout.y);
        }}
        style={baseStyle}
      >
        {children}
      </Text>
    );
  };
}

function collectText(node: { children?: unknown[] }): string {
  if (!node) return '';
  const directContent = (node as { content?: unknown }).content;
  if (typeof directContent === 'string') return directContent;
  if (!node.children) return '';
  return node.children.map((c) => collectText(c as { children?: unknown[] })).join('');
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

/** 一次扫描：headings + 行数（用于 TOC + 元信息） */
function extractMeta(source: string): MarkdownMeta {
  const lines = source.split('\n');
  const headings: MarkdownMeta['headings'] = [];
  let inFence = false;
  for (const line of lines) {
    const fence = line.match(/^```/);
    if (fence) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;
    const m = line.match(/^(#{1,6})\s+(.+?)\s*#*\s*$/);
    if (!m) continue;
    const depth = m[1].length;
    const text = m[2].trim();
    headings.push({ depth, text, id: slugify(text) });
  }
  return { headings, siblingMarkdowns: [], currentPath: '' };
}

// 阻止 TS unused warning
void Platform;