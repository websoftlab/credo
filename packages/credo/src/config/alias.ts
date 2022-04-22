import type { BuildConfigure } from "../types";

export default async function alias(config: BuildConfigure) {
	return config.fireOnOptionsHook("config.alias", {});
}
