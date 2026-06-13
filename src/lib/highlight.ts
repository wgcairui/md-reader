import { codeTokens } from '../theme/tokens';

type TokenKind =
  | 'keyword'
  | 'string'
  | 'number'
  | 'comment'
  | 'function'
  | 'type'
  | 'variable'
  | 'punctuation'
  | 'plain';

export type HLToken = { kind: TokenKind; text: string };

/**
 * 极简多语言代码高亮：覆盖 JS/TS/Python/Go/Rust/Bash/JSON/YAML/SQL
 * 设计目标：体积小、无依赖、覆盖大多数 GitHub README 代码块的视觉风格。
 * 不追求 100% 准确（很多语言共用同一份正则族），追求"看着像"。
 */
export function highlight(code: string, lang: string): HLToken[] {
  const l = lang.toLowerCase().trim();
  const rules = pickRules(l);
  return tokenize(code, rules);
}

type Rule = {
  kind: TokenKind;
  re: RegExp;
};

function pickRules(lang: string): Rule[] {
  const sharedComment: Rule[] = [
    // 行注释（// # --）— 注意要在字符串规则之后
    { kind: 'comment', re: /\/\/[^\n]*/g },
    { kind: 'comment', re: /#[^\n]*/g },
    // 块注释 /* ... */ 和 Python """ """
    { kind: 'comment', re: /\/\*[\s\S]*?\*\//g },
    { kind: 'comment', re: /"""[\s\S]*?"""/g },
  ];

  if (['js', 'jsx', 'ts', 'tsx', 'javascript', 'typescript'].includes(lang)) {
    return [
      { kind: 'string', re: /`(?:\\.|\$\{[^}]*\}|[^`\\])*`/g },
      { kind: 'string', re: /'(?:\\.|[^'\\])*'/g },
      { kind: 'string', re: /"(?:\\.|[^"\\])*"/g },
      ...sharedComment,
      {
        kind: 'keyword',
        re: /\b(const|let|var|function|return|if|else|for|while|do|switch|case|break|continue|new|class|extends|import|export|from|as|default|async|await|yield|try|catch|finally|throw|typeof|instanceof|in|of|void|null|undefined|true|false|this|super|interface|type|enum|public|private|protected|readonly|static|implements|namespace|declare|abstract|with)\b/g,
      },
      { kind: 'number', re: /\b(?:0[xX][0-9a-fA-F]+|0[bB][01]+|\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)\b/g },
      { kind: 'type', re: /\b(?:string|number|boolean|bigint|symbol|any|unknown|never|object|Array|Promise|Map|Set|Record|Partial|Required|Pick|Omit|Exclude|Extract|ReturnType|Parameters)\b/g },
      { kind: 'function', re: /\b[a-zA-Z_$][\w$]*(?=\s*\()/g },
      { kind: 'punctuation', re: /[{}[\]();,.<>:?=+\-*/%!&|^~]/g },
    ];
  }

  if (lang === 'py' || lang === 'python') {
    return [
      { kind: 'string', re: /"""[\s\S]*?"""/g },
      { kind: 'string', re: /'''[\s\S]*?'''/g },
      { kind: 'string', re: /f?"(?:\\.|[^"\\])*"/g },
      { kind: 'string', re: /f?'(?:\\.|[^'\\])*'/g },
      { kind: 'comment', re: /#[^\n]*/g },
      {
        kind: 'keyword',
        re: /\b(def|class|return|if|elif|else|for|while|in|not|and|or|is|as|from|import|with|try|except|finally|raise|pass|break|continue|yield|async|await|lambda|global|nonlocal|del|None|True|False|self)\b/g,
      },
      { kind: 'number', re: /\b\d+(?:\.\d+)?\b/g },
      { kind: 'function', re: /\b[a-zA-Z_][\w]*(?=\s*\()/g },
      { kind: 'punctuation', re: /[{}[\]();,.<>:?=+\-*/%!&|^~]/g },
    ];
  }

  if (lang === 'go' || lang === 'golang') {
    return [
      { kind: 'string', re: /"(?:\\.|[^"\\])*"/g },
      { kind: 'string', re: /`(?:\\.|[^`\\])*`/g },
      ...sharedComment,
      {
        kind: 'keyword',
        re: /\b(func|var|const|package|import|type|struct|interface|return|if|else|for|range|switch|case|default|break|continue|go|defer|select|chan|map|nil|true|false)\b/g,
      },
      { kind: 'number', re: /\b\d+(?:\.\d+)?\b/g },
      { kind: 'type', re: /\b(?:int|int8|int16|int32|int64|uint|uint8|uint16|uint32|uint64|byte|rune|string|bool|float32|float64|error|any)\b/g },
      { kind: 'function', re: /\b[a-zA-Z_][\w]*(?=\s*\()/g },
      { kind: 'punctuation', re: /[{}[\]();,.<>:?=+\-*/%!&|^~]/g },
    ];
  }

  if (lang === 'rust' || lang === 'rs') {
    return [
      { kind: 'string', re: /"(?:\\.|[^"\\])*"/g },
      { kind: 'string', re: /r#*"[^"]*"#/g },
      ...sharedComment,
      {
        kind: 'keyword',
        re: /\b(fn|let|mut|const|static|pub|use|mod|crate|self|Self|super|impl|trait|struct|enum|union|where|as|ref|in|if|else|match|for|while|loop|return|break|continue|true|false|None|Some|Ok|Err|async|await|dyn|box|unsafe|extern|type)\b/g,
      },
      { kind: 'number', re: /\b\d+(?:\.\d+)?\b/g },
      { kind: 'type', re: /\b(?:i8|i16|i32|i64|i128|isize|u8|u16|u32|u64|u128|usize|f32|f64|bool|char|str|String|Vec|Option|Result|Box|Rc|Arc|HashMap)\b/g },
      { kind: 'function', re: /\b[a-zA-Z_][\w]*(?=\s*[!(])/g },
      { kind: 'punctuation', re: /[{}[\]();,.<>:?=+\-*/%!&|^~]/g },
    ];
  }

  if (lang === 'sh' || lang === 'bash' || lang === 'shell' || lang === 'zsh') {
    return [
      { kind: 'string', re: /"(?:\\.|[^"\\])*"/g },
      { kind: 'string', re: /'(?:\\.|[^'\\])*'/g },
      { kind: 'comment', re: /#[^\n]*/g },
      {
        kind: 'keyword',
        re: /\b(if|then|else|elif|fi|for|in|do|done|while|case|esac|function|return|export|local|alias|source|echo|cd|ls|cat|grep|sed|awk|cp|mv|rm|mkdir|chmod|sudo)\b/g,
      },
      { kind: 'variable', re: /\$\{?[A-Za-z_][\w]*\}?/g },
      { kind: 'number', re: /\b\d+\b/g },
      { kind: 'punctuation', re: /[{}[\]();,.<>=+|&]/g },
    ];
  }

  if (lang === 'json') {
    return [
      { kind: 'string', re: /"(?:\\.|[^"\\])*"/g },
      ...sharedComment,
      { kind: 'keyword', re: /\b(true|false|null)\b/g },
      { kind: 'number', re: /-?\b\d+(?:\.\d+)?(?:[eE][+-]?\d+)?\b/g },
      { kind: 'punctuation', re: /[{}[\],:]/g },
    ];
  }

  if (lang === 'yaml' || lang === 'yml') {
    return [
      { kind: 'string', re: /"(?:\\.|[^"\\])*"/g },
      { kind: 'string', re: /'(?:[^'\n])*'/g },
      { kind: 'comment', re: /#[^\n]*/g },
      { kind: 'keyword', re: /^[ \t-]*[A-Za-z_][\w-]*:/gm },
      { kind: 'number', re: /\b\d+(?:\.\d+)?\b/g },
      { kind: 'punctuation', re: /[{}[\],:&*|>!]/g },
    ];
  }

  if (lang === 'sql') {
    return [
      { kind: 'string', re: /'(?:[^'\n])*'/g },
      { kind: 'string', re: /"(?:[^"\n])*"/g },
      { kind: 'comment', re: /--[^\n]*/g },
      { kind: 'comment', re: /\/\*[\s\S]*?\*\//g },
      {
        kind: 'keyword',
        re: /\b(SELECT|FROM|WHERE|INSERT|INTO|VALUES|UPDATE|SET|DELETE|CREATE|TABLE|INDEX|VIEW|DROP|ALTER|ADD|JOIN|LEFT|RIGHT|INNER|OUTER|ON|AS|AND|OR|NOT|NULL|IS|IN|EXISTS|BETWEEN|LIKE|ORDER|BY|GROUP|HAVING|LIMIT|OFFSET|UNION|ALL|DISTINCT|PRIMARY|KEY|FOREIGN|REFERENCES|UNIQUE|DEFAULT|CHECK|CASCADE)\b/gi,
      },
      { kind: 'number', re: /\b\d+(?:\.\d+)?\b/g },
      { kind: 'punctuation', re: /[{}[\]();,.<>=+\-*/%]/g },
    ];
  }

  // fallback：只标字符串和注释
  return [
    { kind: 'string', re: /"(?:\\.|[^"\\])*"/g },
    { kind: 'string', re: /'(?:\\.|[^'\\])*'/g },
    ...sharedComment,
  ];
}

