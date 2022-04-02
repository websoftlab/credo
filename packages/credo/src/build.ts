import compiler from "./compiler";
import webpackBuilder from "./webpack/builder";
import rollupBuilder from "./rollup/builder";
import {clear, copy, cwdPath} from "./utils";
import spawn from 'cross-spawn';
import type {BuildMode, BuildOptions} from "./types";

async function emitOnBuild(onBuildTimeout?: string | number) {
	const args = [cwdPath("build/server/cmd.js"), "build"];
	if(onBuildTimeout != null) {
		args.push("--timeout", String(onBuildTimeout));
	}
	return new Promise<void>((resolve, reject) => {
		const child = spawn(process.argv[0], args, {
			stdio: "inherit",
		});
		child.on('close', code => {
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
	const {ssr, renderDriver, clusters} = factory.options;
	const conf: BuildOptions = {mode, factory, progressLine: false};
	const isProd = mode === "production";

	await clear(`./${isProd ? "build" : "dev"}`);

	if(renderDriver) {
		if(clusters && clusters.length) {
			for(let cluster of clusters) {
				if(cluster.mode !== "cron") {
					await webpackBuilder({ cluster, type: "client", isDevServer: false, ... conf });
					if(cluster.ssr) {
						await webpackBuilder({ cluster, type: "server-page", ... conf });
					}
				}
			}
		} else {
			await webpackBuilder({ type: "client", isDevServer: false, ... conf });
			if(ssr) {
				await webpackBuilder({ type: "server-page", ... conf });
			}
		}
	}

	await rollupBuilder( { type: "server", ... conf });

	// copy cmd
	if(isProd) {
		await copy(`./.credo/cmd.js`, './build/server/cmd.js');
		await copy(`./.credo/credo-daemon.json`, './build/server/credo-daemon.json');
		await emitOnBuild(factory.options.onBuildTimeout);
	}
}