import type { NextConfig } from "next";

const repositoryName = process.env.GITHUB_REPOSITORY?.split("/")[1] ?? "";
const isGitHubPagesBuild =
  process.env.GITHUB_ACTIONS === "true" && repositoryName.length > 0;
const publicBasePath = isGitHubPagesBuild ? `/${repositoryName}` : "";

const nextConfig: NextConfig = isGitHubPagesBuild
  ? {
      env: {
        NEXT_PUBLIC_BASE_PATH: publicBasePath,
      },
      output: "export",
      trailingSlash: true,
      images: {
        unoptimized: true,
      },
      // Pages ships the public app, not the optional Cloudflare worker/database.
      // App types must pass; worker types belong to that deployment target.
      typescript: {
        tsconfigPath: "tsconfig.app.json",
      },
      basePath: publicBasePath,
      assetPrefix: publicBasePath,
    }
  : {
      env: {
        NEXT_PUBLIC_BASE_PATH: "",
      },
    };

export default nextConfig;
