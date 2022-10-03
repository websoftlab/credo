import type { TypeOfValidatorOptions, TypeOfValidator } from "../types";
import ValidateError from "../ValidateError";

export class TypeOfBoolean implements TypeOfValidator<boolean | null> {
	validate(value: boolean | null, options: TypeOfValidatorOptions): boolean {
		return typeof value === "boolean" || (options.nullable ? value === null : false);
	}
	format(value: any, options: TypeOfValidatorOptions): boolean | null {
		const { name, strict, nullable, required } = options;
		if (value == null && nullable) {
			return null;
		}
		if (typeof value === "boolean") {
			return value;
		}
		if (strict) {
			throw new ValidateError("", name);
		}
		if (typeof value === "string") {
			return ["on", "yes", "true", "1"].includes(value.trim().toLowerCase());
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
