import { NextResponse } from "next/server";
import { verifyAndSaveHevyToken } from "@/lib/hevy-client";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const rawInput = body.rawTokenInput || body.accessToken || body.cookie || "";
    const { refreshToken, expiresAt, userId, username, email } = body;

    if (!rawInput || typeof rawInput !== "string" || !rawInput.trim()) {
      return NextResponse.json(
        { success: false, error: "Token de acceso o cookie no proporcionado." },
        { status: 400 }
      );
    }

    const result = await verifyAndSaveHevyToken({
      rawTokenInput: rawInput.trim(),
      refreshToken,
      expiresAt,
      userId,
      username,
      email,
    });

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error || "Token o sesión inválida para Hevy." },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      user_id: result.userId,
      username: result.username,
      has_refresh_token: result.hasRefreshToken,
      message: result.hasRefreshToken
        ? "¡Conectado permanentemente con Hevy! (Auto-renovación activa)"
        : "¡Conectado exitosamente con Hevy!",
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

