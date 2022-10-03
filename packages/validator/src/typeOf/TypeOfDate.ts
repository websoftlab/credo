import type { TypeOfValidatorOptions } from "../types";
import type { ValidateTypeStringDetail } from "./TypeOfString";
import validator from "validator";
import { TypeOfString } from "./TypeOfString";

export interface ValidateTypeDateDetail extends ValidateTypeStringDetail {
	/**
	 * @default false
	 */
	format?: string | undefined;
	/**
	 * If strictMode is set to true,
	 * the validator will reject inputs different from format.
	 *
	 * @default false
	 */
	strictMode?: boolean | undefined;
	/**
	 * `delimiters` is an array of allowed date delimiters
	 *
	 * @default ['/', '-']
	 */
	delimiters?: string[] | undefined;
}

export class TypeOfDate extends TypeOfString {
	validate(value: string | null, options: TypeOfValidatorOptions<ValidateTypeDateDetail>): boolean {
		options.clip = false;
		if (!super.validate(value, options)) {
			return false;
		}
		if (value === null) {
			return true;
		}
		return validator.isDate(value, {
			format: options.format,
			strictMode: options.strictMode,
			delimiters: options.delimiters,
		});
	}
}
