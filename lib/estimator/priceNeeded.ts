// A line whose material is above $0 but under $0.10 is a placeholder price that still needs a real one.
export function isPriceNeeded(line: { mat: number }): boolean {
  return line.mat > 0 && line.mat < 0.10;
}
