import fs from "node:fs";
import path from "node:path";
import { ExerciseMedia, MuscleGroup } from "@/types/exercise-media";
import {
  EXERCISE_MEDIA_REGISTRY,
  MUSCLE_FALLBACK_GIFS,
  CDN_BASE,
} from "./exercise-media";
import { translateExerciseNameToEnglish } from "./exercise-translator";

export interface CatalogExerciseItem {
  id: string;
  category: string;
  categoryLabel: string;
  filename: string;
  title: string;
  cdnUrl: string;
  score?: number;
}

export interface CatalogCategory {
  id: string;
  label: string;
  count: number;
}

let cachedManifest: CatalogExerciseItem[] | null = null;

export function getManifest(): CatalogExerciseItem[] {
  if (cachedManifest) return cachedManifest;

  const manifestPath = path.join(process.cwd(), "data", "exercise-gifs-manifest.json");
  if (!fs.existsSync(manifestPath)) {
    return [];
  }

  try {
    const raw = fs.readFileSync(manifestPath, "utf-8");
    cachedManifest = JSON.parse(raw);
    return cachedManifest || [];
  } catch (err) {
    console.error("[ExerciseCatalog] Error reading manifest:", err);
    return [];
  }
}

export function getCatalogCategories(): CatalogCategory[] {
  const manifest = getManifest();
  const counts = new Map<string, { label: string; count: number }>();

  for (const item of manifest) {
    const existing = counts.get(item.category);
    if (existing) {
      existing.count += 1;
    } else {
      counts.set(item.category, { label: item.categoryLabel || item.category, count: 1 });
    }
  }

  const result: CatalogCategory[] = [
    { id: "all", label: "Todas las categorías", count: manifest.length },
  ];

  for (const [id, val] of counts.entries()) {
    result.push({ id, label: val.label, count: val.count });
  }

  return result.sort((a, b) => {
    if (a.id === "all") return -1;
    if (b.id === "all") return 1;
    return a.label.localeCompare(b.label);
  });
}

// Diccionario de traducción y sinónimos para búsquedas fluidas
const SPANISH_SYNONYMS: Record<string, string[]> = {
  pecho: ["chest", "pectoral", "press", "bench", "fly"],
  pectoral: ["chest", "pectoral"],
  banca: ["bench", "press"],
  espalda: ["back", "lat", "row", "pull"],
  dorsal: ["lat", "lats", "pulldown", "row"],
  remo: ["row", "cable", "seated"],
  dominada: ["pull-up", "pull up", "chin-up", "chin up"],
  hombro: ["shoulder", "delt", "press", "raise"],
  hombros: ["shoulder", "delt", "press", "raise"],
  deltoides: ["delt", "shoulder", "raise"],
  biceps: ["bicep", "curl"],
  bicep: ["bicep", "curl"],
  triceps: ["tricep", "pushdown", "extension", "dip"],
  tricep: ["tricep", "pushdown", "extension", "dip"],
  pierna: ["leg", "squat", "press", "lunge"],
  piernas: ["leg", "squat", "press", "lunge"],
  cuadriceps: ["quad", "squat", "leg extension", "press"],
  femoral: ["hamstring", "leg curl", "deadlift"],
  isquiotibiales: ["hamstring", "leg curl"],
  gluteo: ["glute", "hip thrust", "kickback"],
  gluteos: ["glute", "hip thrust", "kickback"],
  gemelo: ["calf", "calves", "raise"],
  gemelos: ["calf", "calves", "raise"],
  abdomen: ["ab", "abs", "crunch", "plank"],
  abdominal: ["ab", "abs", "crunch"],
  antebrazo: ["wrist", "forearm", "curl"],
  antebrazos: ["wrist", "forearm", "curl"],
  fondos: ["dip", "dips"],
  sentadilla: ["squat"],
  prensa: ["press", "leg press"],
  polea: ["cable"],
  mancuerna: ["dumbbell"],
  mancuernas: ["dumbbell"],
  barra: ["barbell"],
  maquina: ["machine", "lever"],
  disco: ["plate"],
};

