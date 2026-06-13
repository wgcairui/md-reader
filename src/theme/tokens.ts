/**
 * GitHub Primer 设计 tokens
 * https://primer.style/foundations/color
 * https://primer.style/foundations/typography
 */
export const colors = {
  // canvas
  canvas: {
    default: '#ffffff',
    subtle: '#f6f8fa',
    inset: '#f6f8fa',
    overlay: '#ffffff',
  },
  // 边框 / 分隔线
  border: {
    default: '#d0d7de',
    muted: '#d8dee4',
    subtle: 'rgba(31, 35, 40, 0.15)',
  },
  // 文字
  fg: {
    default: '#1f2328',
    muted: '#59636e',
    subtle: '#6e7781',
    onEmphasis: '#ffffff',
    link: '#0969da',
  },
  // 强调
  accent: {
    fg: '#0969da',
    emphasis: '#0969da',
    muted: 'rgba(9, 105, 218, 0.1)',
  },
  // 状态
  success: { fg: '#1a7f37', emphasis: '#1f883d', muted: 'rgba(26, 127, 55, 0.1)' },
  attention: { fg: '#9a6700', emphasis: '#9a6700', muted: 'rgba(154, 103, 0, 0.1)' },
  severe: { fg: '#bc4c00', emphasis: '#bc4c00', muted: 'rgba(188, 76, 0, 0.1)' },
  danger: { fg: '#d1242f', emphasis: '#cf222e', muted: 'rgba(207, 34, 46, 0.1)' },

  // 暗色
  dark: {
    canvas: {
      // 偏暖一档，配合 ColorOS 护眼模式观感更柔和
      default: '#0d1117',
      subtle: '#161b22',
      inset: '#010409',
      overlay: '#161b22',
    },
    border: {
      default: '#30363d',
      muted: '#21262d',
      subtle: 'rgba(240, 246, 252, 0.1)',
    },
    fg: {
      default: '#e6edf3',
      muted: '#9198a1',
      subtle: '#6e7681',
      onEmphasis: '#ffffff',
      link: '#2f81f7',
    },
    accent: {
      fg: '#2f81f7',
      emphasis: '#1f6feb',
      muted: 'rgba(56, 139, 253, 0.15)',
    },
    success: { fg: '#3fb950', emphasis: '#2ea043', muted: 'rgba(46, 160, 67, 0.15)' },
    attention: { fg: '#d29922', emphasis: '#9e6a03', muted: 'rgba(187, 128, 9, 0.15)' },
    severe: { fg: '#db6d28', emphasis: '#bd561d', muted: 'rgba(189, 86, 29, 0.15)' },
    danger: { fg: '#f85149', emphasis: '#da3633', muted: 'rgba(248, 81, 73, 0.15)' },
  },
} as const;

export const radii = {
  small: 4,
  medium: 6,
  large: 8,
  pill: 9999,
} as const;

export const space = {
  0: 0,
  1: 4,
  2: 8,
  3: 12,
  4: 16,
  5: 20,
  6: 24,
  8: 32,
  10: 40,
  12: 48,
} as const;

export const font = {
  // Inter / JetBrainsMono 通过 useFonts 注册；fallback 走系统字体（Android = Roboto）
  sans: 'Inter_400Regular',
  mono: 'JetBrainsMono_400Regular',
} as const;

export const text = {
  display: { size: 32, lineHeight: 40, weight: '600' as const },
  titleLg: { size: 24, lineHeight: 32, weight: '600' as const },
  title: { size: 20, lineHeight: 28, weight: '600' as const },
  bodyLg: { size: 16, lineHeight: 24, weight: '400' as const },
  body: { size: 14, lineHeight: 22, weight: '400' as const },
  small: { size: 13, lineHeight: 20, weight: '400' as const },
  micro: { size: 12, lineHeight: 16, weight: '500' as const },
} as const;

/** 代码高亮色板（GitHub Light/Dark 通用语义） */
export const codeTokens = {
  light: {
    keyword: '#cf222e',
    string: '#0a3069',
    number: '#0550ae',
    comment: '#6e7781',
    function: '#8250df',
    type: '#953800',
    variable: '#1f2328',
    punctuation: '#1f2328',
    background: '#f6f8fa',
    border: '#d0d7de',
  },
  dark: {
    keyword: '#ff7b72',
    string: '#a5d6ff',
    number: '#79c0ff',
    comment: '#8b949e',
    function: '#d2a8ff',
    type: '#ffa657',
    variable: '#e6edf3',
    punctuation: '#e6edf3',
    background: '#161b22',
    border: '#30363d',
  },
} as const;

export type Colors = typeof colors;