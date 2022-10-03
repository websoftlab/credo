import { TypeOfBoolean } from "./TypeOfBoolean";
import { TypeOfCreditCard } from "./TypeOfCreditCard";
import { TypeOfCurrency } from "./TypeOfCurrency";
import { TypeOfDate } from "./TypeOfDate";
import { TypeOfEmail } from "./TypeOfEmail";
import { TypeOfImei } from "./TypeOfImei";
import { TypeOfIp } from "./TypeOfIp";
import { TypeOfIpRange } from "./TypeOfIpRange";
import { TypeOfNumber } from "./TypeOfNumber";
import { TypeOfString } from "./TypeOfString";
import { TypeOfUrl } from "./TypeOfUrl";
import { TypeOfUuid } from "./TypeOfUuid";
import type { TypeOfValidator } from "../types";

const typeOf: Record<string, { new (): TypeOfValidator }> = {
	boolean: TypeOfBoolean,
	"credit-card": TypeOfCreditCard,
	currency: TypeOfCurrency,
	date: TypeOfDate,
	email: TypeOfEmail,
	imei: TypeOfImei,
	ip: TypeOfIp,
	"ip-range": TypeOfIpRange,
	number: TypeOfNumber,
	string: TypeOfString,
	url: TypeOfUrl,
	uuid: TypeOfUuid,
};

export function hasTypeOf(name: string) {
	return typeOf.hasOwnProperty(name);
}

export function defineTypeOf(name: string, type: { new (): TypeOfValidator }) {
	if (typeof type === "function") {
		typeOf[name] = type;
	}
}

export function createTypeOf(name: string): TypeOfValidator {
	if (!typeOf.hasOwnProperty(name)) {
		throw new Error(`The ${name} type is not defined`);
	}
	return new typeOf[name]();
}

export {
	TypeOfBoolean,
	TypeOfCreditCard,
	TypeOfCurrency,
	TypeOfDate,
	TypeOfEmail,
	TypeOfImei,
	TypeOfIp,
	TypeOfIpRange,
	TypeOfNumber,
	TypeOfString,
	TypeOfUrl,
	TypeOfUuid,
};

export type { ValidateTypeCreditCardDetail } from "./TypeOfCreditCard";
export type { ValidateTypeCurrencyDetail } from "./TypeOfCurrency";
export type { ValidateTypeDateDetail } from "./TypeOfDate";
export type { ValidateTypeEmailDetail } from "./TypeOfEmail";
export type { ValidateTypeImeiDetail } from "./TypeOfImei";
export type { ValidateTypeIpDetail } from "./TypeOfIp";
export type { ValidateTypeIpRangeDetail } from "./TypeOfIpRange";
export type { ValidateTypeNumberDetail } from "./TypeOfNumber";
export type { ValidateTypeStringDetail } from "./TypeOfString";
export type { ValidateTypeUrlDetail } from "./TypeOfUrl";
export type { ValidateTypeUuidDetail } from "./TypeOfUuid";
