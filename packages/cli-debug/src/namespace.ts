
let prefix = "app:";

const listeners: Array<(newNs: string, oldNs: string, create: (name: string) => string) => void> = [];

export function getPrefix() {
	return prefix;
}

export function setPrefix(name: string) {
	if(prefix === name) {
		return;
	}
	const prevPrefix = prefix;
	prefix = name;
	for(const listener of listeners) {
		listener(prefix, prevPrefix, getNamespace);
	}
}

export function getNamespace(namespace: string) {
	if(!namespace.startsWith(prefix)) {
		namespace = `${prefix}${namespace}`;
	}
	return namespace;
}

export function onRename(handler: (newNs: string, oldNs: string, create: (name: string) => string) => void) {
	if(!listeners.includes(handler)) {
		listeners.push(handler);
	}
}