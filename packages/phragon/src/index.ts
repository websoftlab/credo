export { default as build } from "./build";
export { default as compiler } from "./compiler";
export { default as watch } from "./watch";
export {
	installDependencies,
	installPackage,
	getPackageModuleVersion,
	getLatestModuleVersion,
	splitModule,
} from "./dependencies";

export type {
	InstallPhragonJSOptions,
	PhragonPlugin,
	PhragonConfig,
	Watch,
	BuildConfigure,
	BuildOptions,
	BuildMode,
	BuildType,
	BuildConfigureOptions,
	BuilderType,
	BuildExtenderResult,
	ErrorContext,
	RollupConfigure,
	WebpackConfigure,
	EStat,
	DaemonSignKill,
} from "./types";

export type { BuilderI, WebpackBuilderI, RollupBuilderI, PhragonBuilderI } from "./builder";
export type { BuildRule as WebpackBuildRule, BuildLoaderRule as WebpackBuildLoaderRule } from "./webpack/types";
