import { NextResponse } from "next/server";
import { checkXiaomiQr } from "@/lib/xiaomi-client";
import { getXiaomiAuthRecord, saveXiaomiAuthTokens } from "@/lib/xiaomi-db";

export async function GET(request: Request) {
  try {
    const auth = await getXiaomiAuthRecord();

    if (!auth.qrLpUrl) {
      return NextResponse.json(
        {
          success: false,
          confirmed: false,
          error: "NO_ACTIVE_QR",
          message: "No hay ninguna sesión de QR activa. Inicia una nueva.",
        },
        { status: 400 }
      );
    }

    const checkRes = await checkXiaomiQr(auth.qrLpUrl);

    if (checkRes.confirmed && checkRes.userId && checkRes.passToken) {
      await saveXiaomiAuthTokens(checkRes.userId, checkRes.passToken, auth.region, auth.scaleModel);
      return NextResponse.json({
        success: true,
        confirmed: true,
        is_authenticated: true,
        user_id: checkRes.userId,
        message: "Autenticación confirmada con éxito.",
      });
    }

    return NextResponse.json({
      success: true,
      confirmed: false,
      is_authenticated: false,
      message: "Esperando confirmación en la app de Xiaomi...",
    });
  } catch (error: any) {
    if (error?.digest === "NEXT_PRERENDER_INTERRUPTED") throw error;
    console.error("Error checking Xiaomi QR auth:", error);
    return NextResponse.json(
      {
        success: false,
        confirmed: false,
        error: error.message || "Error al comprobar aprobación de Xiaomi",
      },
      { status: 500 }
    );
  }
}
