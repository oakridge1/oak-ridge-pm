// Test-only Node resolver hook: lets plain node import our extensionless relative .ts files
// (e.g. calc.ts -> './constants'). Used by scripts/test-estimator-fixes.mjs. Not used by the app.
export async function resolve(specifier, context, nextResolve) {
  if ((specifier.startsWith('./') || specifier.startsWith('../')) && !/\.[a-z]+$/i.test(specifier)) {
    try {
      return await nextResolve(specifier + '.ts', context);
    } catch { /* fall through to the default */ }
  }
  return nextResolve(specifier, context);
}
