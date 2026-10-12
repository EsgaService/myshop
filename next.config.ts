import type { NextConfig } from "next";
import { legacyRedirects } from "./src/lib/routing/legacy-redirects";

const nextConfig: NextConfig = {
  async redirects() {
    return legacyRedirects();
  },
};

export default nextConfig;
