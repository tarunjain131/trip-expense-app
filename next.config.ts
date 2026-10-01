import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // E2E builds into its own folder so they never clobber a running `next dev`.
  distDir: process.env.NEXT_DIST_DIR ?? ".next",
};

export default nextConfig;
