export type Formatter = "int" | "float" | "boolean" | "port" | "time-interval";
export type FormatType = ((value: string, index: number) => any) | Formatter | (Formatter | RegExp)[] | RegExp;
export type ValType<T> = {
	name: string;
	value: T;
};

export interface MinOptionInterface {
	name: string;
	alt: string[];

	add(value: string): void;
	define(): void;
	val<T = any>(): null | ValType<T>;
}

export interface Property {
	name?: string;
	description?: string;
	required?: boolean;
	min?: number;
	max?: number;
	set?: string[];
	format?: FormatType;
	unique?: boolean;
	message?: string;
}

export interface ArgumentOptions extends Property {
	multiple?: boolean;
}

export type OptionType = "flag" | "value" | "multiple";

export interface OptionOptions extends Property {
	keyName?: string;
	type?: OptionType | OptionType[];
	hidden?: boolean;
	alt?: string | string[];
}

export interface ErrorOptionOptions {
	message?: string;
	alt?: string | string[];
	throwable?: boolean;
	stream?: NodeJS.WriteStream;
}

interface ComOptions {
	version?: string;
	description?: string;
	stream?: NodeJS.WriteStream;
}

export interface CommandOptions extends ComOptions {
	strict?: boolean;
	notation?: boolean | string;
}

export interface CommanderOptions extends ComOptions {
	prompt?: string;
}

export type ConstantType = "commands" | "opts" | "args" | "formats" | "titles";

export interface Constant {
	(type: ConstantType, name: string, value: string): void;
	(type: ConstantType, data: Record<string, string>): void;
	(data: Record<ConstantType, Record<string, string>>): void;
}
