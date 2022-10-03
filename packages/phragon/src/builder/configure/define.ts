import type { PhragonPlugin } from "../../types";
import type BuilderStore from "../BuilderStore";
import { debug } from "../../debug";
import { isList } from "./util";

const privateEnv = [
	"process.env.NODE_ENV",
	"__ENV__",
	"__SRV__",
	"__WEB__",
	"__SSR__",
	"__DEV__",
	"__DEV_SERVER__",
	"__PROD__",
	"__BUNDLE__",
	"__isSrv__()",
	"__isWeb__()",
	"__isDev__()",
	"__isProd__()",
	"__env__()",
];

type DefType = boolean | number | string | null | undefined;

export default function define(store: BuilderStore) {
	const list: PhragonPlugin.ConfigType<"name", string, { value: DefType }>[] | undefined = store.store.define;
	const def: Record<string, DefType> = {};
	if (!isList(list)) {
		return def;
	}

	for (const item of list) {
		let { name, value } = item;
		name = name.trim();
		if (privateEnv.includes(name)) {
			debug.error("The {yellow %s} env variable is private", name);
		} else if (value === undefined) {
			delete def[name];
		} else {
			def[name] = value;
		}
	}

	return def;
}
