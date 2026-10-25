'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '..', 'src', 'js', 'records.js'), 'utf8');
const context = { icons: {}, state: {}, matchMedia: () => ({ matches: false }), console, Intl, Date, Set, Map };
vm.runInNewContext(source + '\n;globalThis.__calendarTest = { calendarCells };', context);
const cells = context.__calendarTest.calendarCells(2024, 1);
assert.equal(cells.length, 42);
assert.equal(cells[0].key, '2024-01-28');
assert.equal(cells.find(x => x.key === '2024-02-29').current, true);
assert.equal(cells.at(-1).key, '2024-03-09');
console.log('calendar tests passed');
