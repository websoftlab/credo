import type { TypeOfValidatorOptions, TypeOfValidator } from "../types";
import ValidateError from "../ValidateError";

export interface ValidateTypeStringDetail {
	minLength?: number;
	maxLength?: number;
	length?: number;
	clip?: boolean;
	trim?: boolean;
	lower?: boolean;
	upper?: boolean;
	locales?: string | string[];
}

export class TypeOfString implements TypeOfValidator<string | null, ValidateTypeStringDetail> {
	format(value: any, options: TypeOfValidatorOptions<ValidateTypeStringDetail>): string | null {
		const { name, strict, nullable, clip, length, trim, lower, upper, locales, maxLength } = options;
		if (typeof value === "string" && trim) {
			value = value.trim();
		}
		if ((value == null || value === "") && nullable) {
			return null;
		}
		if (typeof value !== "string") {
			if (strict) {
				throw new ValidateError("Invalid value", name);
			}
			value = value == null ? "" : String(value);
		}
		if (lower) {
			value = locales ? value.toLocaleLowerCase(locales) : value.toLowerCase();
		} else if (upper) {
			value = locales ? value.toLocaleUpperCase(locales) : value.toUpperCase();
		}
		if (clip) {
			if (typeof length === "number" && value.length > length) {
				value = (value as string).substring(0, length);
			} else if (typeof maxLength === "number" && value.length > maxLength) {
				value = (value as string).substring(0, maxLength);
			} else {
				return value;
			}
			if (trim) {
				return value.trimEnd();
			}
		}
		return value;
	}
	validate(value: string | null, options: TypeOfValidatorOptions<ValidateTypeStringDetail>): boolean {
		const { name, nullable, length, minLength, maxLength } = options;
		if (typeof value !== "string") {
			return value === null && Boolean(nullable);
		}
		if (typeof length === "number" && value.length !== length) {
			throw new ValidateError("String length does not match", name, "invalidLength");
		}
		if (typeof minLength === "number" && value.length < minLength) {
			throw new ValidateError("String is too short", name, "invalidMinLength");
		}
		if (typeof maxLength === "number" && value.length > maxLength) {
			throw new ValidateError("String is too long", name, "invalidMaxLength");
		}
		return true;
	}
}
