import type { TypeOfValidatorOptions } from "../types";
import type { ValidateTypeStringDetail } from "./TypeOfString";
import validator from "validator";
import { TypeOfString } from "./TypeOfString";

export interface ValidateTypeCreditCardDetail extends ValidateTypeStringDetail {}

export class TypeOfCreditCard extends TypeOfString {
	validate(value: string | null, options: TypeOfValidatorOptions<ValidateTypeCreditCardDetail>): boolean {
		options.clip = false;
		if (!super.validate(value, options)) {
			return false;
		}
		if (value === null) {
			return true;
		}
		return validator.isCreditCard(value);
	}
}
