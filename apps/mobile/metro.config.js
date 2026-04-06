const path = require("path");
const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");

const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, "../..");

const config = getDefaultConfig(projectRoot);

// pnpm hoists packages to the monorepo root — tell Metro where to find them
config.watchFolders = [monorepoRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(monorepoRoot, "node_modules"),
];

// Packages that must be singletons (two copies = broken hooks / invalid hook call).
// In a pnpm monorepo Metro can resolve these from the monorepo root AND from the app,
// producing two instances. extraNodeModules overrides resolution to always use the
// app's copy regardless of which package is doing the import.
config.resolver.extraNodeModules = {
  react: path.resolve(projectRoot, "node_modules/react"),
  "react-native": path.resolve(projectRoot, "node_modules/react-native"),
  "react-dom": path.resolve(projectRoot, "node_modules/react-dom"),
};
// Workspace packages use the "react-native" field to point at TypeScript source.
// Their internal imports use the ESM ".js" extension convention (e.g. "./env.js")
// but the actual files are ".ts". Intercept resolution to rewrite .js → .ts when
// the .js file doesn't exist inside packages/.
const fs = require("fs");
const workspacePkgs = path.resolve(monorepoRoot, "packages");
const originalResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (
    context.originModulePath.startsWith(workspacePkgs) &&
    moduleName.startsWith("./") &&
    moduleName.endsWith(".js")
  ) {
    const tsName = moduleName.replace(/\.js$/, ".ts");
    const tsPath = path.resolve(path.dirname(context.originModulePath), tsName);
    if (fs.existsSync(tsPath)) {
      return context.resolveRequest(context, tsName, platform);
    }
  }
  if (originalResolveRequest) {
    return originalResolveRequest(context, moduleName, platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};

config.transformer.babelTransformerPath = require.resolve(
  "react-native-svg-transformer/expo"
);
config.resolver.assetExts = config.resolver.assetExts.filter(
  (ext) => ext !== "svg"
);
config.resolver.sourceExts = [...config.resolver.sourceExts, "svg"];

module.exports = withNativeWind(config, { input: "./global.css" });
