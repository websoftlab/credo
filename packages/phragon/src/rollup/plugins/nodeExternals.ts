import type { Plugin, PluginContext } from "rollup";
import { cwdPath, exists, existsStat, readJsonFile, fileHash, writeJsonFile } from "../../utils";
import path from "node:path";
import { builtinModules } from "node:module";
// @ts-ignore
import { isBuiltin } from "node:module";

type MaybeFalsy<T> = T | undefined | null | false;
type MaybeArray<T> = T | T[];
type ExternalCallback = (id: string, importer: string | undefined) => boolean;

export interface ExternalsOptions {
	/**
	 * Force include these deps in the list of externals, regardless of other settings.
	 *
	 * Defaults to `[]` (force include nothing)
	 */
	include?: MaybeArray<MaybeFalsy<string | RegExp | ExternalCallback>>;

	/**
	 * Force exclude these deps from the list of externals, regardless of other settings.
	 *
	 * Defaults to `[]` (force exclude nothing)
	 */
	exclude?: MaybeArray<MaybeFalsy<string | RegExp | ExternalCallback>>;
}

// Our defaults
type Config = Required<ExternalsOptions>;

// Prepare node built-in modules lists.
const nodePrefix = "node:";

const defaults: Config = {
	include: [],
	exclude: [],
};

const createRegExpCallback =
	(entry: RegExp): ExternalCallback =>
	(id: string) =>
		entry.test(id);

const IsBuiltin: (id: string) => boolean =
	typeof isBuiltin === "function"
		? isBuiltin
		: (id: string) => {
				if (id.startsWith("node:")) {
					id = id.substring(5);
				}
				return builtinModules.includes(id);
		  };

const isCommonJS = (data: {
	type: string;
	main?: string;
	module?: string;
	exports?: Record<string, string | undefined | Record<string, string | undefined>>;
}) => {
	const { type } = data;
	if (type != "module") {
		return true;
	}
	// Package type specified module
	// Check if the package contains the Common JS version
	const { main, module, exports } = data;
	if (module && main) {
		return true;
	}
	const root = exports ? exports["."] : null;
	if (root != null && typeof root === "object") {
		return typeof root.require === "string" || typeof root.default === "string";
	}
	return false;
};

async function depsTree(file: string, root: boolean, warnings: string[], tree: string[] = []) {
	if (!(await exists(file))) {
		return tree;
	}

	let data: { dependencies?: Record<string, string> };
	try {
		data = await readJsonFile(file);
	} catch {
		warnings.push(`File ${JSON.stringify(file)} does not look like a valid package.json file.`);
		return tree;
	}

	const deps = Object.keys(data.dependencies || {});
	const dirname = path.dirname(file);
	for (const dep of deps) {
		if (tree.includes(dep)) {
			continue;
		}
		// check nested
		if (!root) {
			const nested = cwdPath(dirname, "node_modules", dep, "package.json");
			if (await exists(nested)) {
				continue;
			}
		}
		tree.push(dep);
		await depsTree(cwdPath("node_modules", dep, "package.json"), false, warnings, tree);
	}

	return tree;
}

/**
 * A Rollup plugin that automatically declares NodeJS built-in modules,
 * and optionally npm dependencies, as 'external'.
 */
