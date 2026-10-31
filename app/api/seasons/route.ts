import { NextResponse } from "next/server";
import {
  getSeasons,
  getSeasonById,
  createSeason,
  updateSeason,
  deleteSeason,
} from "@/lib/actions";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (id) {
      const season = await getSeasonById(id);
      if (!season) {
        return NextResponse.json(
          { success: false, error: "Temporada no encontrada" },
          { status: 404 }
        );
      }
      return NextResponse.json({ success: true, data: season });
    }

    const seasons = await getSeasons();
    return NextResponse.json(
      { success: true, data: seasons },
      { headers: { "Cache-Control": "no-store, max-age=0" } }
    );
  } catch (error: any) {
    if (error?.digest === "NEXT_PRERENDER_INTERRUPTED") throw error;
    console.error("Failed to fetch seasons:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    if (!body.name || !body.startDate) {
      return NextResponse.json(
        { success: false, error: "El nombre y la fecha de inicio son obligatorios" },
        { status: 400 }
      );
    }

    const newSeason = await createSeason({
      name: body.name,
      startDate: body.startDate,
      endDate: body.endDate || null,
      description: body.description || "",
    });

    return NextResponse.json({ success: true, data: newSeason });
  } catch (error: any) {
    console.error("Failed to create season:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json();
    if (!body.id || !body.name || !body.startDate) {
      return NextResponse.json(
        { success: false, error: "ID, nombre y fecha de inicio son requeridos" },
        { status: 400 }
      );
    }

    const updated = await updateSeason(body.id, {
      name: body.name,
      startDate: body.startDate,
      endDate: body.endDate || null,
      description: body.description || "",
    });

    if (!updated) {
      return NextResponse.json(
        { success: false, error: "Temporada no encontrada" },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, data: updated });
  } catch (error: any) {
    console.error("Failed to update season:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    let id = searchParams.get("id");

    if (!id) {
      try {
        const body = await request.json();
        id = body?.id;
      } catch (e) {
        // no body
      }
    }

    if (!id) {
      return NextResponse.json(
        { success: false, error: "Falta el ID de la temporada" },
        { status: 400 }
      );
    }

    await deleteSeason(id);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Failed to delete season:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
