import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();

const readFile = (relPath) => fs.readFileSync(path.join(root, relPath), 'utf8');

const findObjectLiteral = (source, exportName) => {
  const idx = source.indexOf(`export const ${exportName}`);
  if (idx === -1) {
    throw new Error(`Missing export ${exportName}`);
  }
  const start = source.indexOf('{', idx);
  if (start === -1) {
    throw new Error(`Missing opening brace for ${exportName}`);
  }
  let depth = 0;
  for (let i = start; i < source.length; i += 1) {
    const ch = source[i];
    if (ch === '{') depth += 1;
    if (ch === '}') depth -= 1;
    if (depth === 0) {
      return source.slice(start, i + 1);
    }
  }
  throw new Error(`Unterminated object literal for ${exportName}`);
};

const extractTopLevelKeys = (body) => {
  const keys = [];
  const inner = body.slice(1, -1);
  let i = 0;
  const len = inner.length;

  const skipWhitespace = () => {
    while (i < len && /[\s,]/.test(inner[i])) i += 1;
  };

  while (i < len) {
    skipWhitespace();
    if (i >= len) break;
    const match = inner.slice(i).match(/^([A-Za-z0-9_]+)/);
    if (!match) {
      i += 1;
      continue;
    }
    const key = match[1];
    i += key.length;
    while (i < len && /\s/.test(inner[i])) i += 1;
    if (inner[i] !== ':') continue;
    keys.push(key);
    i += 1;
    let depth = 0;
    let inSingle = false;
    let inDouble = false;
    let inTemplate = false;
    while (i < len) {
      const ch = inner[i];
      const prev = inner[i - 1];
      if (inSingle) {
        if (ch === "'" && prev !== '\\') inSingle = false;
        i += 1;
        continue;
      }
      if (inDouble) {
        if (ch === '"' && prev !== '\\') inDouble = false;
        i += 1;
        continue;
      }
      if (inTemplate) {
        if (ch === '`' && prev !== '\\') inTemplate = false;
        i += 1;
        continue;
      }
      if (ch === "'") {
        inSingle = true;
        i += 1;
        continue;
      }
      if (ch === '"') {
        inDouble = true;
        i += 1;
        continue;
      }
      if (ch === '`') {
        inTemplate = true;
        i += 1;
        continue;
      }
      if (ch === '{' || ch === '[' || ch === '(') depth += 1;
      if (ch === '}' || ch === ']' || ch === ')') depth -= 1;
      if (ch === ',' && depth <= 0) {
        i += 1;
        break;
      }
      i += 1;
    }
  }

  return keys;
};

const extractEntryBlock = (objectLiteral, key) => {
  const pattern = new RegExp(`\\n\\s*${key}\\s*:`);
  const match = objectLiteral.match(pattern);
  if (!match || match.index == null) return null;
  let i = match.index + match[0].length;
  while (i < objectLiteral.length && /\s/.test(objectLiteral[i])) i += 1;
  if (objectLiteral[i] !== '{') return null;
  let depth = 0;
  const start = i;
  for (; i < objectLiteral.length; i += 1) {
    const ch = objectLiteral[i];
    if (ch === '{') depth += 1;
    if (ch === '}') depth -= 1;
    if (depth === 0) {
      return objectLiteral.slice(start, i + 1);
    }
  }
  return null;
};

const errors = [];
const isoDate = /^\d{4}-\d{2}-\d{2}$/;

const helpRegistry = readFile('src/help/helpRegistry.ts');
const docsRegistry = readFile('src/help/docsRegistry.ts');

const helpObject = findObjectLiteral(helpRegistry, 'helpByModule');
const requiredKeys = extractTopLevelKeys(helpObject);

const docMetaObject = findObjectLiteral(docsRegistry, 'docMetaByModuleKey');

for (const key of requiredKeys) {
  const entryBlock = extractEntryBlock(docMetaObject, key);
  if (!entryBlock) {
    errors.push(`Missing docMetaByModuleKey entry for help module: ${key}`);
    continue;
  }
  const pathMatch = entryBlock.match(/path\s*:\s*['\"]([^'\"]+)['\"]/);
  const titleMatch = entryBlock.match(/title\s*:\s*['\"]([^'\"]+)['\"]/);
  const updatedAtMatch = entryBlock.match(/updatedAt\s*:\s*['\"]([^'\"]+)['\"]/);

  if (!pathMatch || !titleMatch || !updatedAtMatch) {
    errors.push(`docMetaByModuleKey.${key} must include path, title, updatedAt`);
    continue;
  }

  const updatedAt = updatedAtMatch[1];
  if (!isoDate.test(updatedAt)) {
    errors.push(`Invalid updatedAt for ${key}: ${updatedAt}`);
  }
}

const pathRegex = /path\s*:\s*['\"]([^'\"]+)['\"]/g;
const seenPaths = new Set();
let match;
while ((match = pathRegex.exec(docMetaObject))) {
  const docPath = match[1];
  if (!(docPath === '/docs' || docPath.startsWith('/docs/'))) {
    errors.push(`docMetaByModuleKey path must start with /docs (got ${docPath})`);
  }
  if (seenPaths.has(docPath)) {
    errors.push(`Duplicate doc path detected: ${docPath}`);
  } else {
    seenPaths.add(docPath);
  }
}

const docsDir = path.join(root, 'src/pages/docs');
const docFiles = fs.readdirSync(docsDir).filter((name) => name.endsWith('.tsx'));

for (const filename of docFiles) {
  if (filename === 'DocsHome.tsx') continue;
  const content = readFile(`src/pages/docs/${filename}`);
  if (!content.includes('DocsLayout')) {
    errors.push(`DocsLayout missing in ${filename}`);
  }
}

if (errors.length > 0) {
  console.error('DOCS CHECK FAILED');
  for (const error of errors) {
    console.error(`- ${error}`);
  }
  process.exit(1);
}

console.log('DOCS CHECK PASS');
