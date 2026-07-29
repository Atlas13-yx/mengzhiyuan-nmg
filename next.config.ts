import type { NextConfig } from "next";

const repositoryName = process.env.GITHUB_REPOSITORY?.split("/")[1] ?? "";
const isGitHubPagesBuild =
  process.env.GITHUB_ACTIONS === "true" && repositoryName.length > 0;

const nextConfig: NextConfig = isGitHubPagesBuild
  ? {
      output: "export",
      trailingSlash: true,
      images: {
        unoptimized: true,
      },
      // Cloudflare-only worker modules are type-checked by the regular vinext
      // build. They are intentionally excluded from blocking the static Pages
      // export, which only ships the public app directory.
      typescript: {
        ignoreBuildErrors: true,
      },
      basePath: `/${repositoryName}`,
      assetPrefix: `/${repositoryName}`,
    }
  : {};

export default nextConfig;
