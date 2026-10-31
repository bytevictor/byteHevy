import { NextResponse } from "next/server";
import { searchCatalog, getCatalogCategories } from "@/lib/exercise-catalog";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const q = searchParams.get("q") || "";
    const category = searchParams.get("category") || "all";
    const limit = Math.min(Math.max(Number(searchParams.get("limit") || 48), 1), 100);

    const { items, total } = searchCatalog(q, category, limit);
    const categories = getCatalogCategories();

    return NextResponse.json({
      success: true,
      total,
      categories,
      results: items,
    });
  } catch (error: any) {
    if (error?.digest?.startsWith?.("NEXT_") || error?.digest === "NEXT_PRERENDER_INTERRUPTED") {
      throw error;
    }
    console.error("[SearchAPI] Error searching catalog:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Error al buscar ejercicios" },
      { status: 500 }
    );
  }
}
