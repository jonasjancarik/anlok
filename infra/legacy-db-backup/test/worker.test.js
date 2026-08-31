import assert from "node:assert/strict";
import { test } from "node:test";

import worker from "../src/worker.js";

const token = "test-backup-token";

async function sqliteBody() {
  const header = new TextEncoder().encode("SQLite format 3\0");
  const body = new Uint8Array(256);
  body.set(header);
  const digest = await crypto.subtle.digest("SHA-256", body);
  const sha256 = [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
  return { body, sha256 };
}

function mockBucket() {
  const objects = new Map();
  return {
    objects,
    async put(key, value, options) {
      const bytes = value.slice(0);
      objects.set(key, { bytes, options });
      return { key, size: bytes.byteLength };
    },
    async get(key) {
      const object = objects.get(key);
      if (!object) return null;
      return {
        body: true,
        async arrayBuffer() {
          return object.bytes.slice(0);
        },
      };
    },
  };
}

test("rejects requests without the upload secret", async () => {
  const response = await worker.fetch(
    new Request("https://example.com/backup", { method: "POST", body: "x" }),
    { BACKUP_TOKEN: token, BACKUPS: mockBucket() },
  );
  assert.equal(response.status, 401);
});

test("rejects an incorrect upload secret", async () => {
  const { body, sha256 } = await sqliteBody();
  const bucket = mockBucket();
  const response = await worker.fetch(
    new Request("https://example.com/backup", {
      method: "POST",
      body,
      headers: {
        authorization: "Bearer definitely-wrong",
        "content-length": String(body.byteLength),
        "x-backup-sha256": sha256,
      },
    }),
    { BACKUP_TOKEN: token, BACKUPS: bucket },
  );

  assert.equal(response.status, 401);
  assert.equal(bucket.objects.size, 0);
});

test("stores and restore-verifies a SQLite backup", async () => {
  const { body, sha256 } = await sqliteBody();
  const bucket = mockBucket();
  const response = await worker.fetch(
    new Request("https://example.com/backup", {
      method: "POST",
      body,
      headers: {
        authorization: `Bearer ${token}`,
        "content-length": String(body.byteLength),
        "x-backup-sha256": sha256,
      },
    }),
    { BACKUP_TOKEN: token, BACKUPS: bucket },
  );
  const result = await response.json();

  assert.equal(response.status, 201);
  assert.equal(result.verified, true);
  assert.equal(result.sha256, sha256);
  assert.match(result.key, /^legacy-rpi\/\d{4}\/\d{2}\/\d{2}\//);
  assert.equal(bucket.objects.size, 1);
});

test("does not expose stored backups", async () => {
  const response = await worker.fetch(
    new Request("https://example.com/backup", { method: "GET" }),
    { BACKUP_TOKEN: token, BACKUPS: mockBucket() },
  );
  assert.equal(response.status, 404);
});
