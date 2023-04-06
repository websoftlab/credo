import createTranslator from "./createTranslator";
import { reload, load } from "./lexicon";
import type { Lexicon } from "./types";

export default class LanguageStore implements Lexicon.LanguageStoreInterface {
	readonly translator!: Lexicon.Translator;

	constructor(
		public language: string = "en",
		public lexicon: any = {},
		public lambda: Record<string, Lexicon.LambdaTranslate> = {},
		public packages: string[] = []
	) {
		const translator = createTranslator(this);
		Object.defineProperty(this, "translator", {
			configurable: false,
			get() {
				return translator;
			},
		});
	}

	line<Val = string>(key: string): Val | null {
		return this.lexicon.hasOwnProperty(key) ? this.lexicon[key] : null;
	}

	translate<Val = string>(key: string, alternative?: Val | ((key: string) => Val)): Val {
		if (this.lexicon.hasOwnProperty(key)) {
			return this.lexicon[key];
		}
		if (typeof alternative === "function") {
			return (alternative as Function)(key);
		}
		return alternative == null ? (key as Val) : alternative;
	}

	setLanguageData(data: Lexicon.Data) {
		const { id, lexicon, lambda, packages } = data;
		this.language = id;
		this.lexicon = lexicon;
		this.lambda = lambda;
		this.packages = packages;
	}

	*reloadLanguage(id: string) {
		return reload(id).then((data: Lexicon.Data) => {
			this.setLanguageData(data);
		});
	}

	*loadLanguage(id: string, packageName?: string) {
		return load(id, packageName).then((data: Lexicon.Data) => {
			this.setLanguageData(data);
		});
	}
}