export function searchCatalog(
  query: string = "",
  category: string = "all",
  limit: number = 48
): { items: CatalogExerciseItem[]; total: number } {
  const manifest = getManifest();
  const qClean = query.toLowerCase().trim().replace(/\s*\([^)]*\)/g, "");
  const cat = (category || "all").toLowerCase().trim();

  // Si no hay término de búsqueda, devolver los primeros filtrados por categoría
  if (!qClean) {
    const filtered =
      cat && cat !== "all" ? manifest.filter((item) => item.category === cat) : manifest;
    return {
      items: filtered.slice(0, limit),
      total: filtered.length,
    };
  }

  // Desglosar palabras clave originales
  const originalWords = qClean.split(/\s+/).filter(Boolean);

  // Expandir con traducción automática y sinónimos en inglés
  const expandedTerms = new Set<string>(originalWords);
  const translation = translateExerciseNameToEnglish(qClean);
  if (translation.englishQuery) {
    translation.englishQuery.split(/\s+/).forEach((w) => {
      if (w.length > 2) expandedTerms.add(w);
    });
  }

  for (const word of originalWords) {
    const normalizedWord = word.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    const singularWord = normalizedWord.endsWith("es")
      ? normalizedWord.slice(0, -2)
      : normalizedWord.endsWith("s")
      ? normalizedWord.slice(0, -1)
      : normalizedWord;

    const syns =
      SPANISH_SYNONYMS[normalizedWord] ||
      SPANISH_SYNONYMS[word] ||
      SPANISH_SYNONYMS[singularWord];

    if (syns) {
      syns.forEach((s) => expandedTerms.add(s));
    }
  }

  const scored: { item: CatalogExerciseItem; score: number }[] = [];

  for (const item of manifest) {
    // Filtro estricto de categoría si no es "all"
    if (cat && cat !== "all" && item.category !== cat) {
      continue;
    }

    const titleLower = item.title.toLowerCase();
    const filenameLower = item.filename.toLowerCase();
    const fullSearchable = `${titleLower} ${filenameLower} ${item.category} ${item.categoryLabel}`.toLowerCase();

    let score = 0;

    // Coincidencia exacta de frase
    if (titleLower === qClean || titleLower === translation.englishQuery) {
      score += 500;
    } else if (titleLower.startsWith(qClean) || titleLower.startsWith(translation.englishQuery)) {
      score += 250;
    } else if (titleLower.includes(qClean) || titleLower.includes(translation.englishQuery)) {
      score += 150;
    }

    // Coincidencias de palabras originales
    for (const word of originalWords) {
      const regexWord = new RegExp(`\\b${word}\\b`, "i");
      if (regexWord.test(titleLower)) {
        score += 80;
      } else if (titleLower.includes(word)) {
        score += 40;
      } else if (fullSearchable.includes(word)) {
        score += 15;
      }
    }

    // Coincidencias de sinónimos y traducción expandidos
    for (const term of expandedTerms) {
      if (!originalWords.includes(term)) {
        const regexTerm = new RegExp(`\\b${term}\\b`, "i");
        if (regexTerm.test(titleLower)) {
          score += 60;
        } else if (titleLower.includes(term)) {
          score += 25;
        } else if (fullSearchable.includes(term)) {
          score += 10;
        }
      }
    }

    if (score > 0) {
      scored.push({ item, score });
    }
  }

  // Ordenar por relevancia
  scored.sort((a, b) => b.score - a.score);

  return {
    items: scored.slice(0, limit).map((s) => ({ ...s.item, score: s.score })),
    total: scored.length,
  };
}

export function mapCategoryToMuscleGroup(category: string): MuscleGroup {
  const cat = (category || "").toLowerCase();
  switch (cat) {
    case "pectorals":
      return "chest";
    case "lats":
      return "lats";
    case "upper-back":
    case "traps":
    case "levator-scapulae":
      return "upper_back";
    case "biceps":
      return "biceps";
    case "triceps":
      return "triceps";
    case "forearms":
      return "forearms";
    case "delts":
      return "shoulders";
    case "quads":
    case "abductors":
    case "adductors":
      return "quads";
    case "hamstrings":
    case "glutes":
    case "spine":
      return "hamstrings";
    case "calves":
      return "calves";
    case "abs":
    case "serratus-anterior":
      return "abs";
    case "cardio":
      return "cardio";
    default:
      return "chest";
  }
}

export function detectEquipmentFromTitle(title: string): string {
  const t = title.toLowerCase();
  if (t.includes("dumbbell")) return "Mancuerna";
  if (t.includes("barbell")) return "Barra Olímpica";
  if (t.includes("cable")) return "Polea";
  if (t.includes("lever") || t.includes("machine")) return "Máquina";
  if (t.includes("sled")) return "Prensa / Trineo";
  if (t.includes("band")) return "Banda elástica";
  if (t.includes("kettlebell")) return "Pesa Rusa";
  if (t.includes("smith")) return "Multipower";
  if (t.includes("bodyweight") || t.includes("pull-up") || t.includes("push-up") || t.includes("dip")) {
    return "Peso Corporal";
  }
  return "Gimnasio";
}

