import type { TypeOfValidatorOptions } from "../types";
import type { ValidateTypeStringDetail } from "./TypeOfString";
import validator from "validator";
import { TypeOfString } from "./TypeOfString";

export interface ValidateTypeImeiDetail extends ValidateTypeStringDetail {
	allowHyphens?: boolean | undefined;
}

export class TypeOfImei extends TypeOfString {
	validate(value: string | null, options: TypeOfValidatorOptions<ValidateTypeImeiDetail>): boolean {
		options.clip = false;
		if (!super.validate(value, options)) {
			return false;
		}
		if (value === null) {
			return true;
		}
		// function is not declared
		// @ts-ignore
		return validator.isIMEI(value, {
			allow_hyphens: options.allowHyphens,
		});
	}
}
