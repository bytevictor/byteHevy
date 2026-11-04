import { NextResponse } from "next/server";
import { verifyAndSaveHevyToken } from "@/lib/hevy-client";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));

    if (body.token && typeof body.token === "string" && body.token.trim()) {
      const result = await verifyAndSaveHevyToken({
        accessToken: body.token.trim(),
      });

      if (!result.success) {
        return NextResponse.json(
          {
            success: false,
            error: result.error || "Token inválido para Hevy",
          },
          { status: 400 }
        );
      }

      return NextResponse.json({
        success: true,
        user_id: result.userId,
        username: result.username,
        message: "¡Conectado exitosamente con Hevy!",
      });
    }

    return NextResponse.json({
      success: true,
      message: "Utiliza el flujo de ventana emergente y marcador para conectar tu cuenta.",
    });
  } catch (error: any) {
    if (error?.digest === "NEXT_PRERENDER_INTERRUPTED") throw error;
    console.error("Error in Hevy auth start:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || "Error al iniciar proceso de conexión",
      },
      { status: 500 }
    );
  }
}
