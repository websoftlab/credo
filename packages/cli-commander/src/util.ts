import { newError } from "@credo-js/cli-color";
import { opts } from "./constants";

export function isOptionName(name: string) {
	return /^--?[a-z][\w\-]*$/i.test(name);
}

export function assertOptionName(name: string) {
	if (!isOptionName(name)) {
		throw newError(opts.invalidName, name);
	}
}

export function getOptions<Option extends object>(
	options: undefined | null | string | Option,
	key: keyof Option
): Option {
	if (!options) {
		return {} as Option;
	}
	if (typeof options === "string") {
		return { [key]: options } as Option;
	}
	return options;
}

export function getAltNames(name: string, alt: string | string[] = []) {
	const result: string[] = [];

	if (!Array.isArray(alt)) {
		alt = alt ? [alt] : [];
	}

	for (let altName of alt) {
		altName = String(altName || "").trim();
		if (altName.length > 0 && altName !== name && !result.includes(altName)) {
			assertOptionName(altName);
			result.push(altName);
		}
	}

	return result;
}
