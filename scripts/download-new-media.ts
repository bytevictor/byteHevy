import fs from "node:fs";
import path from "node:path";

const MEDIA_DIR = path.join(process.cwd(), "public", "media", "exercises");
if (!fs.existsSync(MEDIA_DIR)) {
  fs.mkdirSync(MEDIA_DIR, { recursive: true });
}

const CDN_BASE = "https://cdn.jsdelivr.net/gh/JahelCuadrado/ExerciseGymGifsDB@v1.1.0";

const NEW_MEDIA: { filename: string; remotePath: string }[] = [
  { filename: "barbell-bench-press_anim.gif", remotePath: "pectorals/barbell-bench-press.gif" },
  { filename: "barbell-shoulder-press_anim.gif", remotePath: "delts/barbell-seated-overhead-press.gif" },
  { filename: "barbell-squat_anim.gif", remotePath: "glutes/barbell-full-squat.gif" },
  { filename: "hack-squat_anim.gif", remotePath: "glutes/sled-hack-squat.gif" },
  { filename: "barbell-incline-bench-press_anim.gif", remotePath: "pectorals/barbell-incline-bench-press.gif" },
  { filename: "cable-reverse-fly_anim.gif", remotePath: "delts/cable-cross-over-revers-fly.gif" },
  { filename: "machine-assisted-pull-up_anim.gif", remotePath: "lats/assisted-pull-up.gif" },
  { filename: "machine-inner-chest-press_anim.gif", remotePath: "pectorals/lever-chest-press.gif" },
  { filename: "leg-raise_anim.gif", remotePath: "abs/hanging-leg-raise.gif" },
  { filename: "twists_anim.gif", remotePath: "abs/russian-twist.gif" },
];

async function main() {
  console.log(`Downloading ${NEW_MEDIA.length} new GymVisual exercise animations...`);

  // Ensure alternating-hammer-curl_anim.gif exists (copy from cross-body-hammer-curl if present)
  const hammerSource = path.join(MEDIA_DIR, "cross-body-hammer-curl_anim.gif");
  const hammerTarget = path.join(MEDIA_DIR, "alternating-hammer-curl_anim.gif");
  if (fs.existsSync(hammerSource) && !fs.existsSync(hammerTarget)) {
    fs.copyFileSync(hammerSource, hammerTarget);
    console.log("✓ Created alternating-hammer-curl_anim.gif from cross-body-hammer-curl_anim.gif");
  }

  for (const item of NEW_MEDIA) {
    const dest = path.join(MEDIA_DIR, item.filename);
    if (fs.existsSync(dest) && fs.statSync(dest).size > 0) {
      console.log(`[Already cached] ${item.filename}`);
      continue;
    }

    const url = `${CDN_BASE}/${item.remotePath}`;
    console.log(`Fetching ${url}...`);
    try {
      const res = await fetch(url);
      if (!res.ok) {
        console.error(`Failed ${url}: HTTP ${res.status}`);
        continue;
      }
      const buffer = await res.arrayBuffer();
      fs.writeFileSync(dest, Buffer.from(buffer));
      console.log(`✓ Saved ${item.filename} (${(buffer.byteLength / 1024).toFixed(1)} KB)`);
    } catch (e: any) {
      console.error(`Error downloading ${item.filename}: ${e.message}`);
    }
  }
}

main().catch(console.error);

