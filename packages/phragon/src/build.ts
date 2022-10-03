import compiler from "./compiler";
import webpackBuilder from "./webpack/builder";
import rollupBuilder from "./rollup/builder";
import { clear, copy, cwdPath } from "./utils";
import spawn from "cross-spawn";
import type { BuildMode, BuildOptions } from "./types";

async function emitOnBuild(onBuildTimeout?: string | number | null) {
	const args = [cwdPath("build/server/cmd.js"), "build"];
	if (onBuildTimeout != null) {
		args.push("--timeout", String(onBuildTimeout));
	}
	return new Promise<void>((resolve, reject) => {
		const child = spawn(process.argv[0], args, {
			stdio: "inherit",
		});
		child.on("close", (code) => {
			if (code !== 0) {
				reject(new Error("cmd build - failure..."));
			} else {
				resolve();
			}
		});
	});
}

export default async function build(mode: BuildMode = "production") {
	const factory = await compiler(mode);
	const { ssr, render, cluster: clusterList } = factory;
	const conf: BuildOptions = { mode, factory };
	const isProd = mode === "production";

	await clear(`./${isProd ? "build" : "dev"}`);

	if (render) {
		if (clusterList.length) {
			for (let cluster of clusterList) {
				if (cluster.mode !== "cron") {
					await webpackBuilder({ cluster, type: "client", isDevServer: false, ...conf });
					if (cluster.ssr) {
						await webpackBuilder({ cluster, type: "server-page", ...conf });
					}
				}
			}
		} else {
			await webpackBuilder({ type: "client", isDevServer: false, ...conf });
			if (ssr) {
				await webpackBuilder({ type: "server-page", ...conf });
			}
		}
	}

	await rollupBuilder({ type: "server", ...conf });

	// copy cmd
	if (isProd) {
		await copy(`./.phragon/cmd.js`, "./build/server/cmd.js");
		await copy(`./.phragon/phragon-daemon.json`, "./build/server/phragon-daemon.json");
		await emitOnBuild(factory.buildTimeout);
	}
}
