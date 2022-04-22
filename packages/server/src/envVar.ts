import type { Env, EnvVar } from "./types";

const base64Regex = /^([A-Za-z0-9+/]{4})*([A-Za-z0-9+/]{4}|[A-Za-z0-9+/]{3}=|[A-Za-z0-9+/]{2}==)$/;
const accessors: Record<string, (value: any, ...args: any[]) => any> = {
	toArray(value, delimiter = ",") {
		if (Array.isArray(value)) {
			return value;
		}
		if (value == null) {
			return [];
		} else if (typeof value === "string") {
			return value.length ? String(value).split(delimiter).filter(Boolean) : [];
		} else {
			return [value];
		}
	},
	toInt(value) {
		if (typeof value === "number") {
			if (isNaN(value)) {
				throw new Error("should be a valid float");
			}
			return value;
		}
		const n = parseInt(value, 10);
		if (isNaN(n) || n.toString(10) !== String(value)) {
			throw new Error("should be a valid integer");
		}
		return n;
	},
	toIntPositive(value) {
		const ret = accessors.toInt(value);
		if (ret < 0) {
			throw new Error("should be a positive integer");
		}
		return ret;
	},
	toIntNegative(value) {
		const ret = accessors.toInt(value);
		if (ret > 0) {
			throw new Error("should be a negative integer");
		}
		return ret;
	},
	toFloat(value) {
		if (typeof value === "number") {
			if (isNaN(value)) {
				throw new Error("should be a valid float");
			}
			return value;
		}
		const n = parseFloat(value);
		if (isNaN(n) || n.toString() !== String(value)) {
			throw new Error("should be a valid float");
		}
		return n;
	},
	toFloatPositive(value) {
		const ret = accessors.toFloat(value);
		if (ret < 0) {
			throw new Error("should be a positive float");
		}
		return ret;
	},
	toFloatNegative(value) {
		const ret = accessors.toFloat(value);
		if (ret > 0) {
			throw new Error("should be a negative float");
		}
		return ret;
	},
	toJson(value) {
		if (value != null && typeof value === "object") {
			return value;
		}
		try {
			return JSON.parse(value);
		} catch (e) {
			throw new Error("should be valid (parseable) JSON");
		}
	},
	toJsonArray(value) {
		value = accessors.toJson(value);
		if (!Array.isArray(value)) {
			throw new Error("should be a parseable JSON Array");
		}
		return value;
	},
	toJsonObject(value) {
		value = accessors.toJson(value);
		if (Array.isArray(value)) {
			throw new Error("should be a parseable JSON Object");
		}
		return value;
	},
	toBool(value) {
		if (typeof value === "boolean") {
			return value;
		}
		const val = String(value).toLowerCase();
		const allowedValues = ["false", "0", "true", "1"];
		if (allowedValues.indexOf(val) === -1) {
			throw new Error('should be either "true", "false", "TRUE", "FALSE", 1, or 0');
		}
		return !(val === "0" || val === "false");
	},
	toPortNumber(value) {
		value = accessors.toIntPositive(value);
		if (value > 65535) {
			throw new Error("cannot assign a port number greater than 65535");
		}
		return value;
	},
	toUrlObject(value) {
		if (value instanceof URL) {
			return value;
		}
		try {
			return new URL(String(value));
		} catch (e) {
			throw new Error("should be a valid URL");
		}
	},
	toUrlString(value) {
		return accessors.toUrlObject(value).toString();
	},
	toRegExp(value, flags) {
		// We have to test the value and flags indivudally if we want to write our
		// own error messages,as there is no way to differentiate between the two
		// errors except by using string comparisons.

		// Test the flags
		if (flags != null) {
			try {
				RegExp("", flags);
			} catch (err) {
				throw new Error("invalid regexp flags");
			}
		} else {
			flags = undefined;
		}

		try {
			return new RegExp(value, flags);
		} catch (err) {
			// We know that the regexp is the issue because we tested the flags earlier
			throw new Error("should be a valid RegExp");
		}
	},
};

function getEnv(value: any, keyName: string): EnvVar {
	let format = value;
	let defaultValue: any = undefined;
	let isRequired = false;
	let isBase64 = false;
	let isMap = false;

	const result = {
		get originValue() {
			return value;
		},
		get value() {
			let val = isNil() ? defaultValue : format;

			if (isRequired && (val == null || (typeof val === "string" && val.trim().length === 0))) {
				throw new Error(`is a required ENV variable (${keyName}), but its value was empty`);
			}

			if (isBase64) {
				if (typeof val !== "string" || !val.match(base64Regex)) {
					throw new Error(
						`should be a valid base64 string if using convertFromBase64 for the (${keyName}) ENV variable`
					);
				}
				val = Buffer.from(value, "base64").toString();
			}

			if (isMap) {
				isMap = false;
				if (!Array.isArray(val)) {
					val = accessors.toArray(val);
				}
			}

			return val;
		},
		default(value: any) {
			defaultValue = value;
			return result;
		},
		map() {
			isMap = true;
			return result;
		},
		required(required = true) {
			isRequired = Boolean(required);
			return result;
		},
		convertFromBase64() {
			isBase64 = true;
			return result;
		},
	};

	const isNil = () => {
		return format === undefined && defaultValue !== undefined;
	};

	const formatValue = (func: Function, args: any[]) => {
		if (isNil()) {
			format = defaultValue;
			defaultValue = undefined;
		}
		if (isMap) {
			isMap = false;
			if (!Array.isArray(format)) {
				format = accessors.toArray(format);
			}
			format = format.map((value: any) => func(value, ...args));
		} else {
			format = func(format, ...args);
		}
		return result;
	};

	Object.defineProperty(result, "toString", {
		enumerable: true,
		value() {
			return formatValue((value: any) => (typeof value === "string" ? value : String(value)), []);
		},
	});

	Object.keys(accessors).forEach((key) => {
		const func = accessors[key];
		Object.defineProperty(result, key, {
			enumerable: true,
			value(...args: any[]) {
				return formatValue(func, args);
			},
		});
	});

	return result as EnvVar;
}

export function registerEnvAccessor<T = any>(name: string, accessor: (value: string) => T) {
	if (typeof accessor === "function") {
		accessors[name] = accessor;
	}
}

export function createEnv(data = {}): Env {
	const saved: Record<string, EnvVar> = {};

	const get = (target: any, p: string) => {
		return getEnv(target[p] != null ? target[p] : process.env[p], p);
	};

	const setter = (target: any, result: any) => {
		return (p: string, value: any) => {
			target[p] = value;
			return result;
		};
	};

	const getter = (target: any) => {
		return (...args: string[]) => {
			for (let p of args) {
				if (target[p] != null) {
					return getEnv(target[p], p);
				}
				if (process.env[p] != null) {
					return getEnv(process.env[p], p);
				}
			}
			return get(target, args[0]);
		};
	};

	const proxy: Env = new Proxy<Env>(data as Env, {
		set(target, p: string, value: any, _receiver): boolean {
			target[p] = value;
			if (saved[p] && saved[p].originValue !== value) {
				delete saved[p];
			}
			return true;
		},
		get(target, p: string, _receiver) {
			if (p === "get") {
				return getter(target);
			}
			if (p === "set") {
				return setter(target, proxy);
			}
			if (p === "all") {
				return () => {
					return {
						...process.env,
						...target,
					};
				};
			}
			if (!saved[p]) {
				saved[p] = get(target, p as string);
			}
			return saved[p];
		},
	});

	return proxy;
}
