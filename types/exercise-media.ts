export type MuscleGroup =
  | "chest"
  | "lats"
  | "upper_back"
  | "biceps"
  | "triceps"
  | "forearms"
  | "shoulders"
  | "quads"
  | "hamstrings"
  | "calves"
  | "abs"
  | "cardio";

export interface ExerciseMedia {
  id: string;
  name: string;
  aliases: string[];
  primaryMuscle: MuscleGroup;
  secondaryMuscles: MuscleGroup[];
  equipment: string;
  videoUrl?: string;   // MP4 / WebM continuo
  gifUrl?: string;     // Fallback animado
  cdnUrl?: string;     // URL remota directa CDN jsDelivr / GymVisual
  posterUrl?: string;  // Imagen estática (primer frame / thumbnail)
  difficulty?: "beginner" | "intermediate" | "advanced";
}