/**
 * Resuelve multimedia anatómica buscando en inglés en el catálogo de 1,323 ejercicios GymVisual.
 * Si no está en el registro local, traduce el nombre a inglés, busca en el manifiesto
 * y si no encuentra coincidencia estricta, asigna el GIF del grupo muscular correspondiente (NUNCA press de pecho universal).
 */
export function resolveExerciseMediaFromCatalog(
  exerciseName: string,
  preferredMuscle?: MuscleGroup
): ExerciseMedia {
  const normalized = exerciseName.toLowerCase().trim();

  // 1. Comprobar primero registro estático por nombre exacto o alias
  const exact = EXERCISE_MEDIA_REGISTRY.find(
    (e) => e.name.toLowerCase() === normalized
  );
  if (exact) {
    return { ...exact };
  }

  const byAlias = EXERCISE_MEDIA_REGISTRY.find((e) =>
    e.aliases.some((alias) => normalized.includes(alias) || alias.includes(normalized))
  );
  if (byAlias) {
    return { ...byAlias, name: exerciseName };
  }

  // 2. Traducir el nombre a inglés gym estándar
  const translation = translateExerciseNameToEnglish(exerciseName);
  const englishQuery = translation.englishQuery.toLowerCase().trim();
  const detectedMuscle = translation.detectedMuscle || preferredMuscle;

  // 3. Buscar en el catálogo GymVisual (1,323 ejercicios)
  const manifest = getManifest();
  if (manifest.length > 0) {
    const qWords = englishQuery.split(/[\s-]+/).filter((w) => w.length > 2);

    const scored = manifest
      .map((item) => {
        let score = 0;
        const titleLower = item.title.toLowerCase();
        const filenameLower = item.filename.toLowerCase();
        const itemMuscle = mapCategoryToMuscleGroup(item.category);

        // Bonificación de categoría si coincide con el músculo detectado
        if (detectedMuscle && itemMuscle === detectedMuscle) {
          score += 100;
        }

        // Coincidencia exacta o por prefijo
        if (titleLower === englishQuery) {
          score += 600;
        } else if (titleLower.startsWith(englishQuery)) {
          score += 300;
        } else if (titleLower.includes(englishQuery)) {
          score += 180;
        }

        // Palabras clave
        for (const w of qWords) {
          if (titleLower.includes(w)) score += 60;
          if (filenameLower.includes(w)) score += 30;
        }

        // Bonificación de equipamiento si coincide
        if (translation.detectedEquipment) {
          const eqLower = translation.detectedEquipment.toLowerCase();
          if (eqLower.includes("mancuerna") && titleLower.includes("dumbbell")) score += 50;
          if (eqLower.includes("barra") && titleLower.includes("barbell")) score += 50;
          if (eqLower.includes("polea") && titleLower.includes("cable")) score += 50;
          if (eqLower.includes("máquina") && (titleLower.includes("lever") || titleLower.includes("machine") || titleLower.includes("sled"))) score += 50;
        }

        return { item, score };
      })
      .filter((s) => s.score >= 120)
      .sort((a, b) => b.score - a.score);

    if (scored.length > 0) {
      const best = scored[0].item;
      const primaryMuscle = mapCategoryToMuscleGroup(best.category);

      return {
        id: `catalog-${best.filename.replace(".gif", "").replace(/[^a-z0-9_-]/g, "_")}`,
        name: exerciseName,
        aliases: [best.title, englishQuery],
        primaryMuscle,
        secondaryMuscles: [],
        equipment: translation.detectedEquipment || detectEquipmentFromTitle(best.title),
        gifUrl: best.cdnUrl,
        cdnUrl: best.cdnUrl,
        posterUrl: best.cdnUrl,
        difficulty: "intermediate",
      };
    }
  }

  // 4. Fallback inteligente por grupo muscular (NUNCA press de pecho universal)
  const finalMuscle: MuscleGroup = detectedMuscle || "chest";
  const fallbackCdn = MUSCLE_FALLBACK_GIFS[finalMuscle] || MUSCLE_FALLBACK_GIFS.chest;

  return {
    id: `fallback-${translation.cleanOriginal.replace(/[^a-z0-9_-]/g, "-")}`,
    name: exerciseName,
    aliases: [englishQuery],
    primaryMuscle: finalMuscle,
    secondaryMuscles: [],
    equipment: translation.detectedEquipment || "Gimnasio",
    gifUrl: fallbackCdn,
    cdnUrl: fallbackCdn,
    posterUrl: fallbackCdn,
  };
}
