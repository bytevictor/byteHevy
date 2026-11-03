import { NextResponse } from "next/server";
import {
  getWeightRecords,
  createWeightRecord,
  updateWeightRecord,
  deleteWeightRecord,
  clearWeightRecords,
  bulkInsertWeightRecords,
} from "@/lib/actions";
import { parseWeightCsv } from "@/lib/mock-weight-data";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const records = await getWeightRecords();
    return NextResponse.json(
      { success: true, data: records, count: records.length },
      { headers: { "Cache-Control": "no-store, no-cache, must-revalidate" } }
    );
  } catch (error: any) {
    if (error?.digest === "NEXT_PRERENDER_INTERRUPTED") throw error;
    console.error("Failed to fetch weight records:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Error al obtener pesajes" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const contentType = request.headers.get("content-type") || "";

    // Manejo de subida de archivo CSV por multipart/form-data
    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData();
      const file = formData.get("file") as File | null;
      if (!file) {
        return NextResponse.json(
          { success: false, error: "No se proporcionó ningún archivo CSV" },
          { status: 400 }
        );
      }

      const text = await file.text();
      const parseResult = parseWeightCsv(text);
      if (!parseResult.success || parseResult.records.length === 0) {
        return NextResponse.json(
          {
            success: false,
            error: "No se pudieron procesar filas válidas del CSV",
            details: parseResult.errors,
          },
          { status: 400 }
        );
      }

      const inserted = await bulkInsertWeightRecords(parseResult.records);
      return NextResponse.json({
        success: true,
        message: `Se importaron ${inserted} pesajes correctamente`,
        count: inserted,
      });
    }

    // Manejo de payload JSON
    const body = await request.json();

    if (body.action === "clear") {
      await clearWeightRecords();
      return NextResponse.json({
        success: true,
        message: "Todos los registros de peso han sido eliminados de la base de datos.",
      });
    }

    if (body.action === "bulk" && Array.isArray(body.records)) {
      const inserted = await bulkInsertWeightRecords(body.records);
      return NextResponse.json({
        success: true,
        message: `Se insertaron ${inserted} pesajes`,
        count: inserted,
      });
    }

    if (body.action === "parseCsv" && typeof body.csvText === "string") {
      const parseResult = parseWeightCsv(body.csvText);
      if (!parseResult.success) {
        return NextResponse.json(
          { success: false, error: "Error al parsear CSV", details: parseResult.errors },
          { status: 400 }
        );
      }
      return NextResponse.json({ success: true, records: parseResult.records });
    }

    // Registro individual (compatible con Home Assistant, ESPHome, curl y llamadas manuales)
    const rawPeso = body.peso ?? body.weight ?? body.weight_kg;
    const peso = typeof rawPeso === "string" ? parseFloat(rawPeso.replace(",", ".")) : Number(rawPeso);

    if (isNaN(peso) || peso <= 0) {
      return NextResponse.json(
        { success: false, error: "El peso es obligatorio y debe ser un número positivo (claves aceptadas: peso, weight, weight_kg)." },
        { status: 400 }
      );
    }

    const rawImp = body.impedancia ?? body.impedance ?? body.bia;
    const impedancia = rawImp !== undefined && rawImp !== null && rawImp !== ""
      ? (typeof rawImp === "string" ? parseFloat(rawImp.replace(",", ".")) : Number(rawImp))
      : null;

    const rawImpLow = body.impedanciaLow ?? body.impedance_low ?? body.impedanceLow ?? body.low_impedance;
    const impedanciaLow = rawImpLow !== undefined && rawImpLow !== null && rawImpLow !== ""
      ? (typeof rawImpLow === "string" ? parseFloat(rawImpLow.replace(",", ".")) : Number(rawImpLow))
      : null;

    const rawAltura = body.altura ?? body.height ?? body.height_cm;
    const altura = rawAltura !== undefined && rawAltura !== null && rawAltura !== ""
      ? (typeof rawAltura === "string" ? parseFloat(rawAltura.replace(",", ".")) : Number(rawAltura))
      : 180;

    const fecha = body.fecha || body.date;
    const hora = body.hora || body.time;
    const source = body.source || ((impedancia || impedanciaLow) ? "home_assistant" : "manual");

    const newRecord = await createWeightRecord({
      ...body,
      peso,
      impedancia,
      impedanciaLow,
      altura,
      fecha,
      hora,
      source,
    });
    return NextResponse.json({ success: true, data: newRecord });
  } catch (error: any) {
    console.error("Failed to process weight POST request:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Error al procesar solicitud de peso" },
      { status: 500 }
    );
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json();
    if (!body.id) {
      return NextResponse.json(
        { success: false, error: "El ID del pesaje es obligatorio para actualizar." },
        { status: 400 }
      );
    }

    await updateWeightRecord(body.id, body);
    return NextResponse.json({
      success: true,
      message: "Registro de peso actualizado con éxito.",
    });
  } catch (error: any) {
    console.error("Failed to update weight record:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Error al actualizar registro de peso" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { success: false, error: "Se requiere el ID del pesaje para eliminar." },
        { status: 400 }
      );
    }

    await deleteWeightRecord(id);
    return NextResponse.json({
      success: true,
      message: "Registro de peso eliminado de la base de datos.",
    });
  } catch (error: any) {
    console.error("Failed to delete weight record:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Error al eliminar registro de peso" },
      { status: 500 }
    );
  }
}
