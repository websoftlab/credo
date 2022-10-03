import type { BuildConfigure } from "../../types";
import webpack from "webpack";
import { debug } from "../../debug";

const ProgressPlugin = webpack.ProgressPlugin;

export default function (conf: BuildConfigure) {
	const waiter = debug.wait(conf.type === "client" ? "web" : "web-ssr");
	return new ProgressPlugin((percentage: number, msg: string, ...args: string[]) => {
		if (percentage < 1) {
			let [current, active, modulePath] = args;
			let text = msg || "webpack";
			if (current) {
				text += ` ${current}`;
			}
			if (active) {
				text += ` ${active}`;
			}
			if (modulePath) {
				text += ` …${modulePath.substring(modulePath.length - 30)}`;
			}

			waiter.write(text);
			waiter.progress = percentage;
		} else if (percentage === 1) {
			if (waiter.opened) {
				waiter.end("End build");
			}
		} else if (msg) {
			debug(msg);
		}
	});
}
