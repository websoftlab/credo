import { debug, debugEnable, debugSetNamespacePrefix } from "@phragon/cli-debug";

debugSetNamespacePrefix("phragon:");
debugEnable(process.env.DEBUG || "phragon:*");

const debugInstall = debug.install;
const debugError = debug.error;
const debugWatch = debug.watch;
const debugBuild = debug.build;

export { debug, debugInstall, debugError, debugWatch, debugBuild };
