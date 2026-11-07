const STUDENT_ID = '\\b(?:SE|SS|SA|HE|HS|CE|QE)\\d{6}\\b';

export function buildPatterns(extraPatterns = '') {
  const sources = [
    STUDENT_ID,
    ...extraPatterns
      .split(',')
      .map((pattern) => pattern.trim())
      .filter(Boolean),
  ];
  return sources.map((source) => new RegExp(source, 'i'));
}

export function findMatches(name, content, patterns) {
  const findings = [];
  if (patterns.some((pattern) => pattern.test(name))) findings.push({ file: name, line: 0 });
  if (content.includes('\0')) return findings;
  content.split('\n').forEach((text, index) => {
    if (patterns.some((pattern) => pattern.test(text))) {
      findings.push({ file: name, line: index + 1 });
    }
  });
  return findings;
}
