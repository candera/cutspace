import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

test('changelog tracks the package version and retains an Unreleased section',()=>{
 const root=new URL('../',import.meta.url),pkg=JSON.parse(readFileSync(new URL('package.json',root),'utf8'));
 const changelog=readFileSync(new URL('CHANGELOG.md',root),'utf8');
 assert.match(changelog,/^## \[Unreleased\]$/m);
 assert.match(changelog,new RegExp(`^## \\[${pkg.version.replaceAll('.','\\.')}\\] - \\d{4}-\\d{2}-\\d{2}$`,'m'));
 assert.match(changelog,/directly from this file/);
});
