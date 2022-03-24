import type {Version} from "./types";
import type {WorkspacePackageDetail} from "./types";
import type {Choice} from "prompts";
import prompts from "prompts";
import {format} from "./color";
import {writeJsonFile} from "./utils";

function isNum(value: number) {
	return !isNaN(value) && isFinite(value);
}

const verPr = {
	alpha: 1,
	beta: 2,
	rs: 3,
}

type VerType = "major" | "minor" | "patch" | "pre-release" | "pre-release-remove";
type VerPreReleaseType = "alpha" | "beta" | "rs";

function createIncrement(version: Version, type: VerType, name?: VerPreReleaseType) {
	let {
		major,
		minor,
		patch,
		preRelease,
	} = version;

	let preReleaseName: "alpha" | "beta" | "rs" | null = null;
	let preReleaseVersion: number = 0;
	if(preRelease) {
		preReleaseName = preRelease.name;
		preReleaseVersion = preRelease.version;
	}

	function build(): Version {
		const ver: Version = {
			version: [major, minor, patch].join("."),
			major,
			minor,
			patch,
		};
		if(preReleaseName) {
			ver.version += `-${preReleaseName}`;
			if(preReleaseVersion > 0) {
				ver.version += `.${preReleaseVersion}`;
			}
			ver.preRelease = {
				name: preReleaseName,
				version: preReleaseVersion,
			};
		}
		return ver;
	}

	if(type === "pre-release-remove") {
		if(preReleaseName) {
			preReleaseName = null;
			patch ++;
		}
		return build();
	}

	if(type === "pre-release") {
		if(name) {
			if(preReleaseName === name) {
				preReleaseVersion ++;
				return build();
			}
			if(preReleaseName && verPr[preReleaseName] > verPr[name]) {
				patch ++;
			}
			preReleaseName = name;
			preReleaseVersion = 0;
			return build();
		}
		if(preReleaseName) {
			preReleaseVersion ++;
			return build();
		}
		preReleaseName = "alpha";
		preReleaseVersion = 0;
		return build();
	}

	if(type === "patch") {
		patch ++;
	} else if(type === "minor") {
		minor ++;
		patch = 0;
	} else if(type === "major") {
		major ++;
		minor = 0;
		patch = 0;
	} else {
		return build();
	}

	if(preRelease) {
		preReleaseVersion = 0;
	}

	return build();
}

export function incrementVersion(ver: string | Version): Version {
	if(typeof ver === "string") {
		ver = split(ver);
	}

	if(ver.preRelease) {
		ver.preRelease.version ++;
	} else {
		ver.patch ++;
	}

	ver.version = [ver.major, ver.minor, ver.patch].join(".");
	if(ver.preRelease) {
		ver.version += `-${ver.preRelease.name}.${ver.preRelease.version}`;
	}

	return ver;
}

export async function increment(pg: WorkspacePackageDetail): Promise<Version> {

	const ver = split(pg.version);
	if(pg.nextVersion) {
		const question = await prompts({
			type: "confirm",
			name: "yes",
			message: format('{yellow %s} package already incremented to {cyan %s}, leave as is?', pg.name, pg.nextVersion),
			initial: true,
		});
		if(question.yes) {
			return ver;
		}
	}

	const choices: Choice[] = [];
	const lnk: Version[] = [];

	function addChoice(title: string, type: VerType, name?: VerPreReleaseType) {
		const value = createIncrement(ver, type, name);
		choices.push({
			title,
			value: lnk.length,
			description: value.version,
		});
		lnk.push(value);
	}

	if(ver.preRelease) {
		addChoice("pre-release", "pre-release");
		addChoice("remove pre-release and increment patch", "pre-release-remove");
		if(ver.preRelease.name !== "alpha") addChoice("change to -alpha.0 pre-release", "pre-release", "alpha");
		if(ver.preRelease.name !== "beta") addChoice("change to -beta.0 pre-release", "pre-release", "beta");
		if(ver.preRelease.name !== "rs") addChoice("change to -rs.0 pre-release", "pre-release", "rs");
	} else {
		addChoice("add -alpha.0 pre-release", "pre-release", "alpha");
		addChoice("add -beta.0 pre-release", "pre-release", "beta");
		addChoice("add -rs.0 pre-release", "pre-release", "rs");
	}

	addChoice("patch version", "patch");
	addChoice("minor version", "minor");
	addChoice("major version", "major");

	const question = await prompts({
		type: "select",
		name: "version",
		message: `Increment ${pg.name} version ${pg.version} to:`,
		choices,
		initial: choices[0].value,
	});

	if(question.version == null) {
		throw new Error("Version not selected...");
	}

	const newVer: Version = lnk[question.version];
	if(newVer.version === pg.nextVersion) {
		return ver;
	}

	await writeJsonFile(pg.cwdPath("bundle-version.json"), {
		version: pg.version,
		nextVersion: newVer.version,
		release: pg.release,
	});

	return newVer;
}

export function split(version: string): Version {
	const match = version.split(".");
	while(match.length > 3) {
		match[2] += "." + match.splice(3, 1)[0];
	}

	const ver: Version = {
		version,
		major: match[0] ? parseInt(match[0]) : 0,
		minor: match[1] ? parseInt(match[1]) : 0,
		patch: 0,
	};

	if(match[2]) {
		const m = match[2].match(/^(\d+)-(alpha|beta|rs)(?:\.(\d+))?$/);
		if(m) {
			ver.patch = parseInt(m[1]);
			ver.preRelease = {
				name: m[2] as "alpha",
				version: m[3] ? parseInt(m[3]) : 0,
			};
		} else {
			ver.patch = parseInt(match[2]);
		}
	}

	if(!isNum(ver.major)) throw new Error("Invalid major version -> " + version);
	if(!isNum(ver.minor)) throw new Error("Invalid minor version -> " + version);
	if(!isNum(ver.patch)) throw new Error("Invalid patch version -> " + version);
	if(ver.preRelease && !isNum(ver.preRelease.version)) throw new Error("Invalid pre-release version -> " + version);

	return ver;
}
