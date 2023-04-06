export namespace Lexicon {
	export interface TranslateOptions {
		id: string;
		alternative?: string | ((key: string) => string);
		replacement?: any;
	}

	export interface LanguageStoreCtor {
		new (
			language?: string,
			lexicon?: any,
			lambda?: Record<string, LambdaTranslate>,
			packages?: string[]
		): LanguageStoreInterface;
	}

	export interface LanguageStoreInterface {
		readonly language: string;
		readonly lexicon: any;
		readonly lambda: Record<string, LambdaTranslate>;
		readonly packages: string[];
		readonly translator: Translator;

		line<Val = string>(key: string): Val | null;
		translate<Val = string>(key: string, alternative?: Val | ((key: string) => Val)): Val;
		reloadLanguage(id: string): Generator;
		loadLanguage(id: string, packageName?: string): Generator;
	}

	export interface Translator {
		(key: string | TranslateOptions): string;
		language(): string;
		line<Val = string>(key: string): Val | null;
		replace(text: string, replacement: any): string;
		plural(value: number, variant: string | string[]): string;
		lambda<Val = string>(name: string, value: any, replacement?: any): Val;
	}

	export type LambdaTranslate<Val = string> = (
		value: any,
		options: { name: string; translator: Translator; key?: string; data?: any }
	) => Val;

	export interface Data {
		id: string;
		lexicon: any;
		lambda: Record<string, LambdaTranslate>;
		packages: string[];
	}

	export type Listener = (data: Data & { packageName: string | null }) => Promise<void> | void;
}
