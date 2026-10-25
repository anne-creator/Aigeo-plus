import { test, after, before } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { bootstrapAdmin } from "./bootstrap-admin.mjs";

let directory, prisma;
before(async () => {
  directory = await mkdtemp(path.join(tmpdir(), "aigeo-production-test-"));
  process.env.DATABASE_URL = `file:${path.join(directory, "test.db")}`;
  await writeFile(path.join(directory, "test.db"), "");
  execFileSync(process.execPath, ["node_modules/prisma/build/index.js", "db", "push", "--skip-generate"], { env: process.env, stdio: "pipe" });
  prisma = new PrismaClient();
});
after(async () => { await prisma?.$disconnect(); if (directory) await rm(directory, { recursive: true, force: true }); });

test("production bootstrap creates one admin and never resets existing data or passwords", async () => {
  await assert.rejects(bootstrapAdmin({ BOOTSTRAP_ADMIN_PASSWORD: "short" }), /16/);
  await assert.rejects(bootstrapAdmin({ BOOTSTRAP_ADMIN_PASSWORD: "replace-with-a-random-password-at-least-16-characters" }), /16/);
  assert.equal(await prisma.user.count(), 0);
  const password = "test-only-random-password-2026";
  assert.deepEqual(await bootstrapAdmin({ BOOTSTRAP_ADMIN_PASSWORD: password }), { created: true });
  const original = await prisma.user.findUniqueOrThrow({ where: { username: "admin" } });
  assert.equal(original.role, "ADMIN");
  assert.ok(await bcrypt.compare(password, original.passwordHash));
  assert.equal(await prisma.project.count(), 0);
  assert.deepEqual(await bootstrapAdmin({ BOOTSTRAP_ADMIN_PASSWORD: "different-password-should-not-apply" }), { created: false });
  assert.equal(await prisma.user.count(), 1);
  assert.equal((await prisma.user.findUniqueOrThrow({ where: { username: "admin" } })).passwordHash, original.passwordHash);
  await prisma.user.update({ where: { id: original.id }, data: { active: false } });
  await assert.rejects(bootstrapAdmin({ BOOTSTRAP_ADMIN_PASSWORD: password }), /没有启用的管理员/);
});
