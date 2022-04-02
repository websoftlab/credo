export {default as build} from "./build";
export {default as compiler} from "./compiler";
export {default as watch} from "./watch";
export {installDependencies, installPackage, getPackageModuleVersion, getLatestModuleVersion, splitModule} from "./dependencies";

export type {
	CredoPlugin,
	CredoConfig,
	Watch,

	BuildConfigure,
	BuildOptions,
	BuildMode,
	BuildType,
	BuildConfigureOptions,

	BuilderType,

	ErrorContext,
	RollupConfigure,
	WebpackConfigure,
	EStat,
} from "./types";