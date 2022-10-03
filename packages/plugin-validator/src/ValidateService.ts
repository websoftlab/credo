import type { Lexicon } from "@phragon/lexicon";
import type { ValidateEntry, ValidateEntryType, ValidateOptions } from "./types";
import type { TypeOfValidator } from "@phragon/validator";
import { asyncResult, isPlainObject } from "@phragon/utils";
import { hasTypeOf, createTypeOf, createFormatter, createValidator, ValidateError } from "@phragon/validator";
import ValidateDataError from "./ValidateDataError";

type Validator = Omit<ValidateEntry, "type"> & {
	name: string;
	type: ValidateEntryType;
};

export interface TranslatorHandler {
	(info: Lexicon.TranslateOptions): string;
}

export interface ValidateConfig<Data extends {} = any> {
	schema: Partial<Record<keyof Data, ValidateEntryType | ValidateEntry>>;
	body?: any;
	files?: Record<string, File>;
	translator?: TranslatorHandler;
}

const types: Record<string, TypeOfValidator> = {};

async function validOnce(
	body: any,
	files: Record<string, File>,
	entry: Validator,
	addError: (entry: Validator, field: string, err: any) => void,
	prefix?: string
): Promise<any> {
	const { type, arrayEntryType = "text", arrayMin, arrayMax, ...rest } = entry;
	const { name } = entry;
	const field = prefix ? `${prefix}.${name}` : name;

	if (type === "array") {
		let value = (arrayEntryType === "file" ? files : body)[name];
		if (!value) {
			if (entry.strict) {
				addError(entry, field, new ValidateError("", field));
				return [];
			}
			value = [];
		} else if (!Array.isArray(value)) {
			if (entry.strict) {
				addError(entry, field, new ValidateError("", field));
				return [];
			}
			value = [value];
		}

		const data: any[] = [];
		const innerEntry = { type: arrayEntryType, ...rest };

		for (let index = 0; index < value.length; index++) {
			const val = value[index];
			const prf = `${field}[${index}]`;
			try {
				const itm = await validOnce({ [name]: val }, files, innerEntry, addError, prf);
				if (itm != null) {
					data.push(itm);
				}
			} catch (err) {
				addError(innerEntry, prf, err);
			}
		}

		if (typeof arrayMin === "number" && data.length < arrayMin) {
			return addError(entry, field, new ValidateError("", field, "arrayMinLength"));
		}
		if (typeof arrayMax === "number" && data.length > arrayMax) {
			return addError(entry, field, new ValidateError("", field, "arrayMaxLength"));
		}

		return data;
	}

	if (type === "object") {
		const data: any = {};
		const list = createSchemaList(entry.schema || {});

		let innerBody = body[name];
		if (!isPlainObject(innerBody)) {
			if (isPlainObject(entry.defaultValue)) {
				innerBody = { ...entry.defaultValue };
			} else if (entry.strict) {
				addError(entry, field, new ValidateError("", field));
				return {};
			} else {
				innerBody = {};
			}
		}

		for (const innerEntry of list) {
			try {
				const val = await validOnce(innerBody, files, innerEntry, addError, field);
				if (val !== undefined) {
					data[innerEntry.name] = val;
				}
			} catch (err) {
				addError(entry, `${field}.${innerEntry.name}`, err);
			}
		}

		return data;
	}

	const { strict, nullable, required, defaultValue, validate, format, formatter, validator } = entry;
	const options: ValidateOptions = {
		...entry.detail,
		name,
		strict,
		required,
		nullable,
	};

	let value: any;
	if (arrayEntryType === "file") {
		value = files[name];
		if (!value) {
			if (required) {
				addError(entry, field, new ValidateError("", field, "valueIsRequired"));
			}
			return;
		}

		if (typeof validator === "function") {
			try {
				if (!(await asyncResult(validator(value, options)))) {
					return addError(entry, field, new ValidateError("", field));
				}
			} catch (err) {
				return addError(entry, field, err);
			}
		}

		return value;
	}

	let test: TypeOfValidator;
	if (types.hasOwnProperty(type)) {
		test = types[type];
	} else if (hasTypeOf(type)) {
		types[type] = createTypeOf(type);
		test = types[type];
	} else {
		return addError(entry, field, new ValidateError(`Invalid validation type - ${type}`, field));
	}

	value = body[name];
	if (value == null && defaultValue !== undefined) {
		value = isPlainObject(defaultValue) ? { ...defaultValue } : defaultValue;
	}

	try {
		if (format) {
			const frm = createFormatter(format);
			value = frm(value, field);
		}
		value = await asyncResult(test.format(value, options));
		if (typeof formatter === "function") {
			value = await asyncResult(formatter(value, options));
		}
		if (validate) {
			const vld = createValidator(validate);
			if (vld.required) {
				options.required = true;
			}
			const error = vld.callback(value, field);
			if (error != null) {
				return addError(entry, field, error);
			}
		}
		let valid = await asyncResult(test.validate(value, options));
		if (valid && typeof validator === "function") {
			valid = await asyncResult(validator(value, options));
		}
		if (!valid) {
			return addError(entry, field, new ValidateError("", field));
		}
	} catch (err) {
		return addError(entry, field, err);
	}

	return value;
}

