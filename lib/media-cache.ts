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
 * Si ya fue descargado previamente y existe físicamente en disco, devuelve inmediatamente la ruta local (/media/exercises/...).
 */
export async function cacheFileLocally(
  remoteUrl: string | undefined,
  baseFilename: string,
  type: "video" | "gif" | "image"
): Promise<string | undefined> {
  if (!remoteUrl) return undefined;

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

  // Si ya es una ruta local y el archivo ya existe físicamente en disco, no hay nada que descargar
  if (remoteUrl.startsWith("/") || !remoteUrl.startsWith("http")) {
    const directLocalPath = path.join(process.cwd(), "public", remoteUrl);
    if (fs.existsSync(directLocalPath) && fs.statSync(directLocalPath).size > 0) {
      return remoteUrl;
    }
    // Si es ruta local pero no existe en disco, no podemos descargar de una URL local sin origen remoto
    return remoteUrl;
  }

  // Si el archivo ya existe en disco y tiene contenido válido (> 0 bytes), devolver la URL local fija
  if (fs.existsSync(localFilePath) && fs.statSync(localFilePath).size > 0) {
    return localPublicUrl;
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000); // 15s timeout

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
    console.log(`[MediaCache] Guardado localmente en LXC: ${localPublicUrl} (${(arrayBuffer.byteLength / 1024).toFixed(1)} KB)`);
    return localPublicUrl;
  } catch (error) {
    console.warn(`[MediaCache] Error al descargar y guardar ${remoteUrl}:`, error);
    return remoteUrl; // Fallback a URL remota si no hay conexión
  }
}

/**
 * Procesa un ExerciseMedia: descarga vídeo, gif o póster a disco local y los reemplaza por URLs locales.
 * En un contenedor LXC nuevo o limpio, si gifUrl apunta a un archivo local ausente, usa cdnUrl para descargarlo.
 */
export async function localizeExerciseMedia(media: ExerciseMedia): Promise<ExerciseMedia> {
  const sanitizedId = media.id.toLowerCase().replace(/[^a-z0-9_-]/g, "_");

  // Si gifUrl apunta a un archivo local que NO existe físicamente en disco (ej. contenedor LXC nuevo),
  // y disponemos de cdnUrl o URL remota, usamos esa URL remota como origen para descargarlo.
  let targetGifUrl = media.gifUrl;
  if (targetGifUrl && targetGifUrl.startsWith("/")) {
    const localPath = path.join(process.cwd(), "public", targetGifUrl);
    if (!fs.existsSync(localPath) || fs.statSync(localPath).size === 0) {
      if (media.cdnUrl) {
        targetGifUrl = media.cdnUrl;
      }
    }
  }

  let targetPosterUrl = media.posterUrl;
  if (targetPosterUrl && targetPosterUrl.startsWith("/")) {
    const localPath = path.join(process.cwd(), "public", targetPosterUrl);
    if (!fs.existsSync(localPath) || fs.statSync(localPath).size === 0) {
      if (media.cdnUrl) {
        targetPosterUrl = media.cdnUrl;
      }
    }
  }

  const [localVideo, localGif, localPoster] = await Promise.all([
    cacheFileLocally(media.videoUrl, `${sanitizedId}_video`, "video"),
    cacheFileLocally(targetGifUrl || media.cdnUrl, `${sanitizedId}_anim`, "gif"),
    cacheFileLocally(targetPosterUrl, `${sanitizedId}_poster`, "image"),
  ]);

  return {
    ...media,
    videoUrl: localVideo,
    gifUrl: localGif || targetGifUrl,
    posterUrl: localPoster || targetPosterUrl,
  };
}
