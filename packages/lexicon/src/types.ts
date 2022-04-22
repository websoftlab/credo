export namespace Lexicon {
	export interface TranslateOptions {
		id: string;
		alternative?: string;
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

		translate(key: string, alternative?: string | ((key: string) => string)): string;
		reloadLanguage(id: string): Generator;
		loadLanguage(id: string, packageName?: string): Generator;
	}

	export interface Translator {
		(key: string | TranslateOptions): string;
		replace(text: string, replacement: any): string;
		plural(value: number, variant: string | string[]): string;
		lambda(name: string, value: any, replacement?: any): string;
	}

	export type LambdaTranslate = (
		value: any,
		options: { name: string; translator: Translator; key?: string; data?: any }
	) => string;

	export interface Data {
		id: string;
		lexicon: any;
		lambda: Record<string, LambdaTranslate>;
		packages: string[];
	}

	export type Listener = (data: Data & { packageName: string | null }) => Promise<void> | void;
}
