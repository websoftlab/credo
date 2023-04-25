import type { ValidatorType, ValidatorOptionType, Validator, IdType } from "./types";
import validator from "validator";

const validatorAlias: Record<string, string> = {
	"not-contains": "notContains",
	"not-equals": "notEquals",
	after: "isAfter",
	before: "isBefore",
	alpha: "isAlpha",
	alphanumeric: "isAlphanumeric",
	base32: "isBase32",
	base58: "isBase58",
	base64: "isBase64",
	bic: "isBIC",
	boolean: "isBoolean",
	"btc-address": "isBtcAddress",
	"byte-length": "isByteLength",
	"credit-card": "isCreditCard",
	currency: "isCurrency",
	"data-uri": "isDataURI",
	date: "isDate",
	decimal: "isDecimal",
	"divisible-by": "isDivisibleBy",
	divisible: "isDivisibleBy",
	ean: "isEAN",
	email: "isEmail",
	mail: "isEmail",
	empty: "isEmpty",
	required: "isNotEmpty",
	"not-empty": "isNotEmpty",
	"ethereum-address": "isEthereumAddress",
	float: "isFloat",
	fqdn: "isFQDN",
	"full-width": "isFullWidth",
	"not-full-width": "isNotFullWidth",
	"half-width": "isHalfWidth",
	"not-half-width": "isNotHalfWidth",
	hash: "isHash",
	hexadecimal: "isHexadecimal",
	"hex-color": "isHexColor",
	hsl: "isHSL",
	iban: "isIBAN",
	"identity-card": "isIdentityCard",
	imei: "isIMEI",
	in: "isIn",
	"not-in": "isNotIn",
	ip: "isIP",
	"ip-range": "isIPRange",
	isbn: "isISBN",
	isin: "isISIN",
	"iso-8601": "isISO8601",
	"iso-31661-alpha2": "isISO31661Alpha2",
	"iso-31661-alpha3": "isISO31661Alpha3",
	isrc: "isISRC",
	issn: "isISSN",
	json: "isJSON",
	jwt: "isJWT",
	"lat-long": "isLatLong",
	length: "isLength",
	"license-plate": "isLicensePlate",
	locale: "isLocale",
	lowercase: "isLowercase",
	lower: "isLowercase",
	"mac-address": "isMACAddress",
	"magnet-uri": "isMagnetURI",
	md5: "isMD5",
	"mime-type": "isMimeType",
	"mobile-phone": "isMobilePhone",
	mobile: "isMobilePhone",
	"mongo-id": "isMongoId",
	multibyte: "isMultibyte",
	numeric: "isNumeric",
	octal: "isOctal",
	"passport-number": "isPassportNumber",
	port: "isPort",
	"postal-code": "isPostalCode",
	rfc3339: "isRFC3339",
	"rgb-color": "isRgbColor",
	rgb: "isRgbColor",
	semver: "isSemVer",
	"surrogate-pair": "isSurrogatePair",
	"not-surrogate-pair": "isNotSurrogatePair",
	uppercase: "isUppercase",
	upper: "isUppercase",
	slug: "isSlug",
	"strong-password": "isStrongPassword",
	"tax-id": "isTaxID",
	url: "isURL",
	uuid: "isUUID",
	"variable-width": "isVariableWidth",
	"not-variable-width": "isNotVariableWidth",
	vat: "isVAT",
	whitelisted: "isWhitelisted",
	matches: "notMatches",
};

