import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // node-ical (and its rrule/moment deps) don't survive server bundling — keep
  // them external so they're required at runtime.
  serverExternalPackages: ["better-sqlite3", "node-ical"],
};

export default nextConfig;
