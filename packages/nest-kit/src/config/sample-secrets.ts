const SAMPLE_SECRET =
  /change-?me|local-development|local-only|^dev-|^(00112233445566778899aabbccddeeff)+$/i;

export function sampleSecretNames(
  env: Record<string, unknown>,
  names: readonly string[],
): string[] {
  return names.filter((name) => {
    const value = env[name];
    return typeof value === 'string' && SAMPLE_SECRET.test(value);
  });
}
