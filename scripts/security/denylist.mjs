const STUDENT_ID = /\b(?:SE|SS|SA|HE|HS|CE|QE)\d{6}\b/i;

export function findMatches(name, content) {
  const findings = [];
  if (STUDENT_ID.test(name)) findings.push({ file: name, line: 0 });
  if (content.includes('\0')) return findings;
  content.split('\n').forEach((text, index) => {
    if (STUDENT_ID.test(text)) findings.push({ file: name, line: index + 1 });
  });
  return findings;
}
