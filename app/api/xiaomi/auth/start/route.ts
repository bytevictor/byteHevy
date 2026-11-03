import { NextResponse } from "next/server";
import { startXiaomiQr } from "@/lib/xiaomi-client";
import { saveXiaomiQrSession } from "@/lib/xiaomi-db";

export async function POST(request: Request) {
  try {
    const qrInfo = await startXiaomiQr();
    await saveXiaomiQrSession(qrInfo.loginUrl, qrInfo.qrImageUrl, qrInfo.lpUrl);

    return NextResponse.json({
      success: true,
      login_url: qrInfo.loginUrl,
      qr_image_url: qrInfo.qrImageUrl,
    });
  } catch (error: any) {
    if (error?.digest === "NEXT_PRERENDER_INTERRUPTED") throw error;
    console.error("Error starting Xiaomi QR login:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || "Error al iniciar sesión con código QR de Xiaomi",
      },
      { status: 500 }
    );
  }
}
