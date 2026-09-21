import { createHash } from "node:crypto";
import { readFile, readdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";

function normalized(relativePath) {
  return relativePath.replaceAll(path.sep, "/").replace(/^\/+/, "");
}

export function shouldIncludeInOfflinePack(relativePath) {
  const file = normalized(relativePath);
  if (file === "index.html" || file === "owldio-offline-lockup.webp") return true;
  if (!file.startsWith("assets/")) return false;
  return !path.posix.basename(file).startsWith("rational-sensual-");
}

export function offlineAssetUrl(relativePath) {
  const file = normalized(relativePath);
  return file === "index.html" ? "/" : `/${file}`;
}

async function walk(directory, root = directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = await Promise.all(entries.map(async (entry) => {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) return walk(fullPath, root);
    return path.relative(root, fullPath);
  }));
  return files.flat();
}

export async function writeOfflineManifest(distDirectory) {
  const relativeFiles = (await walk(distDirectory))
    .map(normalized)
    .filter(shouldIncludeInOfflinePack)
    .sort();
  const hash = createHash("sha256");
  const assets = [];

  for (const relativePath of relativeFiles) {
    const fullPath = path.join(distDirectory, relativePath);
    const [contents, info] = await Promise.all([readFile(fullPath), stat(fullPath)]);
    hash.update(relativePath);
    hash.update(contents);
    assets.push({ url: offlineAssetUrl(relativePath), bytes: info.size });
  }

  const manifest = {
    version: hash.digest("hex").slice(0, 16),
    totalBytes: assets.reduce((sum, asset) => sum + asset.bytes, 0),
    assets,
  };
  await writeFile(
    path.join(distDirectory, "offline-manifest.json"),
    `${JSON.stringify(manifest, null, 2)}\n`,
    "utf8",
  );
  return manifest;
}
