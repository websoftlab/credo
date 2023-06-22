import type { BuildConfigure } from "phragon";

export async function postcssConfig(config: BuildConfigure, options?: unknown, modules?: boolean) {
	const plugins: string[] = [];
	if (modules) {
		plugins.push("postcss-modules-values");
	}
	plugins.push("autoprefixer");
	if (config.isProd) {
		plugins.push("cssnano");
	}
	const rest: any = {};
	if (options != null && typeof options === "object") {
		if ("plugins" in options && Array.isArray(options.plugins)) {
			for (const plugin of options.plugins) {
				if (typeof plugin === "string" && !plugins.includes(plugin)) {
					plugins.push(plugin);
				}
			}
		}
		for (const key of Object.keys(options)) {
			if (key !== "plugins") {
				rest[key] = options[key as never];
			}
		}
	}
	return config.fireOnOptionsHook("config.postcss", {
		...rest,
		plugins,
	});
}
