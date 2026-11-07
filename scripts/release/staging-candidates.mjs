import { listTags } from './git-facts.mjs';
import { parseTag, stagingTagsUpTo } from './lib.mjs';

const parsed = parseTag(process.argv[2] ?? '');
if (!parsed) {
  console.error('Usage: node scripts/release/staging-candidates.mjs prod-v1.4.0');
  process.exitCode = 1;
} else {
  for (const tag of stagingTagsUpTo(listTags(process.cwd()), parsed.version)) console.log(tag);
}
