import type { Lexicon } from "./types";

let defaultLanguageId = "en";
const lexicons: Record<string, () => Promise<Lexicon.Data>> = {};
const lexiconPackages: Record<string, Record<string, () => Promise<{ default: any }>>> = {};
const lexiconData: Record<string, Lexicon.Data> = {};
const listeners: Lexicon.Listener[] = [];

export function setDefaultLanguageId(id: string) {
	defaultLanguageId = id;
	if (__DEV__ && Object.keys(lexiconData).length > 0) {
		console.error("Warning! Assigned default language id after initialized");
	}
}

export function register(
	id: string,
	loader: () => Promise<Lexicon.Data>,
	packages: Record<string, () => Promise<{ default: any }>> = {}
) {
	lexicons[id] = loader;
	lexiconPackages[id] = packages;
}

export function loaded(id: string, packageName?: string): boolean {
	if (!lexiconData.hasOwnProperty(id)) {
		return false;
	}
	if (packageName) {
		return lexiconData[id].packages.includes(packageName);
	}
	return true;
}

export function subscribe(listener: Lexicon.Listener): () => void {
	if (typeof listener === "function" && !listeners.includes(listener)) {
		listeners.push(listener);
	}
	return () => {
		const index = listeners.indexOf(listener);
		if (index !== -1) {
			listeners.splice(index, 1);
		}
	};
}

async function trigger(data: Lexicon.Data, packageName: string | null = null): Promise<Lexicon.Data> {
	if (!listeners.length) {
		return data;
	}
	const copy = listeners.slice();
	const event = Object.assign({}, data, { packageName });
	for (let i = 0; i < copy.length; i++) {
		const listener = copy[i];
		try {
			await listener(event);
		} catch (err) {
			if (__DEV__) {
				console.error("Lexicon listener failure", err);
			}
		}
	}
	return data;
}

export async function load(id: string, packageName?: string | null): Promise<Lexicon.Data> {
	if (typeof packageName !== "string" || packageName.length < 1) {
		packageName = null;
	}

	if (!lexicons[id]) {
		id = defaultLanguageId;
		if (!lexicons[id]) {
			return trigger({
				id,
				lambda: {},
				lexicon: {},
				packages: [],
			});
		}
	}

	let data = lexiconData[id];
	if (data && (!packageName || data.packages.includes(packageName))) {
		return data;
	}

	if (!data) {
		data = await lexicons[id]();
		data.packages = [];
		data = await trigger(data, null);
	}

	if (packageName && !data.packages.includes(packageName)) {
		const pg = lexiconPackages[id];
		if (pg.hasOwnProperty(packageName)) {
			const add = await pg[packageName]();
			Object.assign(data.lexicon, (add && add.default) || {});
		}
		data.packages.push(packageName);
		data = await trigger(data, packageName);
	}

	lexiconData[id] = data;
	return data;
}

export async function reload(id: string): Promise<Lexicon.Data> {
	let packages: string[] = [];
	if (loaded(id)) {
		packages = lexiconData[id].packages.slice();
		delete lexiconData[id];
	}
	let data = await load(id);
	for (let packageName of packages) {
		data = await load(id, packageName);
	}
	return data;
}

export async function loadLambda(id: string) {
	return (await load(id)).lambda;
}

export async function loadLexicon(id: string) {
	return (await load(id)).lexicon;
}
