import type {BuildConfigure, BuildConfigureOptions, WebpackConfigure} from "../types";
import {merge} from "webpack-merge";
import base from './base';
import development from './development';
import production from './production';
import baseConfigure from "../configure";

async function configure(options: BuildConfigureOptions): Promise<WebpackConfigure> {
	const conf: BuildConfigure = await baseConfigure(options, "webpack");

	const config: WebpackConfigure =
		conf.isProd
			? merge(await base(conf), production(conf))
			: merge(await base(conf), development(conf));

	await conf.fireHook("onWebpackConfigure", config);

	return config;
}

export default configure;
