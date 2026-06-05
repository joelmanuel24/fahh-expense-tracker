import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const packageJsonPath = path.join(__dirname, '../package.json');
const swPath = path.join(__dirname, '../public/sw.js');

try {
  // 1. Read and parse package.json
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
  const oldVersion = packageJson.version || '0.0.0';
  
  // 2. Increment patch version
  const parts = oldVersion.split('.').map(Number);
  if (parts.length === 3 && !parts.some(isNaN)) {
    parts[2] += 1;
  } else {
    parts[0] = 0;
    parts[1] = 0;
    parts[2] = 1;
  }
  const newVersion = parts.join('.');
  packageJson.version = newVersion;
  
  // 3. Write package.json back
  fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2) + '\n', 'utf8');
  console.log(`[Version Auto-Increment] Incremented package.json version to: ${newVersion}`);

  // 4. Update sw.js cache name
  let swContent = fs.readFileSync(swPath, 'utf8');
  const cacheNameRegex = /const\s+CACHE_NAME\s*=\s*['"`](.*?)['"`];/;
  
  if (cacheNameRegex.test(swContent)) {
    const newCacheName = `fahh-expense-tracker-v${newVersion}`;
    swContent = swContent.replace(cacheNameRegex, `const CACHE_NAME = '${newCacheName}';`);
    fs.writeFileSync(swPath, swContent, 'utf8');
    console.log(`[Version Auto-Increment] Updated sw.js CACHE_NAME to: '${newCacheName}'`);
  } else {
    console.warn('[Version Auto-Increment] Warning: CACHE_NAME declaration not found in sw.js');
  }
} catch (err) {
  console.error('[Version Auto-Increment] Error running increment script:', err.message);
  process.exit(1);
}
