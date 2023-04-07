import type { PhragonPlugin } from "../types";
import { CmpJS } from "@phragon/cli-cmp";
import { isPlainObject } from "@phragon-util/plain-object";
import createRelativePath from "./createRelativePath";
import { buildPath, createCwdDirectoryIfNotExists, exists, writeBundleFile } from "../utils";
import { writeFile } from "node:fs/promises";

async function writeClientFailure() {
	const file = buildPath("./client-failure.js");
	if (!(await exists(file))) {
		await writeFile(
			file,
			`export default function failure(err) {
	if(__DEV__) {
		console.error("Ready page failure", err);
	}
	const div = document.createElement("div");
	const style = {
		position: "fixed",
		top: "0",
		left: "0",
		width: "100%",
		padding: "20px 30px",
		zIndex: "100000",
		backgroundColor: "#000",
		color: "#d02f2f",
		font: "15px/1 sans-serif",
		textAlign: "center",
	};
	Object.keys(style).forEach((key) => { div.style[key] = style[key]; });
	div.appendChild(document.createTextNode(err.message));
	document.body.appendChild(div);
}`
		);
	}
}

export async function buildClient(factory: PhragonPlugin.Factory) {
	const { render } = factory;
	if (!render) {
		return;
	}

	const { cluster: clusterList } = factory;
	const renderPageImport = `${render.modulePath}/client`;

	async function create(options: {
		mid?: number;
		renderOptions?: any;
		bootloader: PhragonPlugin.ConfigType<"bootloader", PhragonPlugin.Handler>[];
	}) {
		const { mid, bootloader, renderOptions } = options;
		const file = mid ? `client-${mid}/client.js` : "client.js";
		const cJs = new CmpJS();
		const bootloaders: string[] = [cJs.imp(`${mid ? ".." : "."}/lexicon-client.js`)];
		const boot: string[] = [];

		if (mid) {
			await createCwdDirectoryIfNotExists(`.phragon/client-${mid}`);
		}

		const addBoot = (bootloader: PhragonPlugin.HandlerOptional) => {
			let { path, importer, options } = bootloader;
			const func = cJs.imp(createRelativePath(path, mid ? ".phragon/pages" : ".phragon"), importer);
			if (!boot.includes(func)) {
				boot.push(func);
				bootloaders.push(
					`(api) => typeof ${func} === "function" && ${func}(api${
						options ? `, ${cJs.tool.esc(options)}` : ""
					})`
				);
			}
		};

		const failure = cJs.imp(mid ? `../client-failure.js` : "./client-failure.js");
		cJs.impOnly(mid ? `../pages/page-${mid}.js` : "./pages.js");

		bootloader.forEach(({ bootloader }) => addBoot(bootloader));

		const func = cJs.imp(renderPageImport, "renderPage");

		cJs.append(`const renderPage = ${func};`);

		cJs.group('if( typeof renderPage === "function" )', "", (t) => {
			const { bootloader, ...rest } = isPlainObject(renderOptions) ? renderOptions : <any>{};
			let opt = t.esc(rest).slice(1, -1).trim();
			if (opt.length > 0) {
				opt += ", ";
			}
			cJs.append('const node = document.getElementById("root");');
			cJs.group("if( node )", "", () => {
				cJs.append(`const options = {${opt}bootloader: [ ${bootloaders.join(", ")} ]};`);
				cJs.append(`renderPage(node, options).catch(${failure});`);
			});
			cJs.group("else", "", () => {
				cJs.append(`${failure}(new Error("root element not found"));`);
			});
		});

		cJs.group("else", "", () => {
			cJs.append(`${failure}(new Error("render callback is not defined"));`);
		});

		await writeBundleFile(file, cJs.toJS("import"));
	}

	await writeClientFailure();

	if (clusterList.length > 0) {
		// remove last boostrap (use boostrap from cluster)
		const loader = factory.bootloader.slice();
		if (loader.length > 0) {
			const last = loader[loader.length - 1];
			if (last.__plugin.root && factory.renderPlugin?.root) {
				loader.pop();
			}
		}

		for (let cluster of clusterList) {
			const { bootloader, page, render, mode, mid, renderOptions } = cluster;
			const bl = loader.slice();
			if (bootloader) {
				bl.push({ __plugin: factory.root, bootloader });
			}
			if (mode === "app" && page && render) {
				await create({ mid, bootloader: bl, renderOptions });
			}
		}
	} else {
		await create({ bootloader: factory.bootloader, renderOptions: factory.renderOptions });
	}
}
