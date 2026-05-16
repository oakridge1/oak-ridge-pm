import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Prevent Turbopack from bundling these packages — they rely on Node.js-specific
  // features (Buffer, native addons, dynamic requires) and must be required at
  // runtime from node_modules rather than inlined into the server bundle.
  serverExternalPackages: ["docx", "sharp"],
};

export default nextConfig;
