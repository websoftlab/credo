import type { TypeOfValidatorOptions } from "../types";
import type { ValidateTypeStringDetail } from "./TypeOfString";
import validator from "validator";
import { TypeOfString } from "./TypeOfString";

type UUIDVersion = 3 | 4 | 5 | "3" | "4" | "5" | "all";

export interface ValidateTypeUuidDetail extends ValidateTypeStringDetail {
	version?: UUIDVersion;
}

export class TypeOfUuid extends TypeOfString {
	validate(value: string | null, options: TypeOfValidatorOptions<ValidateTypeUuidDetail>): boolean {
		options.clip = false;
		if (!super.validate(value, options)) {
			return false;
		}
		if (value === null) {
			return true;
		}
		return validator.isUUID(value, options.version);
	}
}
