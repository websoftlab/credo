import type { BuildMode, CredoPlugin } from "./types";
import { newError } from "@credo-js/cli-color";
import { clear, createCwdDirectoryIfNotExists, existsStat } from "./utils";
import { installAllPlugins } from "./plugins/installer";
import { loadAllPlugins } from "./plugins/loader";
import { buildClient, buildLexicon, buildServer, buildPages, buildServerDaemon } from "./plugins/build";
import { installDependencies } from "./dependencies";
import createPluginFactory from "./plugins/createPluginFactory";

export default async function compiler(
	mode: BuildMode = "development",
	clearing: boolean = true
): Promise<CredoPlugin.Factory> {
	const stat = await existsStat("credo.json");
	if (!stat) {
		throw newError(`The {yellow ./credo.json} file not found!`);
	} else if (!stat.isFile) {
		throw newError(`{yellow ./credo.json} path must be a file`);
	}

	if (mode === "development") {
		await installAllPlugins();
	}

	const isDev = mode === "development";
	const dist = isDev ? "dev" : "build";

	// clear old runtime data
	if (clearing) {
		await clear(`./.credo`);
	}

	await createCwdDirectoryIfNotExists(dist);
	await createCwdDirectoryIfNotExists(".credo");

	const plugins = await loadAllPlugins();
	const factory = await createPluginFactory(plugins);

	const { renderDriver } = factory.options;
	if (renderDriver) {
		await installDependencies(renderDriver.dependencies || {}, renderDriver.devDependencies || {});
		await installDependencies({ "@credo-js/responder-page": "latest" });
	}

	await buildLexicon(factory);
	await buildPages(factory);
	await buildClient(factory);
	await buildServer(factory);
	await buildServerDaemon(factory);

	await factory.fireHook("onBuild", factory);

	return factory;
}