function createSchemaList(schema: Record<string, ValidateEntryType | ValidateEntry>) {
	const keys = Object.keys(schema);
	const list: Validator[] = [];
	for (const key of keys) {
		let item = schema[key];
		if (typeof item === "string") {
			item = { type: item };
		}
		const entry: Validator = {
			name: key,
			type: "string",
			strict: false,
			nullable: false,
			required: false,
			...item,
		};
		if (entry.required) {
			entry.nullable = false;
		}
		list.push(entry);
	}
	return list;
}

function defaultTranslator(info: Lexicon.TranslateOptions) {
	const { id, alternative, replacement } = info;
	if (!alternative) {
		return id;
	}
	if (isPlainObject(replacement)) {
		return alternative.replace(/\{(.+?)}/g, (_, name) => {
			return replacement[name] == null ? "?" : replacement[name];
		});
	}
	return alternative;
}

export default class ValidateService {
	createError(message: string, field: string, errorCode: string = "invalidValue", errorDetail: any = {}) {
		return new ValidateError(message, field, errorCode, errorDetail);
	}

	isValidateError(error: any): error is ValidateError {
		return ValidateError.isValidateError(error);
	}

	createDataError(message: string, errors: Record<string, string | string[]>) {
		return new ValidateDataError(message, errors);
	}

	isValidateDataError(error: any): error is ValidateDataError {
		return ValidateDataError.isValidateDataError(error);
	}

	async validate<Data extends {} = any>(options: ValidateConfig<Data>): Promise<Data> {
		let fail = false;
		const { schema, body = {}, files = {}, translator = defaultTranslator } = options;

		const errors: Record<string, string[]> = {};
		const setError = (message: string, field: string) => {
			fail = true;
			if (errors.hasOwnProperty(field)) {
				errors[field].push(message);
			} else {
				errors[field] = [message];
			}
		};
		const addError = (entry: Validator, field: string, err: any) => {
			if (Array.isArray(err)) {
				for (let message of err) {
					message = String(message);
					setError(
						translator({
							id: `validate:message.${message}`,
							alternative: message,
							replacement: { name: entry.title || entry.name },
						}),
						field
					);
				}
				return;
			}

			let message: string;
			if (ValidateError.isValidateError(err)) {
				message = translator({
					id: `validate:error.${err.errorCode}`,
					alternative: err.message || "Invalid value",
					replacement: { name: entry.title || entry.name },
				});
			} else {
				message = typeof err === "string" ? err.trim() : err ? (err as Error).message : "";
				if (message) {
					message = translator({
						id: `validate:message.${message}`,
						alternative: message,
						replacement: { name: entry.title || entry.name },
					});
				} else {
					message = translator({
						id: "validate:error.invalidValue",
						alternative: "Invalid value",
					});
				}
			}

			setError(message, field);
		};

		const data = await validOnce(
			{ "": body },
			files,
			{ name: "", type: "object", schema: schema as Record<string, ValidateEntryType | ValidateEntry> },
			addError
		);

		if (fail) {
			throw this.createDataError("", errors);
		}

		return data;
	}
}
