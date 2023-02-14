import type { TypeOfFormatHandler, TypeOfValidateHandler, ValidatorType, FormatterType } from "@phragon/validator";

type ValidateBase<Dt extends {} = {}> = Dt & {
	strict?: boolean;
	required?: boolean;
	nullable?: boolean;
};

export type ValidateOptions<Dt extends {} = {}> = ValidateBase<Dt & { name: string; }>;

export type ValidateEntryType<E extends string = string> =
	| "string"
	| "number"
	| "boolean"
	| "file"
	| "array"
	| "object"
	| "credit-card"
	| "currency"
	| "date"
	| "email"
	| "imei"
	| "ip"
	| "ip-range"
	| "url"
	| "uuid"
	| E;

export interface ValidateEntry<Val = any> extends ValidateBase {
	type?: ValidateEntryType;
	defaultValue?: Val;
	arrayEntryType?: ValidateEntryType;
	arrayMin?: number;
	arrayMax?: number;
	formatter?: TypeOfFormatHandler<Val>;
	validator?: TypeOfValidateHandler<Val>;
	message?: string;
	title?: string;
	schema?: Record<string, ValidateEntryType | ValidateEntry>;
	detail?: any;
	validate?: ValidatorType | ValidatorType[];
	format?: FormatterType | FormatterType[];
}
