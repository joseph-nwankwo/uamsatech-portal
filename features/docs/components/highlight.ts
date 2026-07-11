export type Token = { text: string; className?: string };

const CLASS = {
  keyword: "text-blue-accent",
  string: "text-chart-2",
  comment: "text-muted-foreground italic",
  number: "text-chart-3",
  punctuation: "text-muted-foreground",
  key: "text-chart-5",
  flag: "text-chart-3",
};

const TS_KEYWORDS =
  /\b(const|let|var|function|async|await|return|import|from|export|default|if|else|try|catch|new|type|interface|extends|typeof|null|undefined|true|false)\b/;

function tokenizeWithPattern(
  code: string,
  pattern: RegExp,
  classify: (match: RegExpMatchArray) => string | undefined
): Token[] {
  const tokens: Token[] = [];
  let lastIndex = 0;
  for (const match of code.matchAll(pattern)) {
    const index = match.index ?? 0;
    if (index > lastIndex) {
      tokens.push({ text: code.slice(lastIndex, index) });
    }
    tokens.push({ text: match[0], className: classify(match) });
    lastIndex = index + match[0].length;
  }
  if (lastIndex < code.length) {
    tokens.push({ text: code.slice(lastIndex) });
  }
  return tokens;
}

function highlightJson(code: string): Token[] {
  const pattern =
    /"(\\.|[^"\\])*"(\s*:)?|-?\b\d+(\.\d+)?\b|\btrue\b|\bfalse\b|\bnull\b/g;
  return tokenizeWithPattern(code, pattern, (m) => {
    const text = m[0];
    if (/"(\\.|[^"\\])*"\s*:$/.test(text)) return CLASS.key;
    if (text.startsWith('"')) return CLASS.string;
    if (text === "true" || text === "false" || text === "null")
      return CLASS.keyword;
    return CLASS.number;
  });
}

function highlightBash(code: string): Token[] {
  const pattern = /#.*$|"(\\.|[^"\\])*"|'[^']*'|\s-{1,2}[a-zA-Z][\w-]*/gm;
  return tokenizeWithPattern(code, pattern, (m) => {
    const text = m[0];
    if (text.startsWith("#")) return CLASS.comment;
    if (text.trim().startsWith("-")) return CLASS.flag;
    return CLASS.string;
  });
}

function highlightTypescript(code: string): Token[] {
  const pattern = new RegExp(
    `//.*$|"(\\\\.|[^"\\\\])*"|\`(\\\\.|[^\`\\\\])*\`|\\b\\d+(\\.\\d+)?\\b|${TS_KEYWORDS.source}`,
    "gm"
  );
  return tokenizeWithPattern(code, pattern, (m) => {
    const text = m[0];
    if (text.startsWith("//")) return CLASS.comment;
    if (text.startsWith('"') || text.startsWith("`")) return CLASS.string;
    if (/^\d/.test(text)) return CLASS.number;
    return CLASS.keyword;
  });
}

export function highlight(
  code: string,
  language: "bash" | "json" | "typescript" | "text"
): Token[] {
  switch (language) {
    case "json":
      return highlightJson(code);
    case "bash":
      return highlightBash(code);
    case "typescript":
      return highlightTypescript(code);
    default:
      return [{ text: code }];
  }
}
