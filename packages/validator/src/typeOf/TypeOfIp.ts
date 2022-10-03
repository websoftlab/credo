import type { TypeOfValidatorOptions } from "../types";
import type { ValidateTypeStringDetail } from "./TypeOfString";
import validator from "validator";
import { TypeOfString } from "./TypeOfString";

type IPVersion = "4" | "6" | 4 | 6;

export interface ValidateTypeIpDetail extends ValidateTypeStringDetail {
	version?: IPVersion;
}

export class TypeOfIp extends TypeOfString {
	validate(value: string | null, options: TypeOfValidatorOptions<ValidateTypeIpDetail>): boolean {
		options.clip = false;
		if (!super.validate(value, options)) {
			return false;
		}
		if (value === null) {
			return true;
		}
		return validator.isIP(value, options.version);
	}
}
