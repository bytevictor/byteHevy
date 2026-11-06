import { NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { getDb, ensureSchema } from "@/lib/db";
import { ExerciseMedia } from "@/types/exercise-media";

const MEDIA_DIR = path.join(process.cwd(), "public", "media", "exercises");

function ensureMediaDir() {
  if (!fs.existsSync(MEDIA_DIR)) {
    fs.mkdirSync(MEDIA_DIR, { recursive: true });
  }
}

/**
 * Convierte un vídeo MP4/WebM/MOV a un GIF animado optimizado
 * y genera además un poster JPEG estático.
 */
function convertVideoToGif(
  videoPath: string,
  outputGifPath: string,
  outputPosterPath: string
): { success: boolean; error?: string } {
  try {
    // 1. Extraer frame estático como poster
    spawnSync(
      "ffmpeg",
      ["-y", "-ss", "00:00:00.5", "-i", videoPath, "-vframes", "1", outputPosterPath],
      { stdio: "ignore" }
    );

    // 2. Generar GIF optimizado con paleta generada dinámicamente
    const res = spawnSync(
      "ffmpeg",
      [
        "-y",
        "-t", "15", // Máximo 15 segundos para no generar ficheros desmedidos
        "-i", videoPath,
        "-vf", "fps=14,scale=480:-2:flags=lanczos,split[s0][s1];[s0]palettegen=max_colors=128[p];[s1][p]paletteuse=dither=bayer",
        "-loop", "0",
        outputGifPath,
      ],
      { encoding: "utf-8" }
    );

    if (res.status === 0 && fs.existsSync(outputGifPath) && fs.statSync(outputGifPath).size > 0) {
      return { success: true };
    }

    // Fallback simple si el filtro avanzado no es compatible
    const fallbackRes = spawnSync(
      "ffmpeg",
      ["-y", "-t", "15", "-i", videoPath, "-vf", "fps=12,scale=360:-2", "-loop", "0", outputGifPath],
      { encoding: "utf-8" }
    );

    if (fallbackRes.status === 0 && fs.existsSync(outputGifPath) && fs.statSync(outputGifPath).size > 0) {
      return { success: true };
    }

    return {
      success: false,
      error: res.stderr || fallbackRes.stderr || "Error convirtiendo vídeo a GIF",
    };
  } catch (err: unknown) {
    const error = err as Error;
    console.error("[convertVideoToGif] Error ejecutando FFmpeg:", error);
    return { success: false, error: error.message };
  }
}

export interface UploadedMediaItem {
  id: string;
  filename: string;
  url: string;
  gifUrl: string;
  videoUrl?: string;
  posterUrl?: string;
  title: string;
  sizeBytes: number;
  mtime: number;
  isVideo: boolean;
  ext: string;
}

/**
 * GET: Devuelve la lista completa de archivos multimedia subidos y disponibles localmente
 */
export async function GET() {
  try {
    ensureMediaDir();
    const files = fs.readdirSync(MEDIA_DIR);

    const mediaExtensions = new Set([
      ".gif",
      ".mp4",
      ".mov",
      ".webm",
      ".png",
      ".jpg",
      ".jpeg",
      ".webp",
    ]);

    const items: UploadedMediaItem[] = [];

    for (const file of files) {
      if (
        file.startsWith(".") ||
        file.endsWith("_poster.jpg") ||
        file.endsWith("_poster.png") ||
        file.endsWith("_poster.gif")
      ) {
        continue;
      }

      const ext = path.extname(file).toLowerCase();
      if (!mediaExtensions.has(ext)) continue;

      const fullPath = path.join(MEDIA_DIR, file);
      try {
        const stat = fs.statSync(fullPath);
        if (!stat.isFile() || stat.size === 0) continue;

        const isVideo = ext === ".mp4" || ext === ".mov" || ext === ".webm";
        const base = path.basename(file, ext);

        // Limpiar nombre para mostrar
        const displayTitle = base
          .replace(/_anim$/i, "")
          .replace(/_[a-z0-9]{4,14}$/i, "")
          .replace(/[-_]+/g, " ")
          .trim();

        const url = `/media/exercises/${file}`;
        let gifUrl = url;
        let videoUrl: string | undefined = isVideo ? url : undefined;
        let posterUrl: string | undefined = undefined;

        if (isVideo) {
          const companionGif = `${base}.gif`;
          if (fs.existsSync(path.join(MEDIA_DIR, companionGif))) {
            gifUrl = `/media/exercises/${companionGif}`;
          }
        }

        const companionPosterJpg = `${base}_poster.jpg`;
        if (fs.existsSync(path.join(MEDIA_DIR, companionPosterJpg))) {
          posterUrl = `/media/exercises/${companionPosterJpg}`;
        }

        items.push({
          id: file,
          filename: file,
          url,
          gifUrl,
          videoUrl,
          posterUrl,
          title: displayTitle ? displayTitle.charAt(0).toUpperCase() + displayTitle.slice(1) : file,
          sizeBytes: stat.size,
          mtime: stat.mtimeMs,
          isVideo,
          ext,
        });
      } catch {}
    }

    // Ordenar de más reciente a más antiguo
    items.sort((a, b) => b.mtime - a.mtime);

    return NextResponse.json({
      success: true,
      data: items,
      count: items.length,
    });
  } catch (error: unknown) {
    const err = error as Error;
    return NextResponse.json(
      { success: false, error: err.message || "Error al listar archivos multimedia" },
      { status: 500 }
    );
  }
}

/**
 * POST: Sube un archivo multimedia propio.
 * Si es un vídeo (MP4/WebM/MOV), lo intercepta y genera automáticamente un GIF optimizado con FFmpeg.
 */
export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const exerciseName = formData.get("exerciseName") as string | null;

    if (!file) {
      return NextResponse.json(
        { success: false, error: "No se proporcionó ningún archivo multimedia." },
        { status: 400 }
      );
    }

    ensureMediaDir();

    const fileName = file.name;
    const ext = path.extname(fileName).toLowerCase();
    const baseName = path.basename(fileName, ext);

    const validExtensions = new Set([
      ".gif",
      ".mp4",
      ".mov",
      ".webm",
      ".png",
      ".jpg",
      ".jpeg",
      ".webp",
    ]);

    if (!validExtensions.has(ext)) {
      return NextResponse.json(
        {
          success: false,
          error: `Formato de archivo no soportado (${ext}). Usa GIF, MP4, WebM, PNG, JPG o WebP.`,
        },
        { status: 400 }
      );
    }

    const safeStem = (exerciseName || baseName)
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9_-]/g, "_")
      .replace(/_+/g, "_");

    const uid = Date.now().toString(36);
    const fileStem = `${safeStem}_${uid}`;

    const isVideo = ext === ".mp4" || ext === ".mov" || ext === ".webm";
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    let finalGifUrl = "";
    let finalVideoUrl: string | undefined = undefined;
    let finalPosterUrl: string | undefined = undefined;
    let finalFileName = "";
    let conversionNote = "";

    if (isVideo) {
      // 1. Guardar vídeo original
      const videoFileName = `${fileStem}${ext}`;
      const videoPath = path.join(MEDIA_DIR, videoFileName);
      fs.writeFileSync(videoPath, buffer);
      finalVideoUrl = `/media/exercises/${videoFileName}`;
      finalFileName = videoFileName;

      // 2. Interceptar con FFmpeg y convertir a GIF + Poster
      const gifFileName = `${fileStem}.gif`;
      const gifPath = path.join(MEDIA_DIR, gifFileName);
      const posterFileName = `${fileStem}_poster.jpg`;
      const posterPath = path.join(MEDIA_DIR, posterFileName);

      const conv = convertVideoToGif(videoPath, gifPath, posterPath);
      if (conv.success) {
        finalGifUrl = `/media/exercises/${gifFileName}`;
        finalPosterUrl = `/media/exercises/${posterFileName}`;
        conversionNote = "Vídeo MP4 convertido con éxito a GIF animado mediante FFmpeg";
      } else {
        console.warn("[MediaUpload] FFmpeg no pudo generar GIF, usando vídeo nativo:", conv.error);
        finalGifUrl = finalVideoUrl;
        conversionNote = "Vídeo guardado como reproductor continuo nativo (FFmpeg fallback)";
      }
    } else {
      // Archivo de imagen o GIF directo
      finalFileName = `${fileStem}${ext}`;
      const imagePath = path.join(MEDIA_DIR, finalFileName);
      fs.writeFileSync(imagePath, buffer);
      finalGifUrl = `/media/exercises/${finalFileName}`;
      finalPosterUrl = finalGifUrl;
    }

    // Si se especificó exerciseName, actualizar la caché en SQLite de inmediato
    if (exerciseName) {
      const db = getDb();
      await ensureSchema(db);
      const cacheKey = exerciseName.toLowerCase().trim();

      const existingRes = await db.execute({
        sql: "SELECT data_json FROM exercisedb_cache WHERE exercise_name = ?",
        args: [cacheKey],
      });

      let mediaObj: Partial<ExerciseMedia> = {};
      if (existingRes.rows.length > 0) {
        try {
          mediaObj = JSON.parse(String(existingRes.rows[0].data_json));
        } catch {}
      }

      mediaObj.id = mediaObj.id || `custom-${safeStem}`;
      mediaObj.name = exerciseName;
      mediaObj.gifUrl = finalGifUrl;
      mediaObj.videoUrl = finalVideoUrl;
      mediaObj.posterUrl = finalPosterUrl || finalGifUrl;

      await db.execute({
        sql: `INSERT OR REPLACE INTO exercisedb_cache (exercise_name, data_json, updated_at)
              VALUES (?, ?, strftime('%s', 'now'))`,
        args: [cacheKey, JSON.stringify(mediaObj)],
      });
    }

    return NextResponse.json({
      success: true,
      message: conversionNote || "Archivo multimedia guardado correctamente",
      data: {
        fileName: finalFileName,
        url: finalGifUrl || finalVideoUrl,
        gifUrl: finalGifUrl,
        videoUrl: finalVideoUrl,
        posterUrl: finalPosterUrl,
        sizeBytes: buffer.byteLength,
        isVideo,
      },
    });
  } catch (error: unknown) {
    const err = error as Error;
    console.error("[MediaUpload] Error subiendo multimedia:", err);
    return NextResponse.json(
      { success: false, error: err.message || "Error al subir multimedia" },
      { status: 500 }
    );
  }
}

/**
 * DELETE: Elimina un archivo multimedia subido previamente
 */
export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const filename = searchParams.get("filename");

    if (!filename) {
      return NextResponse.json(
        { success: false, error: "filename es requerido" },
        { status: 400 }
      );
    }

    const safeFilename = path.basename(filename);
    const filePath = path.join(MEDIA_DIR, safeFilename);

    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);

      // Eliminar companion files si existen (ej. poster o gif generado)
      const ext = path.extname(safeFilename);
      const base = path.basename(safeFilename, ext);
      const companionPoster = path.join(MEDIA_DIR, `${base}_poster.jpg`);
      if (fs.existsSync(companionPoster)) {
        try { fs.unlinkSync(companionPoster); } catch {}
      }
      const companionGif = path.join(MEDIA_DIR, `${base}.gif`);
      if (ext !== ".gif" && fs.existsSync(companionGif)) {
        try { fs.unlinkSync(companionGif); } catch {}
      }
    }

    return NextResponse.json({
      success: true,
      message: `Archivo "${safeFilename}" eliminado correctamente`,
    });
  } catch (error: unknown) {
    const err = error as Error;
    return NextResponse.json(
      { success: false, error: err.message || "Error al eliminar archivo" },
      { status: 500 }
    );
  }
}