export const validatorErrors: Record<string, string> = {
	isAlpha: "Value contains more than just letters (a-zA-Z)",
	isAlphanumeric: "Value contains more than just letters and numbers (a-zA-Z0-9)",
	isBase32: "Is not Base32",
	isBase58: "Is not Base58",
	isBase64: "Is not Base64",
	isBIC: "Is not BIC",
	isBoolean: "Is not boolean",
	isBtcAddress: "Invalid BTC Address",
	isByteLength: "Invalid byte length",
	isCreditCard: "Is not Credit Card",
	isCurrency: "Invalid currency value",
	isDataURI: "Invalid URI Data",
	isDate: "Invalid date",
	isDecimal: "Is not decimal number",
	isDivisibleBy: "Invalid number",
	isEAN: "Is not EAN",
	isEmail: "Invalid email",
	isEmpty: "Is not empty",
	isNotEmpty: "Is required",
	isEthereumAddress: "Invalid Ethereum Address",
	isFloat: "Is not float number",
	isFQDN: "Is not FQDN",
	isHash: "Invalid hash",
	isHexadecimal: "Invalid hexadecimal number",
	isHexColor: "Invalid hexadecimal color",
	isHSL: "Invalid HSL color",
	isIBAN: "Is not IBAN",
	isIdentityCard: "Is not Identity Card",
	isIMEI: "Is not IMEI",
	isInt: "Is not integer value",
	isIP: "Invalid IP",
	isIPRange: "IP does not match",
	isISBN: "Is not ISBN",
	isISIN: "Is not ISIN",
	isISO8601: "Is not ISO8601",
	isISO31661Alpha2: "Is not ISO31661Alpha2",
	isISO31661Alpha3: "Is not ISO31661Alpha3",
	isISO4217: "Is not ISO4217",
	isISRC: "Is not ISRC",
	isISSN: "Is not ISSN",
	isJSON: "Is not JSON",
	isJWT: "Invalid JWT token",
	isLatLong: "Invalid latitude-longitude value",
	isLength: "Invalid string length (too small or too long)",
	isLicensePlate: "Is not License Plate",
	isLocale: "Invalid string locale",
	isLowercase: "Is not lowercase",
	isMACAddress: "Invalid MAC Address",
	isMagnetURI: "Invalid Magnet URI",
	isMD5: "Is not MD5 hash",
	isMimeType: "Invalid mime-type",
	isMobilePhone: "Invalid mobile phone",
	isMongoId: "Is not Mongo ID",
	isNumeric: "String contains more than just numbers",
	isOctal: "String contains more than just octal numbers",
	isPassportNumber: "Invalid Passport Number",
	isPort: "Invalid port",
	isPostalCode: "Invalid Postal Code",
	isRFC3339: "Is not RFC3339",
	isRgbColor: "Is not RGB color",
	isSemVer: "Version has an invalid format",
	isUppercase: "Is not in uppercase",
	isSlug: "Invalid slug",
	isStrongPassword: "Password is not strong",
	isTaxID: "Is not Tax ID",
	isURL: "Invalid URL",
	isUUID: "Invalid UUID",
	isVAT: "Invalid VAT",
};

const validatorDefined: Record<string, boolean | undefined> = Object.create(null);
const validators: Record<string, Function> = {
	isNotEmpty: (value: string, options?: validator.IsEmptyOptions) => !validator.isEmpty(value, options),
	isNotFullWidth: (value: string) => !validator.isFullWidth(value),
	isNotHalfWidth: (value: string) => !validator.isHalfWidth(value),
	isNotSurrogatePair: (value: string) => !validator.isSurrogatePair(value),
	isNotVariableWidth: (value: string) => !validator.isVariableWidth(value),
	isNotIn: (value: string, values: any[]) => !validator.isIn(value, values),
	notMatches: (value: string, pattern: RegExp) => !validator.matches(value, pattern),
	notContains: (value: string, seed: any) => !validator.contains(value, seed),
	notEquals: (value: string, comparison: any) => !validator.equals(value, comparison),
};

function isOptionType(valid: any): valid is ValidatorOptionType {
	let name = valid ? valid.name : null;
	if (!name) {
		return false;
	}
	if (validatorAlias.hasOwnProperty(name)) {
		name = validatorAlias[name];
	}
	if (!validatorDefined[name]) {
		return false;
	}
	return valid.option != null && typeof valid.option === "object";
}

