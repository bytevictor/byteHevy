import { ExerciseMedia, MuscleGroup } from "@/types/exercise-media";

export const MUSCLE_LABELS: Record<MuscleGroup, string> = {
  chest: "Pectoral",
  lats: "Dorsal Ancho",
  upper_back: "Espalda Alta / Trapecios",
  biceps: "Bíceps",
  triceps: "Tríceps",
  forearms: "Antebrazos",
  shoulders: "Hombros (Deltoides)",
  quads: "Cuádriceps",
  hamstrings: "Isquiotibiales",
  calves: "Gemelos",
  abs: "Core / Abdomen",
  cardio: "Cardiovascular",
};

export const LOCAL_MEDIA_BASE = "/media/exercises";
export const CDN_BASE = "https://cdn.jsdelivr.net/gh/JahelCuadrado/ExerciseGymGifsDB@v1.1.0";

// Fallbacks de alta calidad por grupo muscular desde CDN (NUNCA press banca para todo)
export const MUSCLE_FALLBACK_GIFS: Record<MuscleGroup, string> = {
  chest: `${CDN_BASE}/pectorals/barbell-bench-press.gif`,
  lats: `${CDN_BASE}/lats/pull-up.gif`,
  upper_back: `${CDN_BASE}/upper-back/cable-seated-row.gif`,
  biceps: `${CDN_BASE}/biceps/dumbbell-biceps-curl.gif`,
  triceps: `${CDN_BASE}/triceps/cable-pushdown.gif`,
  forearms: `${CDN_BASE}/forearms/dumbbell-seated-palms-up-wrist-curl.gif`,
  shoulders: `${CDN_BASE}/delts/barbell-seated-overhead-press.gif`,
  quads: `${CDN_BASE}/glutes/barbell-full-squat.gif`,
  hamstrings: `${CDN_BASE}/hamstrings/lever-lying-leg-curl.gif`,
  calves: `${CDN_BASE}/calves/hack-calf-raise.gif`,
  abs: `${CDN_BASE}/abs/hanging-leg-raise.gif`,
  cardio: `${CDN_BASE}/cardio/walking-on-incline-treadmill.gif`,
};

