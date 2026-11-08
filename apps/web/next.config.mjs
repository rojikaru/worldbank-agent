/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: "10mb",
    },
  },
  // PGlite ships modern syntax + wasm assets that Next needs to transpile/bundle
  transpilePackages: ["@electric-sql/pglite"],
  webpack: (config, { isServer, webpack }) => {
    if (!isServer) {
      // PGlite's Node-only branch imports node:module, node:fs…; in the browser
      // that branch never runs, so strip the scheme and resolve them to empty modules
      config.plugins.push(
        new webpack.NormalModuleReplacementPlugin(/^node:/, (resource) => {
          resource.request = resource.request.replace(/^node:/, "");
        }),
      );
      config.resolve.fallback = {
        ...config.resolve.fallback,
        module: false,
        fs: false,
        "fs/promises": false,
        path: false,
        url: false,
        crypto: false,
        child_process: false,
        worker_threads: false,
      };
    }
    return config;
  },
};

export default nextConfig;
