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

const CDN_BASE = "https://cdn.jsdelivr.net/gh/JahelCuadrado/ExerciseGymGifsDB@v1.1.0";

// Catálogo anatómico 3D GymVisual / ExerciseDB exacto
export const EXERCISE_MEDIA_REGISTRY: ExerciseMedia[] = [
  {
    id: "butterfly-pec-deck",
    name: "Butterfly (Pec Deck)",
    aliases: ["pec deck", "aperturas en maquina", "butterfly", "lever seated fly"],
    primaryMuscle: "chest",
    secondaryMuscles: ["shoulders"],
    equipment: "Máquina de aperturas / Pec Deck",
    gifUrl: `${CDN_BASE}/pectorals/lever-seated-fly.gif`,
  },
  {
    id: "chest-press-machine",
    name: "Chest Press (Machine)",
    aliases: ["chest press", "press de pecho máquina", "lever chest press"],
    primaryMuscle: "chest",
    secondaryMuscles: ["triceps", "shoulders"],
    equipment: "Máquina de palanca guiada",
    gifUrl: `${CDN_BASE}/pectorals/lever-chest-press.gif`,
  },
  {
    id: "iso-lateral-chest-press",
    name: "Iso-Lateral Chest Press (Machine)",
    aliases: ["iso lateral", "iso-lateral", "press convergente"],
    primaryMuscle: "chest",
    secondaryMuscles: ["triceps", "shoulders"],
    equipment: "Máquina convergente de pecho",
    gifUrl: `${CDN_BASE}/pectorals/lever-chest-press.gif`,
  },
  {
    id: "push-up-weighted",
    name: "Push Up (Weighted)",
    aliases: ["push up", "flexiones", "push-up"],
    primaryMuscle: "chest",
    secondaryMuscles: ["triceps", "abs"],
    equipment: "Peso corporal / Disco lastre",
    gifUrl: `${CDN_BASE}/pectorals/push-up.gif`,
  },
  {
    id: "pull-up-weighted",
    name: "Pull Up (Weighted)",
    aliases: ["pull up", "dominadas", "chin up", "weighted pull up"],
    primaryMuscle: "lats",
    secondaryMuscles: ["biceps", "upper_back", "forearms"],
    equipment: "Barra de dominadas + Cinturón de lastre",
    gifUrl: `${CDN_BASE}/lats/weighted-pull-up.gif`,
  },
  {
    id: "seated-cable-row",
    name: "Seated Cable Row - Bar Grip",
    aliases: ["cable row", "seated row", "remo en polea", "remo sentado"],
    primaryMuscle: "upper_back",
    secondaryMuscles: ["lats", "biceps"],
    equipment: "Polea baja con agarre barra",
    gifUrl: `${CDN_BASE}/upper-back/cable-seated-row.gif`,
  },
  {
    id: "seated-row-machine",
    name: "Seated Row (Machine)",
    aliases: ["remo maquina", "lever seated row"],
    primaryMuscle: "upper_back",
    secondaryMuscles: ["lats", "biceps"],
    equipment: "Máquina de remo sentado con apoyo",
    gifUrl: `${CDN_BASE}/upper-back/lever-seated-row.gif`,
  },
  {
    id: "seated-shoulder-press",
    name: "Seated Shoulder Press (Machine)",
    aliases: ["shoulder press", "press militar maquina", "lever shoulder press"],
    primaryMuscle: "shoulders",
    secondaryMuscles: ["triceps", "upper_back"],
    equipment: "Máquina de hombro sentado",
    gifUrl: `${CDN_BASE}/delts/lever-shoulder-press.gif`,
  },
  {
    id: "triceps-pushdown",
    name: "Triceps Pushdown",
    aliases: ["triceps cable", "extension triceps", "pushdown"],
    primaryMuscle: "triceps",
    secondaryMuscles: ["forearms"],
    equipment: "Polea alta con barra o cuerda",
    gifUrl: `${CDN_BASE}/triceps/cable-pushdown.gif`,
  },
  {
    id: "triceps-dip-weighted",
    name: "Triceps Dip (Weighted)",
    aliases: ["triceps dip", "fondos", "chest dip", "dip"],
    primaryMuscle: "triceps",
    secondaryMuscles: ["chest", "shoulders"],
    equipment: "Barras paralelas de fondos",
    gifUrl: `${CDN_BASE}/pectorals/chest-dip.gif`,
  },
  {
    id: "triceps-dip",
    name: "Triceps Dip",
    aliases: ["fondos en paralelas"],
    primaryMuscle: "triceps",
    secondaryMuscles: ["chest", "shoulders"],
    equipment: "Barras paralelas",
    gifUrl: `${CDN_BASE}/pectorals/chest-dip.gif`,
  },
  {
    id: "preacher-curl-dumbbell",
    name: "Preacher Curl (Dumbbell)",
    aliases: ["preacher curl", "curl predicador", "scott curl"],
    primaryMuscle: "biceps",
    secondaryMuscles: ["forearms"],
    equipment: "Banco Scott + Mancuerna",
    gifUrl: `${CDN_BASE}/biceps/dumbbell-preacher-curl.gif`,
  },
  {
    id: "bicep-curl-dumbbell",
    name: "Bicep Curl (Dumbbell)",
    aliases: ["bicep curl", "curl mancuerna", "curl de bíceps"],
    primaryMuscle: "biceps",
    secondaryMuscles: ["forearms"],
    equipment: "Mancuernas",
    gifUrl: `${CDN_BASE}/biceps/dumbbell-biceps-curl.gif`,
  },
  {
    id: "cross-body-hammer-curl",
    name: "Cross Body Hammer Curl",
    aliases: ["cross body", "hammer curl", "curl martillo cruzado"],
    primaryMuscle: "biceps",
    secondaryMuscles: ["forearms"],
    equipment: "Mancuernas",
    gifUrl: `${CDN_BASE}/biceps/dumbbell-cross-body-hammer-curl.gif`,
  },
  {
    id: "sulek-curl",
    name: "Curl Antebrazo (Sulek Curl)",
    aliases: ["sulek", "wrist curl", "antebrazo", "curl antebrazo"],
    primaryMuscle: "forearms",
    secondaryMuscles: ["biceps"],
    equipment: "Mancuerna apoyada en banco",
    gifUrl: `${CDN_BASE}/biceps/dumbbell-seated-neutral-wrist-curl.gif`,
  },
  {
    id: "dead-hang",
    name: "Dead Hang",
    aliases: ["colgado", "dead hang bar", "suspensión"],
    primaryMuscle: "forearms",
    secondaryMuscles: ["lats", "shoulders"],
    equipment: "Barra fija de dominadas",
    gifUrl: `${CDN_BASE}/lats/pull-up.gif`,
  },
  {
    id: "front-lever-raise",
    name: "Front Lever Raise",
    aliases: ["front lever", "lever raise"],
    primaryMuscle: "lats",
    secondaryMuscles: ["abs", "forearms"],
    equipment: "Barra fija de calistenia",
    gifUrl: `${CDN_BASE}/abs/front-lever.gif`,
  },
  {
    id: "lying-leg-curl",
    name: "Lying Leg Curl (Machine)",
    aliases: ["leg curl", "femoral tumbado", "curl femoral"],
    primaryMuscle: "hamstrings",
    secondaryMuscles: ["calves"],
    equipment: "Máquina de femoral tumbado",
    gifUrl: `${CDN_BASE}/hamstrings/lever-lying-leg-curl.gif`,
  },
  {
    id: "leg-extension-machine",
    name: "Leg Extension (Machine)",
    aliases: ["leg extension", "extensiones de cuadriceps"],
    primaryMuscle: "quads",
    secondaryMuscles: [],
    equipment: "Máquina de cuádriceps",
    gifUrl: `${CDN_BASE}/quads/lever-leg-extension.gif`,
  },
  {
    id: "leg-press-horizontal",
    name: "Leg Press Horizontal (Machine)",
    aliases: ["leg press", "prensa horizontal", "prensa de piernas"],
    primaryMuscle: "quads",
    secondaryMuscles: ["hamstrings", "calves"],
    equipment: "Prensa de discos / guiada",
    gifUrl: `${CDN_BASE}/glutes/sled-45-leg-press.gif`,
  },
  {
    id: "single-leg-press",
    name: "Single Leg Press (Machine)",
    aliases: ["single leg press", "prensa una pierna"],
    primaryMuscle: "quads",
    secondaryMuscles: ["hamstrings"],
    equipment: "Prensa de piernas unilateral",
    gifUrl: `${CDN_BASE}/glutes/lever-horizontal-one-leg-press.gif`,
  },
  {
    id: "squat-bodyweight",
    name: "Squat (Bodyweight)",
    aliases: ["squat", "sentadillas", "air squat", "sentadilla libre"],
    primaryMuscle: "quads",
    secondaryMuscles: ["hamstrings", "calves"],
    equipment: "Peso corporal",
    gifUrl: `${CDN_BASE}/glutes/weighted-squat.gif`,
  },
  {
    id: "treadmill",
    name: "Treadmill",
    aliases: ["cinta", "running"],
    primaryMuscle: "cardio",
    secondaryMuscles: ["calves", "quads"],
    equipment: "Cinta de correr",
    gifUrl: `${CDN_BASE}/cardio/walking-on-incline-treadmill.gif`,
  },
];

