import translate from "./translate";
import { replace, plural } from "./replace";
import type { Lexicon } from "./types";

export default function createTranslator(store: Lexicon.LanguageStoreInterface): Lexicon.Translator {
	const translator: Lexicon.Translator = function translator(key: string | Lexicon.TranslateOptions): string {
		if (typeof key === "string") {
			key = { id: key };
		}

		const value = store.translate(key.id, key.alternative);
		if (value === key.id) {
			return value;
		}

		return translate(store, value, key.replacement);
	};

	translator.replace = (text: string, replacement: any) => {
		return replace(store, text, replacement);
	};

	translator.plural = (value: number, variant: string | string[]) => {
		return plural(store, value, variant);
	};

	translator.lambda = (name: string, value: any, replacement?: any) => {
		const func = store.lambda[name];
		if (typeof func === "function") {
			return func(value, { name, translator, data: replacement });
		}
		return `() => [${name}]`;
	};

	return translator;
}
