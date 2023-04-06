import type { TypeOfValidatorOptions, TypeOfValidator } from "../types";
import ValidateError from "../ValidateError";
import { isNullValue } from "./util";

export interface ValidateTypeNumberDetail {
	min?: number;
	max?: number;
	clip?: boolean;
	isNull?: (value: any) => boolean;
}

export class TypeOfNumber implements TypeOfValidator<number | null, ValidateTypeNumberDetail> {
	format(value: any, options: TypeOfValidatorOptions<ValidateTypeNumberDetail>): number | null {
		const { name, strict, nullable, min, max, clip, isNull } = options;
		if (isNullValue(value, isNull) && nullable) {
			return null;
		}
		if (typeof value !== "number") {
			if (strict) {
				throw new ValidateError("", name);
			}
			if (typeof value === "string") {
				value = value.includes(".") ? parseFloat(value) : parseInt(value);
				if (isNaN(value) || !isFinite(value)) {
					throw new ValidateError("", name);
				}
			}
		}
		if (clip) {
			if (typeof min === "number" && value < min) {
				value = min;
			} else if (typeof max === "number" && value > max) {
				value = max;
			}
		}
		return value;
	}

	validate(value: number | null, options: TypeOfValidatorOptions<ValidateTypeNumberDetail>): boolean {
		const { name, min, max, nullable } = options;
		if (typeof value !== "number") {
			return value === null && Boolean(nullable);
		}
		if (isNaN(value) || !isFinite(value)) {
			return false;
		}
		if (typeof min === "number" && value < min) {
			throw new ValidateError("", name, "invalidMinValue");
		}
		if (typeof max === "number" && value > max) {
			throw new ValidateError("", name, "invalidMaxValue");
		}
		return true;
	}
}
