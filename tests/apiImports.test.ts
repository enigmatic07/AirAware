import * as fs from 'fs';
import * as path from 'path';

console.log('===============================================================');
console.log('       AIRAWARE VERCEL API IMPORT & ESM RESOLUTION SUITE       ');
console.log('===============================================================\n');

let testsPassed = 0;
let testsFailed = 0;

function assert(condition: boolean, message: string) {
  if (condition) {
    console.log(`[PASS] ${message}`);
    testsPassed++;
  } else {
    console.error(`[FAIL] ${message}`);
    testsFailed++;
  }
}

// -----------------------------------------------------------------------------
// 1. STATIC CODE AUDIT: VERIFY ALL RELATIVE IMPORTS IN api/ HAVE .js EXTENSION
// -----------------------------------------------------------------------------
console.log('--- 1. STATIC IMPORT SPECIFIER & FILE EXISTENCE CHECKS ---');

function getTsFiles(dir: string): string[] {
  let results: string[] = [];
  const list = fs.readdirSync(dir);
  for (const file of list) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      results = results.concat(getTsFiles(fullPath));
    } else if (file.endsWith('.ts') && !file.endsWith('.d.ts')) {
      results.push(fullPath);
    }
  }
  return results;
}

const apiDir = path.resolve(process.cwd(), 'api');
const apiFiles = getTsFiles(apiDir);

const importRegex = /(?:import|export)\s+(?:type\s+)?(?:[\s\S]*?\sfrom\s+)?['"](\.{1,2}\/[^'"]+)['"]/g;

// Unit verification of regex coverage on standard ECMAScript patterns
const regexTestCases = [
  { code: "import { foo } from './module.js'", expected: "./module.js", desc: "Named import" },
  { code: "import type { Foo } from './types.js'", expected: "./types.js", desc: "Type-only import" },
  { code: "import './sideEffect.js'", expected: "./sideEffect.js", desc: "Side-effect import" },
  { code: "export { foo } from '../module.js'", expected: "../module.js", desc: "Re-export" },
  { code: "export type { Bar } from '../types.js'", expected: "../types.js", desc: "Type-only re-export" },
];

for (const tc of regexTestCases) {
  importRegex.lastIndex = 0;
  const m = importRegex.exec(tc.code);
  assert(
    m !== null && m[1] === tc.expected,
    `Regex validation [${tc.desc}]: "${tc.code}" accurately captures match[1] = "${tc.expected}"`
  );
}

let totalRelativeImports = 0;

for (const filePath of apiFiles) {
  const content = fs.readFileSync(filePath, 'utf8');
  const relativeFile = path.relative(process.cwd(), filePath);
  let match: RegExpExecArray | null;

  while ((match = importRegex.exec(content)) !== null) {
    totalRelativeImports++;
    const importSpecifier = match[1];

    // Check A: Does it have a .js extension?
    const hasJsExt = importSpecifier.endsWith('.js');
    assert(
      hasJsExt,
      `[${relativeFile}] Import "${importSpecifier}" must end with explicit .js extension for Vercel Node ESM runtime`
    );

    // Check B: Does the target source file (.ts) actually exist?
    const targetBase = importSpecifier.replace(/\.js$/, '.ts');
    const resolvedPath = path.resolve(path.dirname(filePath), targetBase);
    const exists = fs.existsSync(resolvedPath);
    assert(
      exists,
      `[${relativeFile}] Target source file "${path.relative(process.cwd(), resolvedPath)}" exists on disk`
    );
  }
}

console.log(`Audited ${totalRelativeImports} relative import specifiers across ${apiFiles.length} API files.`);

// -----------------------------------------------------------------------------
// 2. DYNAMIC RUNTIME IMPORT RESOLUTION: ASSISTANT & RECOMMENDATIONS
// -----------------------------------------------------------------------------
console.log('\n--- 2. DYNAMIC MODULE LOADING & DEPENDENCY RESOLUTION ---');

try {
  const assistantModule = await import('../api/assistant.js');
  assert(
    typeof assistantModule.default === 'function',
    'api/assistant.js: Dynamically resolves and exports default request handler'
  );
} catch (err: any) {
  assert(false, `api/assistant.js failed to load: ${err.message}`);
}

try {
  const recommendationsModule = await import('../api/recommendations.js');
  assert(
    typeof recommendationsModule.default === 'function',
    'api/recommendations.js: Dynamically resolves and exports default request handler'
  );
} catch (err: any) {
  assert(false, `api/recommendations.js failed to load: ${err.message}`);
}

console.log('\n===============================================================');
console.log(`IMPORT RESOLUTION AUDIT: ${testsPassed} PASSED, ${testsFailed} FAILED`);
console.log('===============================================================\n');

if (testsFailed > 0) {
  process.exit(1);
}
