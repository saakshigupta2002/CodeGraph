// CodeGraph color palette — dark mode only
export const colors = {
  bg: '#0D0D0D',
  surface: '#1A1A1A',
  surfaceHover: '#222222',
  border: '#2A2A2A',
  borderLight: '#333333',
  textPrimary: '#E0E0E0',
  textSecondary: '#808080',
  textMuted: '#555555',
  accent: '#4A9EFF',
  accentHover: '#5AAEFF',

  // Impact
  impactDirect: '#FF6B4A',
  impactIndirect: '#FFB84D',
  impactSelected: '#FFFFFF',
  impactDimmed: '#333333',

  // Test coverage
  tested: '#4ADE80',
  untested: '#EF4444',
  partial: '#FBBF24',

  // References
  broken: '#EF4444',
  circular: '#F97316',

  // Edge colors
  edgeDefault: '#444444',
  edgeRead: '#666666',
  edgeWrite: '#F97316',

  // Node type colors
  nodeClass: '#A78BFA',
  nodeFunction: '#60A5FA',
  nodeVariable: '#34D399',
  nodeImport: '#F472B6',
  nodeFile: '#94A3B8',

  // Language badge colors
  langPython: '#3776AB',
  langJavaScript: '#F7DF1E',
  langTypeScript: '#3178C6',
  langJava: '#ED8B00',
  langGo: '#00ADD8',
  langRust: '#CE442B',
  langC: '#A8B9CC',
  langCpp: '#00599C',
  langRuby: '#CC342D',
  langPhp: '#777BB4',
} as const;

export const languageColors: Record<string, string> = {
  python: colors.langPython,
  javascript: colors.langJavaScript,
  typescript: colors.langTypeScript,
  java: colors.langJava,
  go: colors.langGo,
  rust: colors.langRust,
  c: colors.langC,
  cpp: colors.langCpp,
  ruby: colors.langRuby,
  php: colors.langPhp,
};

export const nodeTypeColors: Record<string, string> = {
  class: colors.nodeClass,
  function: colors.nodeFunction,
  variable: colors.nodeVariable,
  import: colors.nodeImport,
  file: colors.nodeFile,
  module: colors.nodeFile,
};
