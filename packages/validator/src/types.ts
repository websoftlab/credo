export type IdType = number | string;

export type Validator<Val = any> = (value: Val, name: IdType) => null | undefined | string | string[];

export type ValidatorType = Validator | string | { name: string; args?: any[]; message?: string };

export type Formatter<Val = any> = (value: Val, name: IdType) => Val | undefined;

export type FormatterType = Formatter | "trim" | "ltrim" | "rtrim" | "escape" | "unescape" | "lower" | "upper";

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
