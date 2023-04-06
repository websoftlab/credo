import { isPlainObject } from "@phragon-util/plain-object";
import deepmerge from "deepmerge";
import cwdPath from "./cwdPath";
import exists from "./exists";
import { basename } from "path";
import readJsonFile from "./readJsonFile";
import writeJsonFile from "./writeJsonFile";
import { debug } from "../debug";

export interface PackageJsonBugsDType {
	url: string;
	email: string;
}

export interface PackageJsonTypeURLDType {
	type: string;
	url: string;
	directory?: string;
}

export interface PackageJsonAuthorDType {
	name: string;
	email: string;
	url: string;
}

export interface PackageJsonStringObjectDType {
	[key: string]: string;
}

export type PackageJsonStringObjectKeysDType =
	| "bin"
	| "scripts"
	| "dependencies"
	| "devDependencies"
	| "peerDependencies";

export interface PackageJsonDType {
	name: string;
	version: string;
	private?: boolean;
	description?: string;
	keywords?: string[];
	workspaces?: string[];
	files?: string[];
	directories?: string[];
	homepage?: string;
	bugs?: PackageJsonBugsDType;
	license?: string | PackageJsonTypeURLDType | PackageJsonTypeURLDType[];
	funding?: string | PackageJsonTypeURLDType | (string | PackageJsonTypeURLDType)[];
	author?: string | PackageJsonAuthorDType;
	contributors?: PackageJsonAuthorDType[];
	bin?: string | PackageJsonStringObjectDType;
	man?: string | string[];
	repository?: string | PackageJsonTypeURLDType;
	dependencies?: PackageJsonStringObjectDType;
	devDependencies?: PackageJsonStringObjectDType;
	peerDependencies?: PackageJsonStringObjectDType;
	engines?: PackageJsonStringObjectDType;
	scripts?: PackageJsonStringObjectDType;
	os?: string[];
	cpu?: string[];
	[key: string]: any;
}

function createName() {
	// try create
	let name = basename(process.cwd())
		.replace(/[^a-z\d\-_]+/g, "")
		.replace(/^[\-_\d]+/g, "")
		.replace(/[\-_]+$/g, "");

	if (!name) {
		name = "phragon-project";
	}

	return name;
}

const defaultVersion = "1.0.0";
const packageJsonFile = cwdPath("./package.json");

async function load(): Promise<PackageJsonDType> {
	let create = false;
	let data: PackageJsonDType;
	let rewrite = !(await exists(packageJsonFile));

	if (rewrite) {
		create = true;
		data = {
			name: "",
			version: defaultVersion,
			private: true,
			description: "The PhragonJS project",
			engines: {
				nodejs: ">=14.0.0",
			},
			keywords: ["phragon-js", "phragon"],
		};
	} else {
		data = await readJsonFile(packageJsonFile);
		if (!data.version) {
			rewrite = true;
			data.version = defaultVersion;
		}
	}

	if (!data.name) {
		rewrite = true;
		data.name = createName();
		debug(`Set package name {yellow %s}`, data.name);
	}

	if (rewrite) {
		await write(data);
		debug(`${create ? "Create" : "Update"} {yellow %s}`, "./package.json");
	}

	return data;
}

async function write(data: PackageJsonDType): Promise<void> {
	return writeJsonFile(packageJsonFile, data);
}

async function setIn(type: PackageJsonStringObjectKeysDType, name: string, value: string | null) {
	const data = await load();
	if (!data.hasOwnProperty(type)) {
		data[type] = {};
	}
	let object = data[type];
	if (typeof object === "string") {
		const packageName = data.name || "";
		object = {
			[packageName]: object,
		};
	} else if (object == null) {
		object = {};
	}
	if (value == null) {
		if (object.hasOwnProperty(name)) {
			delete object[name];
		} else {
			return;
		}
	} else if (object[name] === value) {
		return;
	} else {
		object[name] = value;
	}
	await write(data);
}

async function getIn(type: PackageJsonStringObjectKeysDType, name: string) {
	const data = await load();
	let object = data[type];
	if (object == null) {
		return null;
	}
	if (typeof object === "string") {
		const packageName = data.name || "";
		return name === packageName ? object : null;
	}
	return object.hasOwnProperty(name) && typeof object[name] === "string" ? object[name] : null;
}

async function hasIn(type: PackageJsonStringObjectKeysDType, name: string) {
	const data = await load();
	let object = data[type];
	if (object == null) {
		return false;
	}
	if (typeof object === "string") {
		const packageName = data.name || "";
		return name === packageName;
	}
	return object.hasOwnProperty(name) && typeof object[name] === "string";
}

async function getValue<T>(type: keyof PackageJsonStringObjectDType): Promise<T | null> {
	const data = await load();
	if (data.hasOwnProperty(type)) {
		return data[type];
	}
	return null;
}

async function setValue(type: keyof PackageJsonStringObjectDType, value: any): Promise<void> {
	const data = await load();
	const exists = data.hasOwnProperty(type);
	if (value == null) {
		if (exists) {
			delete data[type];
		} else {
			return;
		}
	} else if (isPlainObject(value)) {
		data[type] = exists ? deepmerge(data[type], value) : value;
	} else if (data[type] !== value) {
		data[type] = value;
	} else {
		return;
	}
	return write(data);
}

export default class PackageJsonUtil {
	async load(): Promise<PackageJsonDType> {
		return load();
	}

	async setIn(type: PackageJsonStringObjectKeysDType, key: string, value: string): Promise<void> {
		return setIn(type, key, value);
	}

	async removeIn(type: PackageJsonStringObjectKeysDType, key: string): Promise<void> {
		return setIn(type, key, null);
	}

	async getIn(type: PackageJsonStringObjectKeysDType, key: string): Promise<string | null> {
		return getIn(type, key);
	}

	async hasIn(type: PackageJsonStringObjectKeysDType, key: string): Promise<boolean> {
		return hasIn(type, key);
	}

	async name(): Promise<string> {
		return (await getValue("name")) as string;
	}

	async version(): Promise<string> {
		return (await getValue("version")) as string;
	}

	async set<K extends keyof PackageJsonStringObjectDType>(
		name: K,
		value: PackageJsonStringObjectDType[K]
	): Promise<void> {
		return setValue(name, value);
	}

	async get<K extends keyof PackageJsonStringObjectDType>(name: K): Promise<PackageJsonStringObjectDType[K] | null> {
		return getValue<PackageJsonStringObjectDType[K]>(name);
	}

	async remove(name: keyof PackageJsonDType): Promise<void> {
		return setValue(name, null);
	}
}
