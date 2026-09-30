import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Splitrip - trip expense splitter",
    short_name: "Splitrip",
    description: "Split trip expenses with your group and settle up.",
    start_url: "/trips",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#f7fafa",
    theme_color: "#0f766e",
    icons: [
      { src: "/pwa-icon/192", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/pwa-icon/512", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/pwa-icon/512", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
