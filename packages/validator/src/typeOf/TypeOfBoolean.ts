import type { TypeOfValidatorOptions, TypeOfValidator } from "../types";
import ValidateError from "../ValidateError";
import { isNullValue } from "./util";

export interface ValidateTypeBooleanDetail {
	isNull?: (value: any) => boolean;
	isTrue?: (value: string) => boolean;
}

export class TypeOfBoolean implements TypeOfValidator<boolean | null, ValidateTypeBooleanDetail> {
	validate(value: boolean | null, options: TypeOfValidatorOptions<ValidateTypeBooleanDetail>): boolean {
		return typeof value === "boolean" || (options.nullable ? value === null : false);
	}

	format(value: any, options: TypeOfValidatorOptions<ValidateTypeBooleanDetail>): boolean | null {
		const { name, strict, nullable, required, isNull, isTrue } = options;
		if (isNullValue(value, isNull) && nullable) {
			return null;
		}
		if (typeof value === "boolean") {
			return value;
		}
		if (strict) {
			throw new ValidateError("", name);
		}
		if (typeof value === "string") {
			return typeof isTrue === "function"
				? isTrue(value)
				: ["on", "yes", "true", "1"].includes(value.trim().toLowerCase());
		}
		if (typeof value === "number") {
			return value !== 0;
		}
		if (required) {
			throw new ValidateError("", name, "valueIsRequired");
		}
		return false;
	}
}
