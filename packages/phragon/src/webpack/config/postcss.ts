import type { BuildConfigure } from "../../types";

export default async function postcss(config: BuildConfigure) {
	const plugins: string[] = ["postcss-modules-values", "autoprefixer"];
	if (config.isProd) {
		plugins.push("cssnano");
	}
	return config.fireOnOptionsHook("config.postcss", {
		plugins,
	});
}
