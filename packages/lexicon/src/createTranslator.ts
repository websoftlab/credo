import translate from "./translate";
import { replace, plural } from "./replace";
import type { Lexicon } from "./types";

export default function createTranslator(store: Lexicon.LanguageStoreInterface): Lexicon.Translator {
	const translator: Lexicon.Translator = function translator(key: string | Lexicon.TranslateOptions): string {
		if (typeof key === "string") {
			key = { id: key };
		}

		let value = store.line(key.id);
		if (value == null) {
			if (typeof key.alternative === "function") {
				value = key.alternative(key.id);
			} else if (key.alternative) {
				value = key.alternative;
			} else {
				return key.id;
			}
		}

		return translate(store, String(value), key.replacement);
	};

	translator.language = () => {
		return store.language;
	};

	translator.line = <Val = string>(key: string) => {
		return store.line<Val>(key);
	};

	translator.replace = (text: string, replacement: any) => {
		return replace(store, text, replacement);
	};

	translator.plural = (value: number, variant: string | string[]) => {
		return plural(store, value, variant);
	};

	translator.lambda = <Val = string>(name: string, value: any, replacement?: any): Val => {
		const func = store.lambda[name] as Lexicon.LambdaTranslate<Val>;
		if (typeof func === "function") {
			return func(value, { name, translator, data: replacement });
		}
		return `() => [${name}]` as Val;
	};

	return translator;
}
