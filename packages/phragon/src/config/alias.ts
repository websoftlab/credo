import type { BuildConfigure } from "../types";
import { alias as aliasStoreBuilder } from "../builder/configure";

export default async function alias(config: BuildConfigure) {
	const aliasList = await aliasStoreBuilder(config.factory.builder.getStore());
	const aliases: Record<string, string> = {};
	aliasList.forEach(({ name, resolvePath }) => {
		aliases[name] = resolvePath;
	});
	return config.fireOnOptionsHook("config.alias", aliases);
}
