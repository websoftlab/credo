import { localPathName } from "../../utils";
import { debug } from "../../debug";
import type { Plugin } from "rollup";
import type { BuildConfigure } from "../../types";

export default function progressRollupPlugin(_conf: BuildConfigure) {
	const waiter = debug.wait("serve");
	const stat = {
		total: 0,
		loaded: 0,
	};

	function send(message: string, progress: number | null = null, done: boolean = false) {
		if (done) {
			if (waiter.opened) {
				waiter.end(message || "End build");
			}
		} else {
			waiter.write(message);
			if (progress != null) {
				waiter.progress = progress;
			}
		}
	}

	return <Plugin>{
		name: "progress",
		load() {
			stat.loaded += 1;
		},
		watchChange(id) {
			const file = localPathName(id);
			if (!file.includes(":")) {
				send(`change watch: ${file}`);
			}
		},
		buildStart() {
			send("Start build", 0);
		},
		buildEnd(err) {
			send("End build", null, true);
			if (err) {
				debug.error(`[status error] build failure: ${err.message}`);
			}
		},
		generateBundle() {
			stat.total = stat.loaded;
			stat.loaded = 0;
		},
		transform(_code: string, id: string) {
			const file = localPathName(id);
			if (file.includes(":")) {
				return;
			}

			let progress = 0;
			let text: string;

			if (stat.total > 0) {
				text = `${stat.loaded} / ${stat.total}: ${file}`;
				if (stat.total < stat.loaded) {
					stat.loaded = stat.total;
				}
				progress = stat.loaded / stat.total;
			} else {
				text = `${stat.loaded}: ${file}`;
			}

			send(text, progress);
		},
	};
}