/**
 * Busca los metadatos multimedia de un ejercicio por coincidencia exacta o por alias.
 */
export function getExerciseMedia(exerciseName: string): ExerciseMedia {
  const normalized = exerciseName.toLowerCase().trim();

  // Búsqueda directa
  const exact = EXERCISE_MEDIA_REGISTRY.find(
    (e) => e.name.toLowerCase() === normalized
  );
  if (exact) return exact;

  // Búsqueda por alias
  const byAlias = EXERCISE_MEDIA_REGISTRY.find((e) =>
    e.aliases.some((alias) => normalized.includes(alias) || alias.includes(normalized))
  );
  if (byAlias) return byAlias;

  // Fallback heurístico inteligente
  let primary: MuscleGroup = "chest";
  if (normalized.includes("pull") || normalized.includes("row")) primary = "lats";
  else if (normalized.includes("curl") && !normalized.includes("leg")) primary = "biceps";
  else if (normalized.includes("triceps") || normalized.includes("dip")) primary = "triceps";
  else if (normalized.includes("leg") || normalized.includes("squat")) primary = "quads";
  else if (normalized.includes("hang") || normalized.includes("antebrazo")) primary = "forearms";
  else if (normalized.includes("shoulder") || normalized.includes("press")) primary = "shoulders";
  else if (normalized.includes("treadmill") || normalized.includes("run")) primary = "cardio";

  return {
    id: `fallback-${normalized.replace(/\s+/g, "-")}`,
    name: exerciseName,
    aliases: [],
    primaryMuscle: primary,
    secondaryMuscles: [],
    equipment: "Gimnasio",
    gifUrl: `${CDN_BASE}/pectorals/lever-chest-press.gif`,
  };
}
