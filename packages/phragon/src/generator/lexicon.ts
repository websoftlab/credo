import type { PhragonPlugin } from "../types";
import { exists, existsStat, readJsonFile, createCwdDirectoryIfNotExists, writeBundleFile, buildPath } from "../utils";
import { join } from "path";
import { readdir } from "fs/promises";
import { CmpJS } from "@phragon/cli-cmp";
import createRelativePath from "./createRelativePath";

type LanguageH = { id: string; main: string; packages: Array<{ name: string; file: string }> };
type LanguageFile = { file: string; mode?: "lambda" | "data" | "all"; root: boolean };
type Languages = Record<string, Language>;
type Language = {
	id: string;
	main: LanguageFile[];
	lambda: string[];
	packages: Record<string, LanguageFile[]>;
};

function someFile(all: LanguageFile[], file: string): boolean {
	return all.some((f) => f.file === file);
}

async function createPackagePrefix() {
	const file = buildPath("lang/packagePrefix.js");
	if (await exists(file)) {
		return;
	}

	return writeBundleFile(
		"lang/packagePrefix.js",
		`
export default function packagePrefix(pref, languageData, data = {}) {
	pref += ":";
	Object.keys(languageData).forEach((key) => { data[pref + key] = languageData[key]; });
	return data;
}`
	);
}

async function createLambdaFilter() {
	const file = buildPath("lang/lambdaFilter.js");
	if (await exists(file)) {
		return;
	}

	return writeBundleFile(
		"lang/lambdaFilter.js",
		`function isObject(value) {
	return value != null && typeof value === "object";
}

function filter(data, items, pref, relink) {
	Object.keys(items).forEach(key => {
		const value = items[key];
		if(typeof value === "function") {
			data[pref + key] = value;
		} else if(isObject(value) && ! relink.includes(value)) {
			relink.push(value);
			filter(data, value, pref.length === 0 && key === "default" ? "" : \`\${key}.\`, relink);
		}
	});
	return data;
}

export default function lambdaFilter(data, items) {
	return filter(data, items, "", []);
}`
	);
}

async function scanLexiconId(language: Language, languageFile: LanguageFile, packages?: string[]) {
	let { file: dir, root, mode = "all" } = languageFile;
	let lnDir = await existsStat([dir, language.id]);

	if (lnDir && !lnDir.isDirectory) {
		lnDir = null;
	}

	const lambda: string[] = [];
	const main: string[] = [];

	if (mode !== "data") {
		lambda.push(join(dir, `${language.id}.lambda.js`));
		if (root) {
			lambda.push(join(dir, `${language.id}.lambda.ts`));
		}
	}

	if (mode !== "lambda") {
		main.push(join(dir, `${language.id}.json`));
	}

	if (lnDir) {
		if (mode !== "lambda") {
			main.push(join(lnDir.file, `${language.id}.json`));
		}
		if (mode !== "data") {
			lambda.push(join(lnDir.file, `${language.id}.lambda.js`));
			if (root) {
				lambda.push(join(lnDir.file, `${language.id}.lambda.ts`));
			}
		}
	}

	for (let file of lambda) {
		if (language.lambda.includes(file)) {
			continue;
		}
		const st = await existsStat(file);
		if (st && st.isFile) {
			language.lambda.push(file);
		}
	}

	for (let file of main) {
		if (someFile(language.main, file)) {
			continue;
		}
		const st = await existsStat(file);
		if (st && st.isFile) {
			language.main.push({ file, root });
		}
	}

	const isPg = packages && packages.length > 0;
	if (lnDir && mode !== "lambda" && (!packages || isPg)) {
		const files = await readdir(lnDir.file);
		for (let file of files) {
			const match = file.match(/^(.+?)\.package\.json$/);
			if (match) {
				const name = match[1];
				if (isPg && !packages.includes(name)) {
					continue;
				}
				file = join(lnDir.file, file);
				if (!language.packages.hasOwnProperty(name)) {
					language.packages[name] = [{ file, root }];
				} else if (!someFile(language.packages[name], file)) {
					language.packages[name].push({ file, root });
				}
			}
		}
	}
}

