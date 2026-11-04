import { NextResponse } from "next/server";
import { launchHevyLogin, connectWithToken } from "@/lib/hevy-client";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));

    // Si el usuario proporcionó un token o Developer API Key directamente
    if (body.token && typeof body.token === "string" && body.token.trim()) {
      const result = await connectWithToken(body.token);

      if (!result.success) {
        return NextResponse.json(
          {
            success: false,
            error: result.error || "Token o API Key inválido para Hevy",
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

    // De lo contrario, intentar inicio de sesión por navegador (entorno local)
    const result = await launchHevyLogin();

    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          error: result.error || "No se pudo completar el inicio de sesión en Hevy",
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
  } catch (error: any) {
    if (error?.digest === "NEXT_PRERENDER_INTERRUPTED") throw error;
    console.error("Error in Hevy auth start:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || "Error al iniciar sesión con Hevy",
      },
      { status: 500 }
    );
  }
}