function createValidOnce<Val = any>(valid: ValidatorType): { valid: Validator<Val>; required?: boolean } {
	if (typeof valid === "function") {
		return { valid };
	}

	// find name
	let name: string,
		args: any[] = [],
		option: any = null,
		defined = false,
		message: string = "";

	if (typeof valid === "string") {
		name = valid;
	} else if (valid && valid.name) {
		name = valid.name;
		if (isOptionType(valid)) {
			option = valid.option;
		} else if (Array.isArray(valid.args)) {
			args = valid.args;
		} else if (valid.args != null) {
			args.push(valid.args);
		}
		if (valid.message) {
			message = valid.message;
		}
	} else {
		return { valid: createInvalidArgumentsValidator("undefined") };
	}

	if (validatorAlias.hasOwnProperty(name)) {
		name = validatorAlias[name];
	}

	let func: Function;
	if (validators.hasOwnProperty(name)) {
		func = validators[name];
		defined = validatorDefined[name] === true;
	} else {
		func = validator[name as never];
	}

	if (typeof func !== "function") {
		return { valid: createInvalidArgumentsValidator(name) };
	}

	if (!message) {
		if (validatorErrors.hasOwnProperty(name)) {
			message = validatorErrors[name];
		} else {
			message = "Invalid value";
		}
	}

	switch (name) {
		case "isIn":
		case "isNotIn":
			if (!Array.isArray(args[0])) {
				args = [args];
			}
			break;
		case "matches":
		case "notMatches":
			if (!args[0]) {
				args[0] = "";
			}
			if (!(args[0] instanceof RegExp)) {
				args[0] = new RegExp(args[0], args[1]);
			}
			break;
	}

	if (option != null) {
		args = [option];
	} else if (defined && args.length > 0) {
		const copy = args.slice();
		args = [{}];
		copy.forEach((value, index) => {
			args[0][`arg${index}`] = value;
		});
	}

	return {
		required: name === "isNotEmpty",
		valid(value: Val, name) {
			if (defined) {
				const result = func(value, name, ...args);
				if (typeof result === "boolean") {
					return result ? null : message;
				}
				if (Array.isArray(result)) {
					return result.length === 0 ? null : result;
				}
				return typeof result === "string" ? result : null;
			}
			return func(value, ...args) ? null : message;
		},
	};
}

function validArray(error: string[]) {
	return error.length === 1 ? error[0] : error.length === 0 ? null : error;
}

function isEmpty(value: any) {
	return value == null || (typeof value === "string" && value === "") || (Array.isArray(value) && value.length === 0);
}

function isFalse() {
	return false;
}

export const createInvalidArgumentsValidator: (name: string) => Validator = (name) => {
	return function validInvalidArguments() {
		try {
			throw new Error(`Invalid arguments for "${name}" validator entry`);
		} catch (err) {
			return (err as Error).message;
		}
	};
};

export function defineValidator(name: string, callback: Function) {
	if (typeof callback === "function") {
		validators[name] = callback;
		validatorDefined[name] = true;
	}
}

export function createValidator<Val = any>(
	valid: ValidatorType | ValidatorType[]
): { required: boolean; callback: Validator<Val> } {
	if (!Array.isArray(valid)) {
		valid = valid ? [valid] : [];
	}

	let required = false;
	const all: Validator<Val>[] = [];

	valid.map((valid) => {
		const parse = createValidOnce(valid);
		if (parse.required) {
			required = true;
			all.unshift(parse.valid);
		} else {
			all.push(parse.valid);
		}
	});

	if (all.length === 0) {
		return {
			required,
			callback: () => null,
		};
	}

	const empty = required ? isFalse : isEmpty;

	if (all.length === 1) {
		const test = all[0];
		return {
			required,
			callback: (value: Val, name: IdType) => {
				if (empty(value)) {
					return null;
				}
				const error = test(value, name);
				return error == null ? null : Array.isArray(error) ? validArray(error) : error;
			},
		};
	}

	return {
		required,
		callback: (value: Val, name: IdType) => {
			if (empty(value)) {
				return null;
			}
			const errors: string[] = [];
			all.forEach((map) => {
				const error = map(value, name);
				if (Array.isArray(error)) {
					errors.push(...error);
				} else if (error != null) {
					errors.push(error);
				}
			});
			return validArray(errors);
		},
	};
}
