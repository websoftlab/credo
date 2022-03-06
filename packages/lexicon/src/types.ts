
export namespace Lexicon {

	export interface TranslateOptions {
		id: string;
		alternative?: string;
		replacement?: any;
	}

	export interface Translator {
		(key: string | TranslateOptions): string;
		replace(text: string, replacement: any): string;
		plural(value: number, variant: string | string[]): string;
		lambda(name: string, value: any, replacement?: any): string;
	}

	export type LambdaTranslate = (value: any, options: {name: string, translator: Translator, key?: string, data?: any}) => string;

	export interface Data {
		id: string;
		lexicon: any;
		lambda: Record<string, LambdaTranslate>;
		packages: string[];
	}

	export type Listener = (data: Data & {packageName: string | null}) => (Promise<void> | void);

	export interface StoreCtor {
		new (state?: any, data?: Lexicon.Data): StoreInterface;
	}

	export interface StoreInterface<State = any> {

		readonly state: State;
		readonly language: string;
		readonly lexicon: any;
		readonly lambda: Record<string, Lexicon.LambdaTranslate>;
		readonly packages: string[];
		readonly translator: Lexicon.Translator;

		update(state: any): void;
		translate(key: string, alternative?: string): string;
		reloadLanguage(id: string): Generator;
		loadLanguage(id: string, packageName?: string): Generator;
	}
}