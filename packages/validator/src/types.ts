export type IdType = number | string;

export type Validator<Val = any, Option extends {} = {}> = (
	value: Val,
	name: IdType,
	option?: Option
) => null | undefined | string | string[];

export type ValidatorOptionType<Name extends string = string, Option extends {} = {}> = {
	name: Name;
	message?: string;
	option?: Option;
};

export type ValidatorType = Validator | ValidatorOptionType | string | { name: string; args?: any[]; message?: string };

export type Formatter<Val = any, Option extends {} = {}> = (
	value: Val,
	name: IdType,
	option?: Option
) => Val | undefined;

export type FormatterOptionType<Name extends string = string, Option extends {} = {}> = { name: Name; option?: Option };

export type FormatterType<Type extends string = string, Args extends {} = {}> =
	| Formatter
	| FormatterOptionType<Type, Args>
	| "trim"
	| "ltrim"
	| "rtrim"
	| "escape"
	| "unescape"
	| "lower"
	| "upper"
	| Type;

export type TypeOfFormatHandler<T = any, Dt = {}> = (value: any, options: TypeOfValidatorOptions<Dt>) => T | Promise<T>;

export type TypeOfValidateHandler<T = any, Dt = {}> = (
	value: T,
	options: TypeOfValidatorOptions<Dt>
) => boolean | Promise<boolean>;

export type TypeOfValidatorOptions<Dt = {}> = Dt & {
	name: string;
	strict?: boolean;
	required?: boolean;
	nullable?: boolean;
};

export interface TypeOfValidator<T = any, Dt = {}> {
	format: TypeOfFormatHandler<T, Dt>;
	validate: TypeOfValidateHandler<T, Dt>;
}
