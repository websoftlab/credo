import {onRename, getPrefix} from "./namespace";
import {escapeRegExp, renameKeysWithPrefix} from "./util";

const access: {
	origin: string,
	all: boolean,
	disable: boolean,
	hot: null | RegExp,
	not: null | RegExp,
	names: Record<string, boolean>,
} = {
	origin: "",
	all: false,
	disable: false,
	hot: null,
	not: null,
	names: {},
};

onRename((newPrefix: string, oldPrefix: string) => {
	renameKeysWithPrefix(access.names, newPrefix, oldPrefix);
	recalculate(access.origin);
});

function test(name: string) {
	if(access.disable || access.not && access.not.test(name)) {
		return false;
	} else {
		return access.all || Boolean(access.hot && access.hot.test(name));
	}
}

export function saveAccess(name: string) {
	access.names[name] = test(name);
}

export function isAccessible(name: string) {
	if(access.names.hasOwnProperty(name)) {
		return access.names[name];
	} else {
		return test(name);
	}
}

function recalculate(namespaces: string) {

	// reset
	access.origin = namespaces;
	access.all = false;
	access.disable = false;
	access.hot = null;
	access.not = null;

	const prefix = getPrefix();
	const split = namespaces.split(/[\s,]+/g);
	const hot: string[] = [];
	const not: string[] = [];

	for(let name of split) {
		name = name
			.trim()
			.replace(/[^a-z0-9 #%&:_\-*]+/gi, "")
			.replace(/\*{2,}/, "*");

		if (!name) {
			// ignore empty strings
			continue;
		}

		if(name === "*") {
			// all
			access.all = true;
			continue;
		}

		const n = name[0] === '-';
		if(n) {
			name = name.substring(1);
		}

		// only for prefix, ignore another prefix
		if(prefix.length > 0) {
			if(!name.startsWith(prefix)) {
				continue;
			}
			name = name.substring(prefix.length);
			if(name === "*") {
				if(n) {
					// disable all with prefix
					access.disable = true;
					return;
				}

				// all
				access.all = true;
				continue;
			}
			if(name.length === 0) {
				continue;
			}
		}

		name = name.replace(/\*/g, '.*?');
		if(n) {
			not.push(name);
		} else {
			hot.push(name);
		}
	}

	const pref = prefix.length ? escapeRegExp(prefix) : "";
	if(not.length) {
		access.not = new RegExp(`^${pref}(?:${not.join("|")})$`);
	}
	if(!access.all && hot.length) {
		access.hot = new RegExp(`^${pref}(?:${hot.join("|")})$`);
	}

	Object.keys(access.names).forEach(saveAccess);
}

export function reconfigure(namespaces: string) {
	if(namespaces !== access.origin) {
		recalculate(namespaces);
	}
}