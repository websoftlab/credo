import type { BuildConfigure } from "../../types";
import webpack from "webpack";
import { debugBuild } from "../../debug";

const ProgressPlugin = webpack.ProgressPlugin;

export default function (conf: BuildConfigure) {
	let wait = true;
	function debug(text: string) {
		if (conf.debug) {
			conf.debug(text);
		} else {
			debugBuild(text);
		}
	}

	return new ProgressPlugin((percentage: number, msg: string, ...args: string[]) => {
		let text = "";

		if (percentage < 1) {
			// set status
			if (wait) {
				wait = false;
				debug("[status wait]");
			}

			let [current, active, modulePath] = args;
			text += `[progress ${(percentage * 100).toFixed(0)}%] ${msg}`;
			if (current) {
				text += ` ${current}`;
			}
			if (active) {
				text += ` ${active}`;
			}
			if (modulePath) {
				text += ` …${modulePath.substring(modulePath.length - 30)}`;
			}
		} else if (percentage === 1) {
			text += `[status complete] Webpack complete.`;
			wait = true;
		} else if (msg) {
			text += msg;
		} else {
			return;
		}

		debug(text);
	});
}
