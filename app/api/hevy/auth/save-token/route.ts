import { NextResponse } from "next/server";
import { verifyAndSaveHevyToken } from "@/lib/hevy-client";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const { accessToken, refreshToken, userId, username, email } = body;

    if (!accessToken || typeof accessToken !== "string" || !accessToken.trim()) {
      return NextResponse.json(
        { success: false, error: "Token de acceso no proporcionado." },
        { status: 400 }
      );
    }

    const result = await verifyAndSaveHevyToken({
      accessToken: accessToken.trim(),
      refreshToken,
      userId,
      username,
      email,
    });

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error || "Token inválido para Hevy." },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      user_id: result.userId,
      username: result.username,
      message: "¡Conectado exitosamente con Hevy!",
    });
  } catch (error: any) {
    if (error?.digest === "NEXT_PRERENDER_INTERRUPTED") throw error;
    console.error("Error in save-token route:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Error al guardar el token de Hevy." },
      { status: 500 }
    );
  }
}

