import fs from "node:fs";
import path from "node:path";
import { createClient } from "@libsql/client";
import { EXERCISE_MEDIA_REGISTRY } from "../lib/exercise-media";

const MEDIA_DIR = path.join(process.cwd(), "public", "media", "exercises");
if (!fs.existsSync(MEDIA_DIR)) {
  fs.mkdirSync(MEDIA_DIR, { recursive: true });
}

const db = createClient({ url: "file:data/bytehevy.db" });

async function init() {
  await db.execute(`
    CREATE TABLE IF NOT EXISTS exercisedb_cache (
      exercise_name TEXT PRIMARY KEY,
      data_json TEXT NOT NULL,
      updated_at INTEGER DEFAULT (strftime('%s', 'now'))
    );
  `);

  console.log(`Downloading and caching ${EXERCISE_MEDIA_REGISTRY.length} GymVisual animations...`);

  for (const item of EXERCISE_MEDIA_REGISTRY) {
    const sanitizedId = item.id.toLowerCase().replace(/[^a-z0-9_-]/g, "_");
    const gifFilename = `${sanitizedId}_anim.gif`;
    const localFilePath = path.join(MEDIA_DIR, gifFilename);
    const localUrl = `/media/exercises/${gifFilename}`;

    if (!item.gifUrl) continue;
    if (fs.existsSync(localFilePath) && fs.statSync(localFilePath).size > 0) {
      console.log(`[Already cached] ${item.name} -> ${localUrl}`);
    } else {
      console.log(`[Downloading] ${item.name} from ${item.gifUrl}`);
      try {
        const res = await fetch(item.gifUrl);
        if (!res.ok) {
          console.error(`Failed to download ${item.gifUrl}: HTTP ${res.status}`);
          continue;
        }
        const buffer = await res.arrayBuffer();
        fs.writeFileSync(localFilePath, Buffer.from(buffer));
        console.log(`✓ Saved ${localFilePath} (${(buffer.byteLength / 1024).toFixed(1)} KB)`);
      } catch (err: any) {
        console.error(`Error downloading ${item.name}: ${err.message}`);
        continue;
      }
    }

    // Persist in SQLite cache for both exercise.name and all aliases
    const localizedItem = {
      ...item,
      gifUrl: localUrl,
    };

    const keysToCache = [item.name, ...item.aliases];
    for (const key of keysToCache) {
      await db.execute({
        sql: `INSERT OR REPLACE INTO exercisedb_cache (exercise_name, data_json, updated_at)
              VALUES (?, ?, strftime('%s', 'now'))`,
        args: [key.toLowerCase().trim(), JSON.stringify(localizedItem)],
      });
    }
  }

  console.log("All GymVisual exercise media successfully downloaded and cached in SQLite!");
}

init().catch(console.error);
