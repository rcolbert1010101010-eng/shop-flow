import fs from 'fs';
import path from 'path';
import { getAdminEnv } from './_env.mjs';

getAdminEnv();

const envName = process.argv[2];

if (!envName) {
  console.error('Usage: node tools/admin/use-env.mjs <name>');
  process.exit(1);
}

const rootDir = process.cwd();
const sourceFile = `.env.${envName}.local`;
const destFile = '.env.local';
const sourcePath = path.join(rootDir, sourceFile);
const destPath = path.join(rootDir, destFile);

if (!fs.existsSync(sourcePath)) {
  console.error(`Source file not found: ${sourceFile}`);
  process.exit(1);
}

console.log(`copied ${sourceFile} -> ${destFile}`);

try {
  fs.copyFileSync(sourcePath, destPath);
} catch (err) {
  console.error(`Failed to copy env file: ${err?.message ?? 'unknown error'}`);
  process.exit(1);
}