export default function externals(options: ExternalsOptions = {}): Plugin {
	// Consolidate options
	const config: Config = Object.assign(Object.create(null), defaults, options);

	// Map the include and exclude options to arrays of regexes.
	const warnings: string[] = [];
	const [include, exclude] = (["include", "exclude"] as const).map((option) =>
		([] as MaybeFalsy<string | RegExp | ExternalCallback>[])
			.concat(config[option])
			.reduce((result, entry, index) => {
				if (entry) {
					if (entry instanceof RegExp) {
						result.push(createRegExpCallback(entry));
					} else if (typeof entry === "string") {
						result.push(
							createRegExpCallback(new RegExp("^" + entry.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "$"))
						);
					} else if (typeof entry === "function") {
						result.push(entry);
					} else {
						warnings.push(
							`Ignoring wrong entry type #${index} in '${option}' option: ${JSON.stringify(entry)}`
						);
					}
				}
				return result;
			}, [] as ExternalCallback[])
	);

	const isIncluded = (id: string, importer: string | undefined) => include.some((rx) => rx(id, importer));
	const isExcluded = (id: string, importer: string | undefined) => exclude.some((rx) => rx(id, importer));

	type ReloadData = { hash: { pg: string | null; yarn: string | null; npm: string | null }; tree: string[] };
	type ModuleType = "esm" | "cjs";
	type ModuleTypeNullable = ModuleType | null;

	let tree: string[] = [];
	let idCache: Record<string, ModuleType> = {};
	let init = false;

	async function reloadTree() {
		const file = cwdPath(".phragon/dev-dependencies.json");
		const packageFile = cwdPath("package.json");
		const yarnLockFile = cwdPath("yarn.lock");
		const packageLockFile = cwdPath("package-lock.json");
		const packageHash = (await exists(packageFile)) ? await fileHash(packageFile) : null;
		const yarnLockHash = (await exists(yarnLockFile)) ? await fileHash(yarnLockFile) : null;
		const npmLockHash = (await exists(packageLockFile)) ? await fileHash(packageLockFile) : null;

		if (await exists(file)) {
			const { hash, tree: _tree }: ReloadData = await readJsonFile(file);
			if (hash.pg === packageHash && hash.yarn === yarnLockHash && hash.npm === npmLockHash) {
				if (!init) {
					tree = _tree;
				}
				return false;
			}
		}

		tree = await depsTree(packageFile, true, warnings);
		await writeJsonFile(file, {
			tree,
			hash: {
				pg: packageHash,
				yarn: yarnLockHash,
				npm: npmLockHash,
			},
		} as ReloadData);

		return true;
	}

	const typeId: Record<string, boolean> = Object.create(null);
	const typeIdAwait: Record<
		string,
		{ resolve: (type: ModuleTypeNullable) => void; reject: (err: unknown) => void }[]
	> = {};

	async function getType(self: PluginContext, id: string, ids: string[]): Promise<ModuleTypeNullable> {
		if (typeId[id]) {
			return new Promise<ModuleTypeNullable>((resolve, reject) => {
				typeIdAwait[id].push({ resolve, reject });
			});
		}

		typeIdAwait[id] = [];
		typeId[id] = true;

		const done = (type: ModuleTypeNullable, err?: unknown) => {
			while (true) {
				const cb = typeIdAwait[id].shift();
				if (!cb) {
					break;
				}
				if (err) {
					cb.reject(err);
				} else {
					cb.resolve(type);
				}
			}
			typeId[id] = false;
			return type;
		};

		try {
			let file = cwdPath("node_modules");
			let prefix = "";
			let isDep = false;

			const packages: string[] = [];

			for (const entry of ids) {
				if (!isDep) {
					prefix = prefix.length ? `${prefix}/${entry}` : entry;
					if (tree.includes(prefix)) {
						isDep = true;
					}
				}
				file = path.join(file, entry);
				const stat = await existsStat(file);
				if (!stat || stat.isFile) {
					break;
				}
				const pg = path.join(stat.file, "package.json");
				if (await exists(pg)) {
					packages.push(pg);
				}
			}

			if (!isDep || packages.length === 0) {
				return done(null);
			}

			let type: ModuleType = "esm";

			for (let i = packages.length - 1, data; i > -1; i--) {
				try {
					data = await readJsonFile(packages[i]);
				} catch {
					self.error({
						message: `File ${JSON.stringify(packages[i])} does not look like a valid package.json file.`,
						stack: undefined,
					});
					return done(null);
				}
				if (data.type) {
					if (!isCommonJS(data)) {
						continue;
					}
				} else if (i > 0) {
					continue;
				}
				type = "cjs";
				break;
			}

			idCache[id] = type;
			return done(type);
		} catch (err) {
			done(null, err);
			throw err;
		}
	}

	return {
		name: "node-externals",

		async buildStart() {
			const packageFile = cwdPath("package.json");

			// reset dependencies and cache
			if (await reloadTree()) {
				idCache = {};
			}

			if (!init && (await exists(packageFile))) {
				init = true;
				// Watch the file
				if (this.meta.watchMode) {
					this.addWatchFile(packageFile);
				}
			}

			// Issue any warnings we may have collected earlier.
			while (warnings.length > 0) {
				this.warn(warnings.shift()!); // eslint-disable-line @typescript-eslint/no-non-null-assertion
			}
		},

		async resolveId(id, importer) {
			// Let Rollup handle already resolved ids, relative imports and virtual modules.
			if (/^(?:\0|\.{1,2}[\\/])/.test(id) || path.isAbsolute(id)) {
				return null;
			}

			// Handle node builtins.
			if (IsBuiltin(id)) {
				const idName = id.startsWith(nodePrefix) ? id : nodePrefix + id;
				return {
					id: idName,
					external: !isExcluded(id, importer),
					moduleSideEffects: false,
				};
			}

			// Handle npm dependencies.
			if (isExcluded(id, importer)) {
				return null; // normal handling
			}
			if (id.startsWith("@phragon/") || id === "phragon" || isIncluded(id, importer)) {
				return false; // external
			}

			const ids = id.split(/[\/\\]/g);

			if (importer) {
				const find = [ids[0]];
				const dirname = path.dirname(importer);
				if (ids.length === 1) {
					find.push(`${ids[0]}.js`, `${ids[0]}.ts`);
				}
				for (const entry of find) {
					const file = path.join(dirname, entry);
					if (await exists(file)) {
						return null; // normal handling
					}
				}
			}

			if (idCache.hasOwnProperty(id)) {
				return idCache[id] === "cjs" ? false : null;
			}

			return (await getType(this, id, ids)) === "cjs" ? false : null;
		},
	};
}
