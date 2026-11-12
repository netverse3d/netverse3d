interface EnvIssue {
  path: PropertyKey[];
  message: string;
}

interface EnvSchema<T> {
  safeParse(
    input: unknown,
  ): { success: true; data: T } | { success: false; error: { issues: EnvIssue[] } };
}

function withoutBlanks(
  source: Record<string, string | undefined>,
): Record<string, string | undefined> {
  return Object.fromEntries(Object.entries(source).filter(([, value]) => value !== ''));
}

export function parseEnvWith<T>(
  schema: EnvSchema<T>,
  source: Record<string, string | undefined>,
): T {
  const parsed = schema.safeParse(withoutBlanks(source));
  if (parsed.success) {
    return parsed.data;
  }
  const problems = parsed.error.issues
    .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
    .join('; ');
  throw new Error(`Invalid environment: ${problems}`);
}
