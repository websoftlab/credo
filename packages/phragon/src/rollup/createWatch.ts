import { watch } from "rollup";
import configure from "./configure";
import type { BuildConfigure } from "../types";
import type { PhragonPlugin } from "../types";

function onDefineOptionNoSSR(event: { name: string; option: any; config: BuildConfigure }) {
	if (event.name === "config.define" && event.config.type === "server") {
		event.option.__SSR__ = false;
	}
}

export default async function createWatch(opts: {
	ssr: boolean;
	factory: PhragonPlugin.Factory;
	cluster?: PhragonPlugin.ClusterOptions;
}) {
	const { ssr, factory, ...rest } = opts;
	if (!ssr) {
		factory.on("onOptions", onDefineOptionNoSSR);
	}

	const config = await configure({
		mode: "development",
		type: "server",
		factory: factory,
		...rest,
	});

	return watch({
		...config,
		watch: {
			// todo add watch options
		},
	});
}
