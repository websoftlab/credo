export function renamePrefix(key: string, newPrefix: string, oldPrefix: string) {
	const len = oldPrefix.length;
	if (len === 0) {
		return newPrefix + key;
	} else if (key.startsWith(oldPrefix)) {
		return newPrefix + key.substring(len);
	} else {
		return key;
	}
}

export function renameKeysWithPrefix<T>(object: Record<string, T>, newPrefix: string, oldPrefix: string) {
	const keys = Object.keys(object);
	if (!keys.length) {
		return;
	}
	const len = oldPrefix.length;
	for (const key of keys) {
		const value = object[key];
		if (len === 0) {
			delete object[key];
			object[newPrefix + key] = value;
		} else if (key.startsWith(oldPrefix)) {
			delete object[key];
			object[newPrefix + key.substring(len)] = value;
		}
	}
}

export function escapeRegExp(chars: string) {
	return chars.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
