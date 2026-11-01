import { MuscleGroup } from "@/types/exercise-media";

export interface TranslationResult {
  englishQuery: string;
  detectedEquipment?: string;
  detectedMuscle?: MuscleGroup;
  cleanOriginal: string;
}

interface TranslationRule {
  pattern: RegExp;
  english: string;
  muscle?: MuscleGroup;
  equipment?: string;
}

// Diccionario exhaustivo de traducción gimnasio Español / Jerga gym -> Inglés estándar GymVisual / ExerciseDB
const TRANSLATION_RULES: TranslationRule[] = [
  // --- PECHO / CHEST ---
  { pattern: /press (de )?banca inclinad[oa]/i, english: "barbell incline bench press", muscle: "chest", equipment: "Barra Olímpica" },
  { pattern: /press (de )?banca declinad[oa]/i, english: "barbell decline bench press", muscle: "chest", equipment: "Barra Olímpica" },
  { pattern: /press (de )?banca/i, english: "barbell bench press", muscle: "chest", equipment: "Barra Olímpica" },
  { pattern: /press (de )?pecho en m[aá]quina|press de pecho|chest press/i, english: "lever chest press", muscle: "chest", equipment: "Máquina" },
  { pattern: /press inclinad[oa] con mancuernas?|press mancuernas? inclinad[oa]/i, english: "dumbbell incline bench press", muscle: "chest", equipment: "Mancuerna" },
  { pattern: /press plano con mancuernas?|press mancuernas?/i, english: "dumbbell bench press", muscle: "chest", equipment: "Mancuerna" },
  { pattern: /aperturas? en m[aá]quina|pec deck|peck deck|butterfly|contractor/i, english: "lever seated fly", muscle: "chest", equipment: "Máquina" },
  { pattern: /aperturas? posteriores?|p[aá]jaros|deltoides? posterior|rear delt fly/i, english: "dumbbell reverse fly", muscle: "shoulders", equipment: "Mancuerna" },
  { pattern: /aperturas? inclinadas?|aperturas? con mancuernas?|aperturas?/i, english: "dumbbell fly", muscle: "chest", equipment: "Mancuerna" },
  { pattern: /cruces? en polea|cruce de poleas?|aperturas? en polea/i, english: "cable standing fly", muscle: "chest", equipment: "Polea" },
  { pattern: /flexiones?( de pecho)?|push[- ]?up/i, english: "push-up", muscle: "chest", equipment: "Peso Corporal" },
  { pattern: /pullover|pull over/i, english: "dumbbell pullover", muscle: "chest", equipment: "Mancuerna" },

  // --- ESPALDA / LATS / UPPER BACK ---
  { pattern: /jal[oó]n al pecho|jal[oó]n polea|polea al pecho|lat pulldown/i, english: "cable lat pulldown", muscle: "lats", equipment: "Polea" },
  { pattern: /jal[oó]n tras nuca|rear pulldown/i, english: "cable rear pulldown behind neck", muscle: "lats", equipment: "Polea" },
  { pattern: /jal[oó]n en m[aá]quina|jal[oó]n convergente|machine lat pulldown/i, english: "lever front pulldown", muscle: "lats", equipment: "Máquina" },
  { pattern: /dominadas? asistidas?|assisted pull[- ]?up/i, english: "assisted pull-up", muscle: "lats", equipment: "Máquina" },
  { pattern: /dominadas? neutras?|dominadas? supinas?|dominadas?|chin[- ]?up|pull[- ]?up/i, english: "pull-up", muscle: "lats", equipment: "Peso Corporal" },
  { pattern: /remo con barra|remo 90|remo pendlay|bent over row/i, english: "barbell bent over row", muscle: "upper_back", equipment: "Barra Olímpica" },
  { pattern: /remo con mancuerna|remo serrucho|dumbbell row/i, english: "dumbbell one arm bent over row", muscle: "upper_back", equipment: "Mancuerna" },
  { pattern: /remo en polea|remo sentado|remo gironda|cable seated row/i, english: "cable seated row", muscle: "upper_back", equipment: "Polea" },
  { pattern: /remo en m[aá]quina|remo maquina|lever seated row/i, english: "lever seated row", muscle: "upper_back", equipment: "Máquina" },
  { pattern: /remo t|remo en barra t|t[- ]?bar row/i, english: "lever t-bar row", muscle: "upper_back", equipment: "Barra Olímpica" },
  { pattern: /remo/i, english: "cable seated row", muscle: "upper_back", equipment: "Polea" },
  { pattern: /encogimientos?( de hombros?)?|shrugs?/i, english: "dumbbell shrug", muscle: "upper_back", equipment: "Mancuerna" },
  { pattern: /face[- ]?pull/i, english: "cable face pull", muscle: "shoulders", equipment: "Polea" },
  { pattern: /pulldown brazos rectos|jal[oó]n con brazos rectos/i, english: "cable straight arm pulldown", muscle: "lats", equipment: "Polea" },
  { pattern: /dead hang|colgado( en barra)?|suspensi[oó]n/i, english: "dead hang", muscle: "forearms", equipment: "Peso Corporal" },

  // --- HOMBROS / SHOULDERS / DELTS ---
  { pattern: /press militar|press frontal/i, english: "barbell seated overhead press", muscle: "shoulders", equipment: "Barra Olímpica" },
  { pattern: /press (de )?hombros? con mancuernas?|press hombro mancuerna/i, english: "dumbbell seated shoulder press", muscle: "shoulders", equipment: "Mancuerna" },
  { pattern: /press (de )?hombros? en m[aá]quina|press hombros? m[aá]quina/i, english: "lever shoulder press", muscle: "shoulders", equipment: "Máquina" },
  { pattern: /press (de )?hombros?/i, english: "barbell seated overhead press", muscle: "shoulders", equipment: "Barra Olímpica" },
  { pattern: /elevaciones? laterales? con mancuernas?|elevaciones? laterales?|vuelos laterales?/i, english: "dumbbell lateral raise", muscle: "shoulders", equipment: "Mancuerna" },
  { pattern: /elevaciones? laterales? en polea/i, english: "cable lateral raise", muscle: "shoulders", equipment: "Polea" },
  { pattern: /elevaciones? frontales?/i, english: "dumbbell front raise", muscle: "shoulders", equipment: "Mancuerna" },

  // --- BÍCEPS / BICEPS ---
  { pattern: /curl predicador|curl scott|banco scott/i, english: "dumbbell preacher curl", muscle: "biceps", equipment: "Banco Scott" },
  { pattern: /curl martillo con mancuernas?|curl martillo|hammer curl/i, english: "dumbbell hammer curl", muscle: "biceps", equipment: "Mancuerna" },
  { pattern: /curl martillo cruzado|cross body hammer curl/i, english: "dumbbell cross body hammer curl", muscle: "biceps", equipment: "Mancuerna" },
  { pattern: /curl con barra z?|curl barra ol[ií]mpica/i, english: "barbell biceps curl", muscle: "biceps", equipment: "Barra Olímpica" },
  { pattern: /curl de b[ií]ceps? en polea/i, english: "cable biceps curl", muscle: "biceps", equipment: "Polea" },
  { pattern: /curl concentrado/i, english: "dumbbell concentration curl", muscle: "biceps", equipment: "Mancuerna" },
  { pattern: /curl inclinad[oa] con mancuernas?/i, english: "dumbbell incline inner biceps curl", muscle: "biceps", equipment: "Mancuerna" },
  { pattern: /curl de b[ií]ceps?|curl b[ií]ceps?|curl bicep|bicep curl/i, english: "dumbbell biceps curl", muscle: "biceps", equipment: "Mancuerna" },

  // --- ANTEBRAZOS / FOREARMS ---
  { pattern: /curl antebrazo|curl de mu[nñ]eca|sulek curl|antebrazo|wrist curl/i, english: "dumbbell seated palms up wrist curl", muscle: "forearms", equipment: "Mancuerna" },

  // --- TRÍCEPS / TRICEPS ---
  { pattern: /tr[ií]ceps polea|pushdown/i, english: "cable pushdown", muscle: "triceps", equipment: "Polea" },
  { pattern: /extension(es)? de tr[ií]ceps?( en polea)?/i, english: "cable pushdown", muscle: "triceps", equipment: "Polea" },
  { pattern: /press franc[eé]s|skull crusher/i, english: "barbell lying triceps extension skull crusher", muscle: "triceps", equipment: "Barra Olímpica" },
  { pattern: /fondos en banco|bench dip/i, english: "bench dip on floor", muscle: "triceps", equipment: "Peso Corporal" },
  { pattern: /fondos?( en paralelas?)?|paralelas|triceps dip/i, english: "triceps dip", muscle: "triceps", equipment: "Barras Paralelas" },
  { pattern: /copa tr[ií]ceps?|extensi[oó]n sobre la cabeza con mancuerna/i, english: "dumbbell seated triceps extension", muscle: "triceps", equipment: "Mancuerna" },
  { pattern: /patada de tr[ií]ceps?|kickback/i, english: "dumbbell kickback", muscle: "triceps", equipment: "Mancuerna" },

  // --- PIERNAS / QUADS / LEGS ---
  { pattern: /sentadillas? hack|hack squat/i, english: "sled hack squat", muscle: "quads", equipment: "Máquina Hack" },
  { pattern: /sentadillas? frontales?|front squat/i, english: "barbell front squat", muscle: "quads", equipment: "Barra Olímpica" },
  { pattern: /sentadillas? b[uú]lgaras?|bulgarian split squat/i, english: "dumbbell single leg split squat", muscle: "quads", equipment: "Mancuerna" },
  { pattern: /sentadillas? con mancuernas?|goblet squat/i, english: "dumbbell goblet squat", muscle: "quads", equipment: "Mancuerna" },
  { pattern: /sentadillas? libre|sentadilla con barra|sentadillas?|back squat|squat/i, english: "barbell full squat", muscle: "quads", equipment: "Barra Olímpica" },
  { pattern: /prensa a una pierna|prensa unilateral|single leg press/i, english: "lever horizontal one leg press", muscle: "quads", equipment: "Máquina" },
  { pattern: /prensa inclinada|prensa 45|prensa de piernas?|prensa horizontal|prensa|leg press/i, english: "sled 45 leg press", muscle: "quads", equipment: "Prensa de Discos" },
  { pattern: /extensi[oó]n de piernas?|extensiones? de piernas?|extensiones? de cu[aá]driceps?|leg extension/i, english: "lever leg extension", muscle: "quads", equipment: "Máquina" },
  { pattern: /zancadas?|estocadas?|lunges?/i, english: "dumbbell rear lunge", muscle: "quads", equipment: "Mancuerna" },

  // --- ISQUIOTIBIALES / GLÚTEOS / HAMSTRINGS ---
  { pattern: /femoral tumbado|curl femoral tumbado|lying leg curl/i, english: "lever lying leg curl", muscle: "hamstrings", equipment: "Máquina" },
  { pattern: /femoral sentado|curl femoral sentado|seated leg curl/i, english: "lever seated leg curl", muscle: "hamstrings", equipment: "Máquina" },
  { pattern: /curl femoral|curl de piernas?|leg curl/i, english: "lever lying leg curl", muscle: "hamstrings", equipment: "Máquina" },
  { pattern: /peso muerto rumano|romanian deadlift|rdl/i, english: "barbell romanian deadlift", muscle: "hamstrings", equipment: "Barra Olímpica" },
  { pattern: /peso muerto sumo|sumo deadlift/i, english: "barbell sumo deadlift", muscle: "hamstrings", equipment: "Barra Olímpica" },
  { pattern: /peso muerto con mancuernas?/i, english: "dumbbell romanian deadlift", muscle: "hamstrings", equipment: "Mancuerna" },
  { pattern: /peso muerto|deadlift/i, english: "barbell deadlift", muscle: "hamstrings", equipment: "Barra Olímpica" },
  { pattern: /hip thrust|empuje de cadera|puente de gl[uú]teo/i, english: "barbell glute bridge", muscle: "hamstrings", equipment: "Barra Olímpica" },
  { pattern: /patada de gl[uú]teo|glute kickback/i, english: "cable one arm lateral kick", muscle: "hamstrings", equipment: "Polea" },
  { pattern: /abductores?|abductor/i, english: "lever seated hip abduction", muscle: "hamstrings", equipment: "Máquina" },
  { pattern: /aductores?|adductor/i, english: "lever seated hip adduction", muscle: "quads", equipment: "Máquina" },

  // --- GEMELOS / CALVES ---
  { pattern: /gemelos? de pie|elevaci[oó]n de talones? de pie|standing calf raise/i, english: "standing calf raise", muscle: "calves", equipment: "Máquina" },
  { pattern: /gemelos? sentado|elevaci[oó]n de talones? sentado|seated calf raise/i, english: "lever seated calf raise", muscle: "calves", equipment: "Máquina" },
  { pattern: /gemelos?|elevaci[oó]n de talones?|calf raise/i, english: "hack calf raise", muscle: "calves", equipment: "Máquina" },

  // --- ABDOMEN / CORE / ABS ---
  { pattern: /elevaciones? de piernas? colgado|hanging leg raise/i, english: "hanging leg raise", muscle: "abs", equipment: "Barra de Dominadas" },
  { pattern: /elevaciones? de piernas?|elevaci[oó]n de piernas?|leg raise/i, english: "hanging leg raise", muscle: "abs", equipment: "Esterilla" },
  { pattern: /giros? rusos?|twists?|twist ruso|russian twist/i, english: "russian twist", muscle: "abs", equipment: "Esterilla" },
  { pattern: /rueda abdominal|ab wheel/i, english: "ab wheel rollout", muscle: "abs", equipment: "Rueda Abdominal" },
  { pattern: /plancha( frontal)?|plank/i, english: "front plank", muscle: "abs", equipment: "Esterilla" },
  { pattern: /abdominales?|encogimientos?|crunch/i, english: "crunch", muscle: "abs", equipment: "Esterilla" },
  { pattern: /front lever/i, english: "front lever", muscle: "abs", equipment: "Barra de Dominadas" },

  // --- CARDIO ---
  { pattern: /cinta( de correr)?|treadmill|correr|carrera/i, english: "walking on incline treadmill", muscle: "cardio", equipment: "Cinta de Correr" },
  { pattern: /bicicleta( est[aá]tica)?|bike|ciclo/i, english: "stationary bike", muscle: "cardio", equipment: "Bicicleta" },
  { pattern: /el[ií]ptica|elliptical/i, english: "elliptical trainer", muscle: "cardio", equipment: "Elíptica" },
  { pattern: /remo erg[oó]metro|rowing machine/i, english: "rowing machine", muscle: "cardio", equipment: "Remo Ergómetro" },
  { pattern: /salto a la comba|comba|jump rope/i, english: "jump rope", muscle: "cardio", equipment: "Comba" },
];

