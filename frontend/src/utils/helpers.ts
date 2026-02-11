/** Check if a file path looks like a test file (mirrors backend _is_test_file). */
export function isTestFile(path: string): boolean {
  const parts = path.split('/');
  const fileName = parts[parts.length - 1] ?? '';
  const stem = fileName.replace(/\.[^.]+$/, '').toLowerCase();

  return (
    stem.startsWith('test_') ||
    stem.endsWith('_test') ||
    (stem.startsWith('test') && stem !== 'test') ||
    stem.endsWith('_spec') ||
    stem.endsWith('.test') ||
    stem.endsWith('.spec') ||
    parts.includes('tests') ||
    parts.includes('test') ||
    parts.includes('__tests__') ||
    parts.includes('spec')
  );
}
