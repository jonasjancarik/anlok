const MAX_BACKUP_BYTES = 10 * 1024 * 1024;
const SQLITE_HEADER = "SQLite format 3\0";

function json(body, status) {
  return Response.json(body, {
    status,
    headers: {
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
    },
  });
}

function bytesToHex(bytes) {
  return [...new Uint8Array(bytes)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

async function sha256Hex(value) {
  const bytes =
    typeof value === "string" ? new TextEncoder().encode(value) : value;
  return bytesToHex(await crypto.subtle.digest("SHA-256", bytes));
}

async function tokensMatch(provided, expected) {
  const [providedHash, expectedHash] = await Promise.all([
    sha256Hex(provided),
    sha256Hex(expected),
  ]);
  let different = providedHash.length ^ expectedHash.length;
  for (let index = 0; index < expectedHash.length; index += 1) {
    different |= providedHash.charCodeAt(index) ^ expectedHash.charCodeAt(index);
  }
  return different === 0;
}

function makeObjectKey(createdAt, digest) {
  const datePath = createdAt.slice(0, 10).replaceAll("-", "/");
  const timestamp = createdAt.replaceAll(/[-:.]/g, "");
  return `legacy-rpi/${datePath}/${timestamp}-${digest.slice(0, 16)}-${crypto.randomUUID()}.sqlite3`;
}

export default {
  async fetch(request, env) {
    if (request.method !== "POST" || new URL(request.url).pathname !== "/backup") {
      return json({ error: "Not found" }, 404);
    }

    const authorization = request.headers.get("authorization") || "";
    const providedToken = authorization.startsWith("Bearer ")
      ? authorization.slice("Bearer ".length)
      : "";
    if (
      !env.BACKUP_TOKEN ||
      !providedToken ||
      !(await tokensMatch(providedToken, env.BACKUP_TOKEN))
    ) {
      return json({ error: "Unauthorized" }, 401);
    }

    const claimedDigest = request.headers.get("x-backup-sha256") || "";
    if (!/^[a-f0-9]{64}$/.test(claimedDigest)) {
      return json({ error: "A valid SHA-256 digest is required" }, 400);
    }

    const claimedLength = Number(request.headers.get("content-length"));
    if (
      !Number.isSafeInteger(claimedLength) ||
      claimedLength <= 0 ||
      claimedLength > MAX_BACKUP_BYTES
    ) {
      return json({ error: "Backup size is invalid or exceeds 10 MiB" }, 413);
    }

    const backup = await request.arrayBuffer();
    if (backup.byteLength !== claimedLength || backup.byteLength > MAX_BACKUP_BYTES) {
      return json({ error: "Backup length does not match the request" }, 400);
    }

    const header = new TextDecoder().decode(backup.slice(0, SQLITE_HEADER.length));
    if (header !== SQLITE_HEADER) {
      return json({ error: "The upload is not a SQLite database" }, 400);
    }

    const digestBytes = await crypto.subtle.digest("SHA-256", backup);
    const actualDigest = bytesToHex(digestBytes);
    if (actualDigest !== claimedDigest) {
      return json({ error: "Backup checksum does not match the request" }, 400);
    }

    const createdAt = new Date().toISOString();
    const key = makeObjectKey(createdAt, actualDigest);

    try {
      const stored = await env.BACKUPS.put(key, backup, {
        sha256: digestBytes,
        httpMetadata: { contentType: "application/vnd.sqlite3" },
        customMetadata: {
          sha256: actualDigest,
          source: "rpi.melnicka7.cz",
          createdAt,
        },
      });
      if (!stored || stored.size !== backup.byteLength) {
        throw new Error("R2 did not confirm the stored backup size");
      }

      const restored = await env.BACKUPS.get(key);
      if (!restored?.body) {
        throw new Error("R2 could not read the newly stored backup");
      }
      const restoredBytes = await restored.arrayBuffer();
      const restoredDigest = await sha256Hex(restoredBytes);
      if (
        restoredBytes.byteLength !== backup.byteLength ||
        restoredDigest !== actualDigest
      ) {
        throw new Error("R2 restore verification failed");
      }

      return json(
        {
          key,
          size: backup.byteLength,
          sha256: actualDigest,
          verified: true,
        },
        201,
      );
    } catch (error) {
      console.error("Backup upload failed", error);
      return json({ error: "R2 could not verify the backup" }, 502);
    }
  },
};
