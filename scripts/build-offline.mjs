import { writeOfflineManifest } from "./offline-pack-manifest.mjs";
import { fileURLToPath } from "node:url";

const distDirectory = fileURLToPath(new URL("../dist", import.meta.url));
const manifest = await writeOfflineManifest(distDirectory);
const megabytes = (manifest.totalBytes / 1024 / 1024).toFixed(2);

console.log(`Offline pack ${manifest.version}: ${manifest.assets.length} files, ${megabytes} MB`);
