import { localPathName } from "../../utils";
import { debugBuild } from "../../debug";
import type { Plugin } from "rollup";
import type { BuildConfigure } from "../../types";

export default function progressRollupPlugin(conf: BuildConfigure) {
	const progress = {
		total: 0,
		loaded: 0,
	};

	function debug(message: string) {
		if (conf.debug) {
			conf.debug(message);
		} else {
			debugBuild(message);
		}
	}

	return <Plugin>{
		name: "progress",
		load() {
			progress.loaded += 1;
		},
		watchChange(id) {
			const file = localPathName(id);
			if (!file.includes(":")) {
				debug(`change watch: ${file}`);
			}
		},
		buildStart() {
			debug("[status build] start build");
		},
		buildEnd(err) {
			if (err) {
				debug(`[status error] build failure: ${err.message}`);
			} else {
				debug("[status build] end build");
			}
		},
		generateBundle() {
			progress.total = progress.loaded;
			progress.loaded = 0;
		},
		transform(_code: string, id: string) {
			const file = localPathName(id);
			if (file.includes(":")) {
				return;
			}

			let output = "";

			if (progress.total > 0) {
				if (progress.total < progress.loaded) {
					progress.loaded = progress.total;
				}
				output += `[progress ${Math.round((100 * progress.loaded) / progress.total)}%] `;
				output += `${progress.loaded} / ${progress.total}: `;
			} else {
				output += `[status wait] ${progress.loaded}: `;
			}

			debug(output + file);
		},
	};
}