/**
 * Traduce y normaliza cualquier nombre de ejercicio (Español, Jefit, Hevy, o variaciones en inglés)
 * a un término estándar de búsqueda en inglés para el catálogo GymVisual / ExerciseDB.
 */
export function translateExerciseNameToEnglish(name: string): TranslationResult {
  const cleanOriginal = name.trim();
  const lower = cleanOriginal.toLowerCase();

  // Detectar equipamiento en paréntesis típico de Hevy: " (Machine)", " (Dumbbell)", " (Barbell)"
  let detectedEquipment: string | undefined;
  if (lower.includes("(machine)") || lower.includes("m[aá]quina") || lower.includes("lever")) {
    detectedEquipment = "Máquina";
  } else if (lower.includes("(dumbbell)") || lower.includes("mancuerna")) {
    detectedEquipment = "Mancuerna";
  } else if (lower.includes("(barbell)") || lower.includes("barra")) {
    detectedEquipment = "Barra Olímpica";
  } else if (lower.includes("(cable)") || lower.includes("polea")) {
    detectedEquipment = "Polea";
  } else if (lower.includes("(smith machine)") || lower.includes("multipower")) {
    detectedEquipment = "Multipower";
  } else if (lower.includes("(bodyweight)") || lower.includes("peso corporal")) {
    detectedEquipment = "Peso Corporal";
  } else if (lower.includes("(weighted)") || lower.includes("lastrado")) {
    detectedEquipment = "Lastrado";
  }

  // 1. Comprobar diccionario de reglas especializadas
  for (const rule of TRANSLATION_RULES) {
    if (rule.pattern.test(cleanOriginal)) {
      return {
        englishQuery: rule.english,
        detectedEquipment: detectedEquipment || rule.equipment,
        detectedMuscle: rule.muscle,
        cleanOriginal,
      };
    }
  }

  // 2. Si no coincide con ninguna regla específica, normalizar eliminando paréntesis de Hevy
  const stripped = cleanOriginal
    .replace(/\s*\([^)]*\)/g, "")
    .trim()
    .toLowerCase();

  // Deducción heurística de grupo muscular por palabras sueltas
  let detectedMuscle: MuscleGroup | undefined;
  if (/pecho|pectoral|bench|chest|fly/i.test(stripped)) detectedMuscle = "chest";
  else if (/dorsal|lats|pull[- ]?up|pulldown|dominada/i.test(stripped)) detectedMuscle = "lats";
  else if (/espalda|trapecio|row|remo/i.test(stripped)) detectedMuscle = "upper_back";
  else if (/b[ií]ceps?|curl|martillo|preacher/i.test(stripped)) detectedMuscle = "biceps";
  else if (/tr[ií]ceps?|pushdown|dip|fondos/i.test(stripped)) detectedMuscle = "triceps";
  else if (/antebrazo|wrist|mu[nñ]eca/i.test(stripped)) detectedMuscle = "forearms";
  else if (/hombro|delt|shoulder|militar|lateral/i.test(stripped)) detectedMuscle = "shoulders";
  else if (/cu[aá]driceps?|quad|sentadilla|squat|prensa|leg press|zancada/i.test(stripped)) detectedMuscle = "quads";
  else if (/femoral|isquio|hamstring|deadlift|peso muerto/i.test(stripped)) detectedMuscle = "hamstrings";
  else if (/gemelo|calf|calves|talon/i.test(stripped)) detectedMuscle = "calves";
  else if (/abdomen|ab|abs|core|plancha|twist/i.test(stripped)) detectedMuscle = "abs";
  else if (/cardio|cinta|treadmill|bici|bike/i.test(stripped)) detectedMuscle = "cardio";

  return {
    englishQuery: stripped,
    detectedEquipment,
    detectedMuscle,
    cleanOriginal,
  };
}
