import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Pin the workspace root to this checkout's monorepo root. Without it Next
  // infers the root from whichever lockfiles it can see, and a git worktree
  // lives *inside* the main checkout (.claude/worktrees/…), so it finds the
  // main repo's lockfile and picks that tree instead of this one.
  outputFileTracingRoot: path.join(__dirname, "../../"),
};

export default nextConfig;