// Catálogo anatómico 3D GymVisual / ExerciseDB exacto con URLs CDN remotas para descarga en LXC limpios
export const EXERCISE_MEDIA_REGISTRY: ExerciseMedia[] = [
  {
    id: "butterfly-pec-deck",
    name: "Butterfly (Pec Deck)",
    aliases: ["pec deck", "aperturas en maquina", "butterfly", "lever seated fly"],
    primaryMuscle: "chest",
    secondaryMuscles: ["shoulders"],
    equipment: "Máquina de aperturas / Pec Deck",
    gifUrl: `${LOCAL_MEDIA_BASE}/butterfly-pec-deck_anim.gif`,
    cdnUrl: `${CDN_BASE}/pectorals/lever-seated-fly.gif`,
  },
  {
    id: "chest-press-machine",
    name: "Chest Press (Machine)",
    aliases: ["chest press", "press de pecho máquina", "lever chest press"],
    primaryMuscle: "chest",
    secondaryMuscles: ["triceps", "shoulders"],
    equipment: "Máquina de palanca guiada",
    gifUrl: `${LOCAL_MEDIA_BASE}/chest-press-machine_anim.gif`,
    cdnUrl: `${CDN_BASE}/pectorals/lever-chest-press.gif`,
  },
  {
    id: "iso-lateral-chest-press",
    name: "Iso-Lateral Chest Press (Machine)",
    aliases: ["iso lateral", "iso-lateral", "press convergente"],
    primaryMuscle: "chest",
    secondaryMuscles: ["triceps", "shoulders"],
    equipment: "Máquina convergente de pecho",
    gifUrl: `${LOCAL_MEDIA_BASE}/iso-lateral-chest-press_anim.gif`,
    cdnUrl: `${CDN_BASE}/pectorals/lever-chest-press.gif`,
  },
  {
    id: "push-up-weighted",
    name: "Push Up (Weighted)",
    aliases: ["push up", "flexiones", "push-up"],
    primaryMuscle: "chest",
    secondaryMuscles: ["triceps", "abs"],
    equipment: "Peso corporal / Disco lastre",
    gifUrl: `${LOCAL_MEDIA_BASE}/push-up-weighted_anim.gif`,
    cdnUrl: `${CDN_BASE}/pectorals/push-up.gif`,
  },
  {
    id: "pull-up-weighted",
    name: "Pull Up (Weighted)",
    aliases: ["pull up", "dominadas", "chin up", "weighted pull up"],
    primaryMuscle: "lats",
    secondaryMuscles: ["biceps", "upper_back", "forearms"],
    equipment: "Barra de dominadas + Cinturón de lastre",
    gifUrl: `${LOCAL_MEDIA_BASE}/pull-up-weighted_anim.gif`,
    cdnUrl: `${CDN_BASE}/lats/pull-up.gif`,
  },
  {
    id: "seated-cable-row",
    name: "Seated Cable Row - Bar Grip",
    aliases: ["cable row", "seated row", "remo en polea", "remo sentado"],
    primaryMuscle: "upper_back",
    secondaryMuscles: ["lats", "biceps"],
    equipment: "Polea baja con agarre barra",
    gifUrl: `${LOCAL_MEDIA_BASE}/seated-cable-row_anim.gif`,
    cdnUrl: `${CDN_BASE}/upper-back/cable-seated-row.gif`,
  },
  {
    id: "seated-row-machine",
    name: "Seated Row (Machine)",
    aliases: ["remo maquina", "lever seated row"],
    primaryMuscle: "upper_back",
    secondaryMuscles: ["lats", "biceps"],
    equipment: "Máquina de remo sentado con apoyo",
    gifUrl: `${LOCAL_MEDIA_BASE}/seated-row-machine_anim.gif`,
    cdnUrl: `${CDN_BASE}/upper-back/lever-seated-row.gif`,
  },
  {
    id: "seated-shoulder-press",
    name: "Seated Shoulder Press (Machine)",
    aliases: ["shoulder press", "press militar maquina", "lever shoulder press"],
    primaryMuscle: "shoulders",
    secondaryMuscles: ["triceps", "upper_back"],
    equipment: "Máquina de hombro sentado",
    gifUrl: `${LOCAL_MEDIA_BASE}/seated-shoulder-press_anim.gif`,
    cdnUrl: `${CDN_BASE}/delts/lever-shoulder-press.gif`,
  },
  {
    id: "triceps-pushdown",
    name: "Triceps Pushdown",
    aliases: ["triceps cable", "extension triceps", "pushdown"],
    primaryMuscle: "triceps",
    secondaryMuscles: ["forearms"],
    equipment: "Polea alta con barra o cuerda",
    gifUrl: `${LOCAL_MEDIA_BASE}/triceps-pushdown_anim.gif`,
    cdnUrl: `${CDN_BASE}/triceps/cable-pushdown.gif`,
  },
  {
    id: "triceps-dip-weighted",
    name: "Triceps Dip (Weighted)",
    aliases: ["triceps dip", "fondos", "chest dip", "dip"],
    primaryMuscle: "triceps",
    secondaryMuscles: ["chest", "shoulders"],
    equipment: "Barras paralelas de fondos",
    gifUrl: `${LOCAL_MEDIA_BASE}/triceps-dip-weighted_anim.gif`,
    cdnUrl: `${CDN_BASE}/triceps/triceps-dip.gif`,
  },
  {
    id: "triceps-dip",
    name: "Triceps Dip",
    aliases: ["fondos en paralelas"],
    primaryMuscle: "triceps",
    secondaryMuscles: ["chest", "shoulders"],
    equipment: "Barras paralelas",
    gifUrl: `${LOCAL_MEDIA_BASE}/triceps-dip_anim.gif`,
    cdnUrl: `${CDN_BASE}/triceps/triceps-dip.gif`,
  },
  {
    id: "preacher-curl-dumbbell",
    name: "Preacher Curl (Dumbbell)",
    aliases: ["preacher curl", "curl predicador", "scott curl"],
    primaryMuscle: "biceps",
    secondaryMuscles: ["forearms"],
    equipment: "Banco Scott + Mancuerna",
    gifUrl: `${LOCAL_MEDIA_BASE}/preacher-curl-dumbbell_anim.gif`,
    cdnUrl: `${CDN_BASE}/biceps/dumbbell-preacher-curl.gif`,
  },
  {
    id: "alternating-hammer-curl",
    name: "Alternating Hammer Curl",
    aliases: [
      "alternating hammer curl",
      "dumbbell alternating hammer curl",
      "curl martillo alterno",
      "curl martillo",
      "hammer curl",
    ],
    primaryMuscle: "biceps",
    secondaryMuscles: ["forearms"],
    equipment: "Mancuernas",
    gifUrl: `${LOCAL_MEDIA_BASE}/alternating-hammer-curl_anim.gif`,
    cdnUrl: `${CDN_BASE}/biceps/dumbbell-alternate-seated-hammer-curl.gif`,
  },
  {
    id: "bicep-curl-dumbbell",
    name: "Bicep Curl (Dumbbell)",
    aliases: [
      "bicep curl",
      "bicep curl (dumbbell)",
      "dumbbell bicep curl",
      "curl mancuerna",
      "curl de bíceps",
      "curl de bicep",
      "curl bíceps",
      "curl bicep",
    ],
    primaryMuscle: "biceps",
    secondaryMuscles: ["forearms"],
    equipment: "Mancuernas",
    gifUrl: `${LOCAL_MEDIA_BASE}/bicep-curl-dumbbell_anim.gif`,
    cdnUrl: `${CDN_BASE}/biceps/dumbbell-biceps-curl.gif`,
  },
  {
    id: "cross-body-hammer-curl",
    name: "Cross Body Hammer Curl",
    aliases: ["cross body", "hammer curl", "curl martillo cruzado"],
    primaryMuscle: "biceps",
    secondaryMuscles: ["forearms"],
    equipment: "Mancuernas",
    gifUrl: `${LOCAL_MEDIA_BASE}/cross-body-hammer-curl_anim.gif`,
    cdnUrl: `${CDN_BASE}/biceps/dumbbell-cross-body-hammer-curl.gif`,
  },
  {
    id: "sulek-curl",
    name: "Curl Antebrazo (Sulek Curl)",
    aliases: ["sulek", "wrist curl", "antebrazo", "curl antebrazo"],
    primaryMuscle: "forearms",
    secondaryMuscles: ["biceps"],
    equipment: "Mancuerna apoyada en banco",
    gifUrl: `${LOCAL_MEDIA_BASE}/sulek-curl_anim.gif`,
    cdnUrl: `${CDN_BASE}/forearms/dumbbell-seated-palms-up-wrist-curl.gif`,
  },
  {
    id: "dead-hang",
    name: "Dead Hang",
    aliases: ["colgado", "dead hang bar", "suspensión"],
    primaryMuscle: "forearms",
    secondaryMuscles: ["lats", "shoulders"],
    equipment: "Barra fija de dominadas",
    gifUrl: `${LOCAL_MEDIA_BASE}/dead-hang_anim.gif`,
    cdnUrl: `${CDN_BASE}/lats/pull-up.gif`,
  },
  {
    id: "front-lever-raise",
    name: "Front Lever Raise",
    aliases: ["front lever", "lever raise"],
    primaryMuscle: "lats",
    secondaryMuscles: ["abs", "forearms"],
    equipment: "Barra fija de calistenia",
    gifUrl: `${LOCAL_MEDIA_BASE}/front-lever-raise_anim.gif`,
    cdnUrl: `${CDN_BASE}/abs/hanging-leg-raise.gif`,
  },
  {
    id: "lying-leg-curl",
    name: "Lying Leg Curl (Machine)",
    aliases: ["leg curl", "femoral tumbado", "curl femoral"],
    primaryMuscle: "hamstrings",
    secondaryMuscles: ["calves"],
    equipment: "Máquina de femoral tumbado",
    gifUrl: `${LOCAL_MEDIA_BASE}/lying-leg-curl_anim.gif`,
    cdnUrl: `${CDN_BASE}/hamstrings/lever-lying-leg-curl.gif`,
  },
  {
    id: "leg-extension-machine",
    name: "Leg Extension (Machine)",
    aliases: ["leg extension", "extensiones de cuadriceps"],
    primaryMuscle: "quads",
    secondaryMuscles: [],
    equipment: "Máquina de cuádriceps",
    gifUrl: `${LOCAL_MEDIA_BASE}/leg-extension-machine_anim.gif`,
    cdnUrl: `${CDN_BASE}/quads/lever-leg-extension.gif`,
  },
  {
    id: "leg-press-horizontal",
    name: "Leg Press Horizontal (Machine)",
    aliases: ["leg press", "prensa horizontal", "prensa de piernas"],
    primaryMuscle: "quads",
    secondaryMuscles: ["hamstrings", "calves"],
    equipment: "Prensa de discos / guiada",
    gifUrl: `${LOCAL_MEDIA_BASE}/leg-press-horizontal_anim.gif`,
    cdnUrl: `${CDN_BASE}/glutes/sled-45-leg-press.gif`,
  },
  {
    id: "single-leg-press",
    name: "Single Leg Press (Machine)",
    aliases: ["single leg press", "prensa una pierna"],
    primaryMuscle: "quads",
    secondaryMuscles: ["hamstrings"],
    equipment: "Prensa de piernas unilateral",
    gifUrl: `${LOCAL_MEDIA_BASE}/single-leg-press_anim.gif`,
    cdnUrl: `${CDN_BASE}/glutes/lever-horizontal-one-leg-press.gif`,
  },
  {
    id: "squat-bodyweight",
    name: "Squat (Bodyweight)",
    aliases: ["squat", "sentadillas", "air squat", "sentadilla libre"],
    primaryMuscle: "quads",
    secondaryMuscles: ["hamstrings", "calves"],
    equipment: "Peso corporal",
    gifUrl: `${LOCAL_MEDIA_BASE}/squat-bodyweight_anim.gif`,
    cdnUrl: `${CDN_BASE}/glutes/barbell-full-squat.gif`,
  },
  {
    id: "treadmill",
    name: "Treadmill",
    aliases: ["cinta", "running", "treadmill running"],
    primaryMuscle: "cardio",
    secondaryMuscles: ["calves", "quads"],
    equipment: "Cinta de correr",
    gifUrl: `${LOCAL_MEDIA_BASE}/treadmill_anim.gif`,
    cdnUrl: `${CDN_BASE}/cardio/walking-on-incline-treadmill.gif`,
  },
  {
    id: "barbell-bench-press",
    name: "Barbell Bench Press",
    aliases: ["bench press", "press banca", "press de banca con barra"],
    primaryMuscle: "chest",
    secondaryMuscles: ["triceps", "shoulders"],
    equipment: "Banco plano + Barra olímpica",
    gifUrl: `${LOCAL_MEDIA_BASE}/barbell-bench-press_anim.gif`,
    cdnUrl: `${CDN_BASE}/pectorals/barbell-bench-press.gif`,
  },
  {
    id: "barbell-incline-bench-press",
    name: "Barbell Incline Bench Press",
    aliases: ["incline bench press", "press banca inclinado", "press inclinado barra"],
    primaryMuscle: "chest",
    secondaryMuscles: ["shoulders", "triceps"],
    equipment: "Banco inclinado + Barra olímpica",
    gifUrl: `${LOCAL_MEDIA_BASE}/barbell-incline-bench-press_anim.gif`,
    cdnUrl: `${CDN_BASE}/pectorals/barbell-incline-bench-press.gif`,
  },
  {
    id: "barbell-shoulder-press",
    name: "Barbell Shoulder Press",
    aliases: ["overhead press", "press militar", "shoulder press", "press militar barra"],
    primaryMuscle: "shoulders",
    secondaryMuscles: ["triceps", "upper_back"],
    equipment: "Barra olímpica",
    gifUrl: `${LOCAL_MEDIA_BASE}/barbell-shoulder-press_anim.gif`,
    cdnUrl: `${CDN_BASE}/delts/barbell-seated-overhead-press.gif`,
  },
  {
    id: "barbell-squat",
    name: "Barbell Squat",
    aliases: ["back squat", "sentadilla con barra", "sentadilla trasera"],
    primaryMuscle: "quads",
    secondaryMuscles: ["hamstrings", "calves", "abs"],
    equipment: "Rack de sentadillas + Barra",
    gifUrl: `${LOCAL_MEDIA_BASE}/barbell-squat_anim.gif`,
    cdnUrl: `${CDN_BASE}/glutes/barbell-full-squat.gif`,
  },
  {
    id: "hack-squat",
    name: "Hack Squat",
    aliases: ["hack", "sentadilla hack", "prensa hack"],
    primaryMuscle: "quads",
    secondaryMuscles: ["hamstrings", "calves"],
    equipment: "Máquina Hack Squat",
    gifUrl: `${LOCAL_MEDIA_BASE}/hack-squat_anim.gif`,
    cdnUrl: `${CDN_BASE}/glutes/sled-hack-squat.gif`,
  },
  {
    id: "cable-reverse-fly",
    name: "Cable Reverse Fly",
    aliases: ["rear delt fly", "pajaros en polea", "cable rear delt", "aperturas inversas"],
    primaryMuscle: "shoulders",
    secondaryMuscles: ["upper_back"],
    equipment: "Doble polea",
    gifUrl: `${LOCAL_MEDIA_BASE}/cable-reverse-fly_anim.gif`,
    cdnUrl: `${CDN_BASE}/delts/cable-standing-cross-over-high-reverse-fly.gif`,
  },
  {
    id: "machine-assisted-pull-up",
    name: "Machine Assisted Pull-Up",
    aliases: ["assisted pull up", "dominadas asistidas", "maquina dominadas"],
    primaryMuscle: "lats",
    secondaryMuscles: ["biceps", "upper_back"],
    equipment: "Máquina de dominadas asistidas",
    gifUrl: `${LOCAL_MEDIA_BASE}/machine-assisted-pull-up_anim.gif`,
    cdnUrl: `${CDN_BASE}/lats/assisted-pull-up.gif`,
  },
  {
    id: "machine-inner-chest-press",
    name: "Machine Inner Chest Press",
    aliases: ["inner chest press", "press cerrado maquina"],
    primaryMuscle: "chest",
    secondaryMuscles: ["triceps", "shoulders"],
    equipment: "Máquina de palanca guiada",
    gifUrl: `${LOCAL_MEDIA_BASE}/machine-inner-chest-press_anim.gif`,
    cdnUrl: `${CDN_BASE}/pectorals/machine-inner-chest-press.gif`,
  },
  {
    id: "leg-raise",
    name: "Leg Raise",
    aliases: ["elevaciones de piernas", "hanging leg raise", "elevacion de piernas"],
    primaryMuscle: "abs",
    secondaryMuscles: ["forearms"],
    equipment: "Barra de dominadas / Suelo",
    gifUrl: `${LOCAL_MEDIA_BASE}/leg-raise_anim.gif`,
    cdnUrl: `${CDN_BASE}/abs/hanging-leg-raise.gif`,
  },
  {
    id: "twists",
    name: "Twists",
    aliases: ["russian twists", "giros rusos", "twist"],
    primaryMuscle: "abs",
    secondaryMuscles: [],
    equipment: "Esterilla / Disco",
    gifUrl: `${LOCAL_MEDIA_BASE}/twists_anim.gif`,
    cdnUrl: `${CDN_BASE}/abs/russian-twist.gif`,
  },
];

