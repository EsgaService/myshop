import type { NextConfig } from "next";
import { legacyRedirects } from "./src/lib/routing/legacy-redirects";

const nextConfig: NextConfig = {
  // pdf.js loads its fake worker and wasm decoders from disk, sharp is native: neither can be bundled.
  serverExternalPackages: ["pdfjs-dist", "sharp"],
  outputFileTracingIncludes: { "/*": ["./node_modules/pdfjs-dist/wasm/**"] },
  async redirects() {
    return legacyRedirects();
  },
};

export default nextConfig;
