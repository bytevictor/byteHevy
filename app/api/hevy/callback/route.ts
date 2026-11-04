import { NextResponse } from "next/server";
import { verifyAndSaveHevyToken } from "@/lib/hevy-client";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get("token");
    const userId = searchParams.get("user_id");
    const username = searchParams.get("username");
    const refreshToken = searchParams.get("refresh_token");

    if (!token || !token.trim()) {
      return new NextResponse(
        renderHtmlPage(false, "No se recibió ningún token de Hevy."),
        { headers: { "Content-Type": "text/html; charset=utf-8" }, status: 400 }
      );
    }

    const result = await verifyAndSaveHevyToken({
      accessToken: token.trim(),
      userId: userId || undefined,
      username: username || undefined,
      refreshToken: refreshToken || undefined,
    });

    if (!result.success) {
      return new NextResponse(
        renderHtmlPage(
          false,
          result.error || "El token de Hevy no es válido o ha expirado."
        ),
        { headers: { "Content-Type": "text/html; charset=utf-8" }, status: 400 }
      );
    }

    return new NextResponse(
      renderHtmlPage(
        true,
        `¡Cuenta vinculada con éxito${result.username ? ` (@${result.username})` : ""}! Esta ventana se cerrará automáticamente.`,
        token.trim()
      ),
      { headers: { "Content-Type": "text/html; charset=utf-8" }, status: 200 }
    );
  } catch (err: any) {
    return new NextResponse(
      renderHtmlPage(false, `Error en el servidor: ${err.message}`),
      { headers: { "Content-Type": "text/html; charset=utf-8" }, status: 500 }
    );
  }
}

function renderHtmlPage(success: boolean, message: string, token = ""): string {
  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>ByteHevy - Autenticación Hevy</title>
  <style>
    body {
      background-color: #09090b;
      color: #f4f4f5;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      margin: 0;
      padding: 20px;
      box-sizing: border-box;
    }
    .card {
      background: #18181b;
      border: 1px solid #27272a;
      border-radius: 24px;
      padding: 36px 32px;
      max-width: 440px;
      width: 100%;
      text-align: center;
      box-shadow: 0 25px 50px -12px rgba(0,0,0,0.7);
    }
    .icon {
      font-size: 48px;
      margin-bottom: 16px;
    }
    h2 {
      margin: 0 0 10px 0;
      font-size: 22px;
      font-weight: 700;
      color: ${success ? "#34d399" : "#fb7185"};
    }
    p {
      color: #a1a1aa;
      font-size: 14px;
      line-height: 1.5;
      margin: 0 0 24px 0;
    }
    .btn {
      display: inline-block;
      background: #2563eb;
      color: white;
      text-decoration: none;
      padding: 12px 24px;
      border-radius: 12px;
      font-weight: 600;
      font-size: 14px;
      transition: background 0.2s;
    }
    .btn:hover { background: #1d4ed8; }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">${success ? "✅" : "⚠️"}</div>
    <h2>${success ? "¡Conexión Exitosa!" : "Error de Conexión"}</h2>
    <p>${message}</p>
    ${
      success
        ? `<p style="font-size:12px;color:#71717a;">Cerrando esta pestaña...</p>`
        : `<a href="/" class="btn">Volver a ByteHevy</a>`
    }
  </div>
  <script>
    ${
      success
        ? `
      try {
        localStorage.setItem("bytehevy_sync_update", Date.now().toString());
        if (window.opener) {
          window.opener.postMessage({ type: "BYTEHEVY_AUTH_SUCCESS", token: "${token}" }, "*");
        }
      } catch (e) {}
      setTimeout(() => {
        window.close();
      }, 1500);
    `
        : ""
    }
  </script>
</body>
</html>`;
}
