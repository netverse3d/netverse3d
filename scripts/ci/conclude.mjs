import { concludeRun } from './lib.mjs';

const errors = concludeRun(JSON.parse(process.env.NEEDS ?? '{}'));

for (const error of errors) console.error(error);
if (errors.length > 0) process.exitCode = 1;
else console.log('Every required job passed.');
