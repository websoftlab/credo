import type { PhragonPlugin } from "../types";
import { createCwdDirectoryIfNotExists, writeBundleFile } from "../utils";
import { CmpJS } from "@phragon/cli-cmp";
import createRelativePath from "./createRelativePath";

export async function buildPages(factory: PhragonPlugin.Factory) {
	const { render } = factory;
	if (!render) {
		return;
	}

	let { page, ssr, cluster: clusterList, components } = factory;
	const renderComponentImport = `${render.modulePath}/component`;
	const extensions = render.extensions?.all;

	async function create(options: {
		mid?: number;
		ssr: boolean;
		page: PhragonPlugin.RenderPage;
		components?: Record<string, PhragonPlugin.Handler>;
	}) {
		const { mid, components, page, ssr } = options;
		const cJs = new CmpJS();
		const relative = mid ? ".phragon/pages" : ".phragon";
		const file = mid ? `pages/page-${mid}.js` : "pages.js";

		cJs.set(renderComponentImport, "define");
		cJs.impOnly(createRelativePath(page.path, relative, extensions));

		if (components) {
			for (let name in components) {
				const e = components[name];
				cJs.append(
					`${cJs.get("define")}(${cJs.tool.esc(name)}, ${cJs.imp(
						createRelativePath(e.path, relative, extensions),
						e.importer
					)});`
				);
			}
		}

		await writeBundleFile(file, cJs.toJS("import"));
		if (ssr) {
			if (mid) {
				await writeBundleFile(`pages/server-page-${mid}.js`, `import "./page-${mid}.js";`);
			} else {
				await writeBundleFile(`server-page.js`, `import "./pages.js";`);
			}
		}
	}

	if (clusterList.length > 0) {
		await createCwdDirectoryIfNotExists(".phragon/pages");
		for (let cluster of clusterList) {
			const { mid, ssr, mode, page, render, components } = cluster;
			if (mode === "app" && page && render) {
				await create({
					mid,
					ssr,
					page,
					components,
				});
			}
		}
	} else if (page) {
		await create({ ssr, page: page.render, components: components.components });
	}
}
