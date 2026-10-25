import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
const read = (path: string) => JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8'));
const company = read('./company-data.json');
const original = read('../data/company/employees.json');
const capacities = read('../data/company/daily_capacity.json');
const departments = read('../data/company/departments.json');
const manifest = read('../data/company/import-manifest.json');
test('projection preserves every source employee ID, name, role, skills and permissions', () => {
  assert.equal(company.people.length, 1000);
  assert.equal(new Set(company.people.map((p: any) => p.id)).size, original.length);
  for (const [i, p] of company.people.entries()) {
    const source = original[i];
    assert.equal(p.id, source.employee_id);
    assert.equal(p.name, source.name);
    assert.equal(p.role, source.job_title);
    assert.deepEqual(p.skillLevels, source.skills);
    assert.deepEqual(p.permissions, source.permissions);
  }
});
test('uses dated remaining capacity, not gross hours; department totals match', () => {
  const byId = new Map(capacities.filter((c: any) => c.date === company.source.referenceDate).map((c: any) => [c.employee_id, c.free_hours]));
  for (const p of company.people) assert.equal(p.availableHours, byId.get(p.id));
  for (const d of departments) assert.equal(company.people.filter((p: any) => p.departmentId === d.department_id).length, d.headcount);
  assert.equal(company.departments.length, 17);
  assert.equal(company.source.referenceDate, '2026-10-26');
  assert.equal(company.source.isSynthetic, true);
});
test('local model personnel source files match original import hashes', () => {
  for (const file of manifest.files) {
    const bytes = readFileSync(new URL('../data/company/' + file.path, import.meta.url));
    assert.equal(createHash('sha256').update(bytes).digest('hex'), file.sha256);
  }
  for (const id of ['EMP-0349','EMP-0329','EMP-0218']) assert.ok(company.people.some((p: any) => p.id === id));
});
