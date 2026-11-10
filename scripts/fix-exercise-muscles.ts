import { getDb, ensureSchema } from "@/lib/db";
import { getExerciseMedia } from "@/lib/exercise-media";
import { translateExerciseNameToEnglish } from "@/lib/exercise-translator";

async function main() {
  console.log("Iniciando auditoría y corrección de exercisedb_cache...");
  const db = getDb();
  await ensureSchema(db);

  const rows = await db.execute("SELECT exercise_name, data_json FROM exercisedb_cache");
  let fixed = 0;

  for (const r of rows.rows) {
    const name = String(r.exercise_name);
    let data: any;
    try {
      data = JSON.parse(String(r.data_json));
    } catch {
      continue;
    }

    const trans = translateExerciseNameToEnglish(name);
    const fallback = getExerciseMedia(name);
    const correctMuscle = trans.detectedMuscle || fallback.primaryMuscle || "chest";

    const isFalselyChest =
      data.primaryMuscle === "chest" &&
      correctMuscle !== "chest" &&
      !name.toLowerCase().includes("chest") &&
      !name.toLowerCase().includes("pecho");

    const isMissingMuscle = !data.primaryMuscle;

    if (isFalselyChest || isMissingMuscle) {
      console.log(`Corrigiendo "${name}": ${data.primaryMuscle || "sin músculo"} -> ${correctMuscle}`);
      data.primaryMuscle = correctMuscle;
      if (!data.equipment) {
        data.equipment = fallback.equipment || "Gimnasio";
      }
      if (!data.secondaryMuscles) {
        data.secondaryMuscles = [];
      }

      await db.execute({
        sql: "UPDATE exercisedb_cache SET data_json = ? WHERE exercise_name = ?",
        args: [JSON.stringify(data), name],
      });
      fixed++;
    }
  }

  console.log(`\n¡Auditoría completada! Total de ejercicios corregidos: ${fixed}`);
}

main().catch((err) => {
  console.error("Error al ejecutar corrección:", err);
  process.exit(1);
});
