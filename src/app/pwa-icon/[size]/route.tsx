import { ImageResponse } from "next/og";

const ALLOWED = new Set([180, 192, 512]);

export async function GET(_req: Request, ctx: RouteContext<"/pwa-icon/[size]">) {
  const { size: raw } = await ctx.params;
  const size = Number(raw);
  if (!ALLOWED.has(size)) return new Response("Not found", { status: 404 });

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#0f766e",
          color: "white",
          fontSize: size * 0.56,
          fontWeight: 700,
          letterSpacing: -size * 0.02,
        }}
      >
        ₹
      </div>
    ),
    { width: size, height: size },
  );
}
