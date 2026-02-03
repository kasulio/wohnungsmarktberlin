export function hashString(input: string) {
  return Bun.hash(input, 12345).toString();
}
