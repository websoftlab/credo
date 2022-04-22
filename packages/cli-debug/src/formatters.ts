import { getNamespace, onRename } from "./namespace";
import { renameKeysWithPrefix } from "./util";

const formatters: Record<string, { details: any; formatter: Function }> = {};

onRename((newPrefix: string, oldPrefix: string) => {
	renameKeysWithPrefix(formatters, newPrefix, oldPrefix);
});

export function getFormat(namespace: string) {
	return formatters.hasOwnProperty(namespace) ? formatters[namespace] : null;
}

export function setFormat<T = any, F = any, D = any>(namespace: string, formatter: (object: T) => F, details?: D) {
	namespace = getNamespace(namespace);
	if (formatters.hasOwnProperty(namespace)) {
		console.error(`Namespace formatter ${namespace} already defined, overwriting...`);
	}
	formatters[namespace] = {
		details,
		formatter,
	};
}
