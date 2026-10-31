import fs from "node:fs";
import path from "node:path";
import { ExerciseMedia } from "@/types/exercise-media";

const MEDIA_DIR = path.join(process.cwd(), "public", "media", "exercises");

/**
 * Garantiza que el directorio local de almacenamiento existe.
 */
function ensureMediaDir() {
  if (!fs.existsSync(MEDIA_DIR)) {
    fs.mkdirSync(MEDIA_DIR, { recursive: true });
  }
}

/**
 * Descarga y guarda localmente un archivo multimedia si es una URL remota.
 * Si ya fue descargado previamente, devuelve inmediatamente la ruta local (/media/exercises/...).
 */
export async function cacheFileLocally(
  remoteUrl: string | undefined,
  baseFilename: string,
  type: "video" | "gif" | "image"
): Promise<string | undefined> {
  if (!remoteUrl) return undefined;

  // Si ya es una ruta local, no hacemos nada
  if (remoteUrl.startsWith("/") || !remoteUrl.startsWith("http")) {
    return remoteUrl;
  }

  ensureMediaDir();

  // Deducir extensión según el tipo y URL
  let ext = type === "video" ? ".mp4" : type === "gif" ? ".gif" : ".jpg";
  if (remoteUrl.endsWith(".webm")) ext = ".webm";
  else if (remoteUrl.endsWith(".mp4")) ext = ".mp4";
  else if (remoteUrl.endsWith(".gif")) ext = ".gif";
  else if (remoteUrl.endsWith(".png")) ext = ".png";
  else if (remoteUrl.endsWith(".webp")) ext = ".webp";

  const filename = `${baseFilename}${ext}`;
  const localFilePath = path.join(MEDIA_DIR, filename);
  const localPublicUrl = `/media/exercises/${filename}`;

  // Si el archivo ya existe en disco, devolver la URL local fija
  if (fs.existsSync(localFilePath) && fs.statSync(localFilePath).size > 0) {
    return localPublicUrl;
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000); // 12s timeout

    const res = await fetch(remoteUrl, {
      signal: controller.signal,
      headers: {
        "User-Agent": "ByteHevy-GymVisual-Fetcher/1.0",
      },
    });
    clearTimeout(timeout);

    if (!res.ok) {
      console.warn(`[MediaCache] No se pudo descargar ${remoteUrl} (HTTP ${res.status}), usando URL remota.`);
      return remoteUrl;
    }

    const arrayBuffer = await res.arrayBuffer();
    fs.writeFileSync(localFilePath, Buffer.from(arrayBuffer));
    console.log(`[MediaCache] Guardado localmente en LXC: ${localPublicUrl}`);
    return localPublicUrl;
  } catch (error) {
    console.warn(`[MediaCache] Error al descargar y guardar ${remoteUrl}:`, error);
    return remoteUrl; // Fallback a URL remota si no hay conexión
  }
}

/**
 * Procesa un ExerciseMedia: descarga vídeo, gif o póster y los reemplaza por URLs locales.
 */
export async function localizeExerciseMedia(media: ExerciseMedia): Promise<ExerciseMedia> {
  const sanitizedId = media.id.toLowerCase().replace(/[^a-z0-9_-]/g, "_");

  const [localVideo, localGif, localPoster] = await Promise.all([
    cacheFileLocally(media.videoUrl, `${sanitizedId}_video`, "video"),
    cacheFileLocally(media.gifUrl, `${sanitizedId}_anim`, "gif"),
    cacheFileLocally(media.posterUrl, `${sanitizedId}_poster`, "image"),
  ]);

  return {
    ...media,
    videoUrl: localVideo,
    gifUrl: localGif,
    posterUrl: localPoster,
  };
}

