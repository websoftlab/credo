import {watch} from "rollup";
import configure from "./configure";
import type {BuildConfigure} from "../types";
import type {CredoPlugin} from "../types";

function onDefineOptionNoSSR(event: {name: string, option: any}, conf: BuildConfigure) {
	if(event.name === "config.define" && conf.type === "server") {
		event.option.__SSR__ = false;
	}
}

export default async function createWatch(opts: {
	ssr: boolean,
	progressLine: boolean,
	debug?: (text: string, error?: boolean) => void,
	factory: CredoPlugin.Factory,
	cluster?: CredoPlugin.RootClusterOptions,
}) {
	const {ssr, factory, ... rest} = opts;
	if(!ssr) {
		factory.on("onOptions", onDefineOptionNoSSR);
	}

	const config = await configure({
		mode: "development",
		type: "server",
		factory: factory,
		... rest
	});

	return watch({
		... config,
		watch: {
			// todo add watch options
		}
	});
}
