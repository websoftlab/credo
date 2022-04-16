import plurals from "./plurals";
import type {Lexicon} from "./types";

const regVars   = /{(.+?)}/g;
const regSpace  = /\s+/;
const regLambda = /^%(.+?) *=> *(.+?)$/;
const regPlural = /^%(.+?) +(["'`])(.+?)\2/;
const regNumber = /(?<=^| )%number(?= |$)/;

function replaceText(key: string, replacement: any) {
	if(replacement[key] == null) {
		return "";
	}
	const value = replacement[key];
	if(typeof value === "boolean") {
		return value ? "0" : "1";
	}
	return String(value);
}

export function plural(store: Lexicon.LanguageStoreInterface, value: number, variant: string | string[]) {
	if(typeof variant === "string") {
		variant = variant.split('||');
	}

	if(isNaN(value) || !isFinite(value)) {
		value = 0;
	}

	const select = (plurals[store.language] || plurals.en)(value);
	return String(variant[select] || "")
		.trim()
		.replace(regNumber, String(value));
}

export function lambda(store: Lexicon.LanguageStoreInterface, lambda: string, key: string, replacement: any): string {
	const func = store.lambda[lambda];
	if(typeof func === "function") {
		return func(replacement[key], {
			name: lambda,
			key,
			translator: store.translator,
			data: replacement,
		});
	}
	return `() => [${lambda}]`;
}

// This is {value} replace {text}
// This is {value} replace {%total_value key_plural_variants}
// This is {value} replace {%total_value "plural_variant_1 || plural_variant_2 || plural_variant_3"}
// This is {value} replace {%total_value => plural_function}

const recursive = (store: Lexicon.LanguageStoreInterface, text: string, replacement: any, depth: number = 0): string => {
	if(depth > 1) {
		return text;
	}

	return text.replace(regVars, (_: string, val: string) => {
		const all = val.trim();
		if(all.charAt(0) !== "%") {
			return replaceText(all, replacement);
		}

		// plural lambda
		const match1 = all.match(regLambda);
		if(match1) {
			return lambda(store, match1[2], match1[1], replacement);
		}

		// plural variants
		const match2 = all.match(regPlural);
		if(match2) {
			return plural(store, parseInt(replacement[match2[1]] as string), match2[3]);
		}

		const [a, b] = all.split(regSpace, 2);
		const value = parseInt(replacement[a] as string);
		const variant = store.translate(b);
		if(variant == null) {
			return String(value);
		}

		const text = plural(store, value, variant);
		return recursive(store, text, replacement, depth + 1);
	});
};

export function replace(store: Lexicon.LanguageStoreInterface, text: string, replacement: any) {
	return recursive(store, text, replacement);
}