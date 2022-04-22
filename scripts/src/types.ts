export type EStat = {
	file: string;
	isFile: boolean;
	isDirectory: boolean;
	isSymbolicLink: boolean;
	size: number;
};

export interface WorkspacePackageDetail {
	cwd: string;
	out: string;
	tmp: string;
	cwdPath(file: string): string;
	outPath(file: string): string;
	tmpPath(file: string): string;
	name: string;
	version: string;
	nextVersion: string | null;
	latestVersion: string | null;
	release: Record<string, string>;
	dependencies: string[];
}

export type VersionPreReleaseType = "alpha" | "beta" | "rs";

export interface Version {
	version: string;
	major: number;
	minor: number;
	patch: number;
	preRelease?: {
		name: VersionPreReleaseType;
		version: number;
	};
}

export interface ConfigChannel {
	user: string;
	registry?: string;
}

export interface Config {
	semver: {
		version: string;
		preRelease?: VersionPreReleaseType;
	};
	workspace: {
		name: string;
		path: string;
	};
	bundle: {
		author: string;
		repository: {
			type: string;
			url: string;
		};
		license: string;
		licenseText: string;
		out: string;
		tmp: string;
	};
	release: Record<string, ConfigChannel>;
}

export interface BundleVersionJson {
	version: string;
	release?: Record<string, string>;
}

export type BundleTargetType = "commonjs" | "node" | "types" | "copy";

export interface BundleTarget {
	target: BundleTargetType;
	output: string;
	"package.json": any;
}

export interface BundleEntity {
	target: BundleTargetType;
	name: string;
	input: string;
	output: string;
}

export interface BundleJson {
	[key: string]: BundleTarget | BundleTarget[];
}