function tokenize(code: string, rules: Rule[]): HLToken[] {
  // 用一组 mask 数组标记每个字符已被覆盖，避免重叠匹配
  const mask = new Uint8Array(code.length);
  const hits: { start: number; end: number; kind: TokenKind }[] = [];

  for (const rule of rules) {
    rule.re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = rule.re.exec(code))) {
      const start = m.index;
      const end = start + m[0].length;
      // 跳过已被覆盖的范围
      let ok = true;
      for (let i = start; i < end; i++) {
        if (mask[i]) {
          ok = false;
          break;
        }
      }
      if (!ok) continue;
      for (let i = start; i < end; i++) mask[i] = 1;
      hits.push({ start, end, kind: rule.kind });
      if (m[0].length === 0) rule.re.lastIndex++;
    }
  }

  hits.sort((a, b) => a.start - b.start);
  const out: HLToken[] = [];
  let pos = 0;
  for (const h of hits) {
    if (h.start > pos) out.push({ kind: 'plain', text: code.slice(pos, h.start) });
    out.push({ kind: h.kind, text: code.slice(h.start, h.end) });
    pos = h.end;
  }
  if (pos < code.length) out.push({ kind: 'plain', text: code.slice(pos) });
  return out;
}

export function colorFor(kind: TokenKind, scheme: 'light' | 'dark'): string {
  const t = scheme === 'dark' ? codeTokens.dark : codeTokens.light;
  switch (kind) {
    case 'keyword':
      return t.keyword;
    case 'string':
      return t.string;
    case 'number':
      return t.number;
    case 'comment':
      return t.comment;
    case 'function':
      return t.function;
    case 'type':
      return t.type;
    case 'variable':
      return t.variable;
    case 'punctuation':
      return t.punctuation;
    default:
      return t.variable;
  }
}