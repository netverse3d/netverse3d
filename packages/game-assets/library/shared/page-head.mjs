import { loadShell, mountPageHead } from './shell.mjs';

const asked = new URL(import.meta.url).searchParams;
mountPageHead(await loadShell(), asked.get('section'), Number(asked.get('view') ?? 0));
