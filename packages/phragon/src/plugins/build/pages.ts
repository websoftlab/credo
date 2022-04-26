import { createCwdDirectoryIfNotExists, writeBundleFile } from "../../utils";
import { CmpJS } from "@phragon/cli-cmp";
import createRelativePath from "./createRelativePath";
import type { PhragonPlugin } from "../../types";

export async function buildPages(factory: PhragonPlugin.Factory) {
	const {
		options: { renderDriver },
	} = factory;
	if (!renderDriver) {
		return;
	}

	let {
		options: { pages, ssr, clusters, components },
	} = factory;
	const renderComponentImport = `${renderDriver.modulePath}/component`;
	const extensions = renderDriver.extensions?.all;

	async function create(options: {
		mid?: number;
		ssr: boolean;
		pages?: string | false | null;
		components?: Record<string, string>;
	}) {
		const { mid, components, ssr } = options;
		const cJs = new CmpJS();
		const relative = mid ? ".phragon/pages" : ".phragon";
		const file = mid ? `pages/page-${mid}.js` : "pages.js";

		cJs.set(renderComponentImport, "define");

		if (options.pages) {
			cJs.impOnly(createRelativePath(options.pages, relative, extensions));
		}

		if (components) {
			for (let name in components) {
				cJs.append(
					`${cJs.get("define")}(${cJs.tool.esc(name)}, ${cJs.imp(
						createRelativePath(components[name], relative, extensions)
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

	if (clusters && clusters.length > 0) {
		await createCwdDirectoryIfNotExists(".phragon/pages");
		for (let cluster of clusters) {
			const { mid, ssr, mode, pages, components } = cluster;
			if (mode === "app") {
				await create({
					mid,
					ssr,
					pages,
					components,
				});
			}
		}
	} else {
		await create({ ssr, pages, components });
	}
}