/**
 * Busca los metadatos multimedia de un ejercicio por coincidencia exacta o por alias.
 * Si no coincide con el registro estático, deduce el músculo principal (Español o Inglés)
 * y devuelve el GIF animado por defecto para ese músculo concreto (NUNCA press de pecho universal).
 */
export function getExerciseMedia(exerciseName: string): ExerciseMedia {
  const normalized = exerciseName.toLowerCase().trim();

  // 1. Búsqueda directa por nombre exacto
  const exact = EXERCISE_MEDIA_REGISTRY.find(
    (e) => e.name.toLowerCase() === normalized
  );
  if (exact) return exact;

  // 2. Búsqueda por alias exacto (ej. "incline bench press" coincide con el inclinado, no con el plano)
  const exactAlias = EXERCISE_MEDIA_REGISTRY.find((e) =>
    e.aliases.some((alias) => alias.toLowerCase() === normalized)
  );
  if (exactAlias) return exactAlias;

  // 3. Búsqueda por contención ordenada por mayor especificidad (alias más largos primero)
  const sortedBySpecificity = [...EXERCISE_MEDIA_REGISTRY].sort((a, b) => {
    const maxA = Math.max(...a.aliases.map((al) => al.length));
    const maxB = Math.max(...b.aliases.map((al) => al.length));
    return maxB - maxA;
  });

  const byAlias = sortedBySpecificity.find((e) =>
    e.aliases.some((alias) => {
      const aLower = alias.toLowerCase();
      return normalized.includes(aLower) || aLower.includes(normalized);
    })
  );
  if (byAlias) return byAlias;

  // 4. Deducción heurística de músculo principal (soporta términos en inglés y español)
  let primary: MuscleGroup = "chest";

  if (
    normalized.includes("sentadilla") ||
    normalized.includes("squat") ||
    normalized.includes("prensa") ||
    normalized.includes("leg press") ||
    normalized.includes("cuadriceps") ||
    normalized.includes("cuádriceps") ||
    normalized.includes("quad") ||
    normalized.includes("zancada") ||
    normalized.includes("lunge") ||
    normalized.includes("extension de pierna") ||
    normalized.includes("extensión de pierna")
  ) {
    primary = "quads";
  } else if (
    normalized.includes("femoral") ||
    normalized.includes("hamstring") ||
    normalized.includes("isquiotibial") ||
    normalized.includes("peso muerto") ||
    normalized.includes("deadlift") ||
    normalized.includes("hip thrust") ||
    normalized.includes("glute")
  ) {
    primary = "hamstrings";
  } else if (
    normalized.includes("dorsal") ||
    normalized.includes("lat") ||
    normalized.includes("jalon") ||
    normalized.includes("jalón") ||
    normalized.includes("pulldown") ||
    normalized.includes("chest pull") ||
    normalized.includes("dominada") ||
    normalized.includes("pull up") ||
    normalized.includes("pull-up") ||
    normalized.includes("chin up")
  ) {
    primary = "lats";
  } else if (
    normalized.includes("remo") ||
    normalized.includes("row") ||
    normalized.includes("trapecio") ||
    normalized.includes("espalda alta")
  ) {
    primary = "upper_back";
  } else if (
    (normalized.includes("curl") && !normalized.includes("leg") && !normalized.includes("femoral")) ||
    normalized.includes("bicep") ||
    normalized.includes("bíceps") ||
    normalized.includes("martillo") ||
    normalized.includes("predicador") ||
    normalized.includes("scott")
  ) {
    primary = "biceps";
  } else if (
    normalized.includes("triceps") ||
    normalized.includes("tríceps") ||
    normalized.includes("pushdown") ||
    normalized.includes("fondos") ||
    normalized.includes("dip") ||
    normalized.includes("frances") ||
    normalized.includes("francés")
  ) {
    primary = "triceps";
  } else if (
    normalized.includes("hombro") ||
    normalized.includes("shoulder") ||
    normalized.includes("delt") ||
    normalized.includes("overhead") ||
    normalized.includes("militar") ||
    normalized.includes("lateral raise") ||
    normalized.includes("elevacion lateral") ||
    normalized.includes("elevación lateral") ||
    normalized.includes("pajaro") ||
    normalized.includes("pájaro")
  ) {
    primary = "shoulders";
  } else if (
    normalized.includes("antebrazo") ||
    normalized.includes("wrist") ||
    normalized.includes("muñeca") ||
    normalized.includes("sulek") ||
    normalized.includes("hang")
  ) {
    primary = "forearms";
  } else if (
    normalized.includes("gemelo") ||
    normalized.includes("calf") ||
    normalized.includes("calves") ||
    normalized.includes("talon") ||
    normalized.includes("talón")
  ) {
    primary = "calves";
  } else if (
    normalized.includes("abdomen") ||
    normalized.includes("ab") ||
    normalized.includes("abs") ||
    normalized.includes("crunch") ||
    normalized.includes("core") ||
    normalized.includes("plank") ||
    normalized.includes("plancha") ||
    normalized.includes("twist")
  ) {
    primary = "abs";
  } else if (
    normalized.includes("cinta") ||
    normalized.includes("treadmill") ||
    normalized.includes("run") ||
    normalized.includes("cardio") ||
    normalized.includes("bici") ||
    normalized.includes("bike")
  ) {
    primary = "cardio";
  } else if (
    normalized.includes("pecho") ||
    normalized.includes("pectoral") ||
    normalized.includes("bench") ||
    normalized.includes("chest") ||
    normalized.includes("flexion") ||
    normalized.includes("flexión") ||
    normalized.includes("push up") ||
    normalized.includes("push-up") ||
    normalized.includes("fly") ||
    normalized.includes("apertura")
  ) {
    primary = "chest";
  }

  const fallbackCdn = MUSCLE_FALLBACK_GIFS[primary] || MUSCLE_FALLBACK_GIFS.chest;

  return {
    id: `fallback-${normalized.replace(/[^a-z0-9_-]/g, "-")}`,
    name: exerciseName,
    aliases: [],
    primaryMuscle: primary,
    secondaryMuscles: [],
    equipment: "Gimnasio",
    gifUrl: fallbackCdn,
    cdnUrl: fallbackCdn,
    posterUrl: fallbackCdn,
  };
}