export async function buildLexicon(factory: PhragonPlugin.Factory) {
	const { lexicon } = factory;
	const { languages, route } = lexicon;
	if (languages.length < 1) {
		const empty = "// no language data \nexport default () => {}";
		await writeBundleFile("lexicon-server.js", empty);
		await writeBundleFile("lexicon-client.js", empty);
		return;
	}

	const { language, include: inc, exclude: exc } = factory.lexicon;

	const data: Languages = {};
	const items: LanguageFile[] = [];

	let keyInc: null | Record<string, "lambda" | "data" | "all"> = null,
		keyExc: null | Record<string, "lambda" | "data" | "all"> = null;

	if (inc) {
		keyInc = {};
		for (let item of inc) {
			keyInc[item.name] = item.type;
		}
	} else if (exc) {
		keyExc = {};
		for (let item of exc) {
			keyExc[item.name] = item.type;
		}
	}

	for (const plugin of factory.plugins) {
		const stat = await existsStat(plugin.joinPath("lexicon"));
		if (stat && stat.isDirectory) {
			const { name } = plugin;
			const { file } = stat;
			let mode: "lambda" | "data" | "all" = "all";
			if (keyInc) {
				const km = keyInc[name];
				if (!km) {
					continue;
				}
				mode = km;
			} else if (keyExc) {
				const km = keyExc[name];
				if (km) {
					if (km === "all") {
						continue;
					}
					mode = km === "data" ? "lambda" : "data";
				}
			}
			if (someFile(items, file)) {
				items.push({ file, mode, root: plugin.root });
			}
		}
	}

	if (!items.some((item) => item.root)) {
		items.push({
			file: await createCwdDirectoryIfNotExists("./lexicon"),
			root: true,
		});
	}

	for (let id of languages) {
		data[id] = {
			id,
			main: [],
			lambda: [],
			packages: {},
		};
		for (let item of items) {
			await scanLexiconId(data[id], item, lexicon.packages);
		}
	}

	await createCwdDirectoryIfNotExists(".phragon/lang");
	await createPackagePrefix();

	let isLambda = false;
	let isPg = false;
	const ls: LanguageH[] = [];

	for (let id of languages) {
		const lang = data[id];
		const cJs = new CmpJS();

		let isMain = "",
			all: any = {},
			lambda: string[] = [];

		for (let item of lang.main) {
			const { file, root } = item;
			if (root) {
				isMain = cJs.imp(createRelativePath(file, ".phragon/lang"));
			} else {
				Object.assign(all, await readJsonFile(file));
			}
		}

		for (let file of lang.lambda) {
			lambda.push(cJs.imp(createRelativePath(file, ".phragon/lang"), "*"));
		}

		cJs.append([
			"let lambda = {};",
			`const id = ${cJs.tool.esc(id)};`,
			`const lexicon = ${JSON.stringify(all, null, 2)};`,
		]);

		if (isMain) {
			cJs.append(`Object.assign(lexicon, ${isMain});`);
		}

		if (lambda.length) {
			isLambda = true;
			const lm = cJs.imp("./lambdaFilter");
			lambda.forEach((varName) => {
				cJs.append(`lambda = ${lm}(lambda, ${varName});`);
			});
		}

		cJs.append(`export {id, lexicon, lambda};`);
		await writeBundleFile(`./lang/${id}-inc.js`, cJs.toImport() + cJs.toString());

		const lh: LanguageH = { id, main: `./lang/${id}-inc.js`, packages: [] };
		const pgAll = Object.keys(lang.packages);
		pgAll.length > 0 && (await createCwdDirectoryIfNotExists(`.phragon/lang/${id}`));
		ls.push(lh);

		if (pgAll.length > 0) {
			isPg = true;
		}

		for (let pgName of pgAll) {
			const files = lang.packages[pgName];
			const cJs = new CmpJS();
			const pgData: any = {};

			let pgMain = "";

			for (let file of files) {
				if (file.root) {
					pgMain = cJs.imp(createRelativePath(file.file, `.phragon/lang/${id}`));
				} else {
					const dt = await readJsonFile(file.file);
					Object.keys(dt).forEach((key) => {
						pgData[`${pgName}:${key}`] = dt[key];
					});
				}
			}

			cJs.append(`const data = ${JSON.stringify(pgData, null, 2)};`);
			if (pgMain) {
				cJs.append(`${cJs.imp("../packagePrefix")}(${cJs.tool.esc(`${pgName}`)}, ${pgMain}, data);`);
			}

			cJs.append("export default data;");
			await writeBundleFile(`./lang/${id}/${pgName}.js`, cJs.toImport() + cJs.toString());

			lh.packages.push({ name: pgName, file: `./lang/${id}/${pgName}.js` });
		}
	}

	if (isLambda) {
		await createLambdaFilter();
	}

	let cJs = new CmpJS();
	cJs.set("@phragon/lexicon", "setDefaultLanguageId");
	cJs.set("@phragon/lexicon", "register");
	cJs.append(`${cJs.gef("setDefaultLanguageId", cJs.tool.esc(language))};`);

	if (route) {
		const { method, service, path } = route;

		const sJs = cJs.clone();
		const isData = method === "POST";
		const isGet = !isData;

		cJs.group("export default function(api)", "", (t) => {
			cJs.append(`const pattern = ${cJs.imp("@phragon/path-to-pattern", "pathToPattern")}(${t.esc(path)});`);
			for (let lh of ls) {
				const { id, main, packages } = lh;
				const ide = cJs.tool.esc(id);
				cJs.group(
					`${cJs.get("register")}(${ide}, async () => __id(${ide}, await import(${cJs.tool.esc(main)})),`,
					`);`,
					() => {
						packages.forEach(({ name, file }) => {
							cJs.append(
								`${cJs.tool.esc(name)}: async () => __idPg(${ide}, ${cJs.tool.esc(
									name
								)}, await import(${cJs.tool.esc(file)})),`
							);
						});
					}
				);
			}
			if (isGet) {
				cJs.group("function addQuery(url, key, value)", "", () => {
					cJs.append(
						`return pattern.keys.includes(key) ? url : (url + (url.includes("?") ? "&" : "?") + key + "=" + encodeURIComponent(value));`
					);
				});
			}
			if (isData) {
				cJs.group("function addData(config, key, value)", "", () => {
					cJs.group("if(!pattern.keys.includes(key))", "", () => {
						cJs.append(`if(!config.data) config.data = {};`);
						cJs.append(`config.data[key] = value;`);
					});
				});
			}
			cJs.group("function __id(id, data)", "", () => {
				cJs.append(`let url = pattern.matchToPath({data:{id}});`);
				if (isGet) {
					cJs.append('url = addQuery(url, "id", id);');
				}
				cJs.append(`const config = { url, method: ${cJs.tool.esc(method)}, maxRedirects: 0 };`);
				if (isData) {
					cJs.append(`addData(config, "id", id);`);
				}
				cJs.group("return api.services.http.request(config).then((r) =>", ");", () => {
					cJs.append([
						`if(!String(r.status).startsWith("20")) throw new Error(r.data.message || \`Language \${id} load error (\${r.status})\`);`,
						"return { id: data.id, lexicon: Object.assign({}, data.lexicon, r.data), lambda: data.lambda };",
					]);
				});
			});
			if (isPg) {
				cJs.group("function __idPg(id, packageName, data)", "", () => {
					cJs.append(`let url = pattern.matchToPath({data:{id, "package": packageName}});`);
					if (isGet) {
						cJs.append('url = addQuery(url, "id", id);');
						cJs.append('url = addQuery(url, "package", packageName);');
					}
					cJs.append(`const config = { url, method: ${cJs.tool.esc(method)}, maxRedirects: 0 };`);
					if (isData) {
						cJs.append(`addData(config, "id", id);`);
						cJs.append(`addData(config, "package", packageName);`);
					}
					cJs.group("return api.services.http.request(config).then((r) =>", ");", () => {
						cJs.append([
							`if(!String(r.status).startsWith("20")) throw new Error(r.data.message || \`Language \${id}:\${packageName} load error (\${r.status})\`);`,
							`return { default: Object.assign({}, data.default, r.data) };`,
						]);
					});
				});
			}
		});

		await writeBundleFile(`./lexicon-client.js`, cJs.toImport() + cJs.toString());

		sJs.group("export default function(phragon)", "", (t) => {
			sJs.append(`const pattern = ${sJs.imp("@phragon/path-to-pattern", "pathToPattern")}(${t.esc(path)});`);
			sJs.append(`const languages = ${t.esc(languages)};`);

			sJs.group(
				`phragon.route.addRoute(new ${sJs.imp("@phragon/server/route", "RoutePattern")}(`,
				"), 100);",
				() => {
					sJs.append(`pattern,`);
					sJs.append(`methods: [${t.esc(method)}],`);
					sJs.append(`match(ctx) { return pattern.match(ctx.path); },`);
					sJs.group("context:", ",", () => {
						const asyncResult = sJs.imp("@phragon/utils", "asyncResult");
						sJs.append([
							`name: "lexicon",`,
							`controller: {`,
							`\tname: Symbol(),`,
							`\tasync handler(ctx) {`,
							`\t\tconst match = ctx.match || {};`,
							`\t\tconst query = ctx.request.${isGet ? "query" : "body"} || {};`,
							`\t\tconst id = pattern.keys.includes("id") ? match.id : query.id;`,
							`\t\tconst packageName = pattern.keys.includes("package") ? match["package"] : query["package"];`,
							`\t\tif(!languages.includes(id)) throw new Error("Language ID not specified or invalid.");`,
							`\t\tconst data = await ${asyncResult}(${sJs.tool.keyVar(
								"phragon.services",
								service.split(".")
							)}(id, packageName));`,
							`\t\treturn packageName ? ${sJs.imp("./lang/packagePrefix")}(packageName, data) : data;`,
							`\t},`,
							`},`,
							`responder: { name: "json" },`,
						]);
					});
				}
			);

			for (let lh of ls) {
				const { id, main, packages } = lh;
				const ide = sJs.tool.esc(id);
				const impVar = sJs.imp(main, "*");
				sJs.group(`${sJs.get("register")}(${ide}, () => __id(${ide}, ${impVar}),`, `);`, () => {
					packages.forEach(({ name, file }) => {
						const impVar = sJs.imp(file);
						sJs.append(`${sJs.tool.esc(name)}: () => __idPg(${ide}, ${sJs.tool.esc(name)}, ${impVar}),`);
					});
				});
			}

			sJs.group("async function __id(id, data)", "", () => {
				const asyncResult = sJs.imp("@phragon/utils", "asyncResult");
				sJs.append(
					`const r = await ${asyncResult}(${sJs.tool.keyVar("phragon.services", service.split("."))}(id));`
				);
				sJs.append("return { id: data.id, lexicon: Object.assign({}, data.lexicon, r), lambda: data.lambda };");
			});

			sJs.group("async function __idPg(id, packageName, data)", "", () => {
				const asyncResult = sJs.imp("@phragon/utils", "asyncResult");
				sJs.append(
					`const r = await ${asyncResult}(${sJs.tool.keyVar(
						"phragon.services",
						service.split(".")
					)}(id, packageName));`
				);
				sJs.append(`return ${sJs.imp("./lang/packagePrefix")}(packageName, r, Object.assign({}, data));`);
			});
		});

		await writeBundleFile(`./lexicon-server.js`, sJs.toImport() + sJs.toString());
	} else {
		cJs.group("export default function()", "", () => {
			for (let lh of ls) {
				const { id, main, packages } = lh;
				cJs.group(
					`${cJs.get("register")}(${cJs.tool.esc(id)}, async () => import(${cJs.tool.esc(main)}),`,
					`);`,
					() => {
						packages.forEach(({ name, file }) => {
							cJs.append(`${cJs.tool.esc(name)}: async () => import(${cJs.tool.esc(file)}),`);
						});
					}
				);
			}
		});

		const text = cJs.toJS("import");

		await writeBundleFile(`./lexicon-client.js`, text);
		await writeBundleFile(`./lexicon-server.js`, text);
	}
}
