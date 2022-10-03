import type { TypeOfValidatorOptions } from "../types";
import type { ValidateTypeStringDetail } from "./TypeOfString";
import validator from "validator";
import { TypeOfString } from "./TypeOfString";

type IPVersion = "4" | "6" | 4 | 6;

export interface ValidateTypeIpRangeDetail extends ValidateTypeStringDetail {
	version?: IPVersion;
}

export class TypeOfIpRange extends TypeOfString {
	validate(value: string | null, options: TypeOfValidatorOptions<ValidateTypeIpRangeDetail>): boolean {
		options.clip = false;
		if (!super.validate(value, options)) {
			return false;
		}
		if (value === null) {
			return true;
		}
		return validator.isIPRange(value, options.version);
	}
}
