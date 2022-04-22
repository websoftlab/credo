import { debug, debugEnable, debugSetNamespacePrefix } from "@credo-js/cli-debug";

debugSetNamespacePrefix("credo:");
debugEnable(process.env.DEBUG || "credo:*");

const debugInstall = debug.install;
const debugError = debug.error;
const debugWatch = debug.watch;
const debugBuild = debug.build;

export { debug, debugInstall, debugError, debugWatch, debugBuild };
