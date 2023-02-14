import type { Context } from "koa";

export interface CtxQueryPageSchema<Key = string> {
	name: Key;
	type?: "string" | "number";
	nullable?: boolean;
	variant?: string[];
	defaultValue?: string | number;
	asArray?: boolean;
	isArray?: boolean;

	// for string
	trim?: boolean;
	lower?: boolean;
	upper?: boolean;

	// for numbers
	min?: number;
	max?: number;
}

function getString(value: string, opts: Partial<CtxQueryPageSchema>) {
	value = String(value);
	if (opts.trim) {
		value = value.trim();
	}
	if (opts.lower) {
		value = value.toLowerCase();
	} else if (opts.upper) {
		value = value.toUpperCase();
	}
	return value;
}

function getNumber(value: number | string, opts: Partial<CtxQueryPageSchema>) {
	if (typeof value !== "number") {
		value = parseInt(String(value));
		if (isNaN(value) || !isFinite(value)) {
			return undefined;
		}
	}
	const { min, max } = opts;
	if (typeof min === "number" && value < min) {
		return min;
	}
	if (typeof max === "number" && value > max) {
		return max;
	}
	return value;
}

function getTypeOf(value: any, type: string, opts: Partial<CtxQueryPageSchema>) {
	const { variant } = opts;
	if (value == null) {
		value = opts.nullable ? null : undefined;
	} else if (type === "string") {
		value = getString(value, opts);
	} else if (type === "number") {
		value = getNumber(value, opts);
	}
	if (Array.isArray(variant)) {
		return variant.includes(value) ? value : variant[0];
	}
	return value;
}

const defaultProp: Record<string, Omit<CtxQueryPageSchema, "name">> = {
	page: {
		type: "number",
		defaultValue: 1,
		min: 1,
	},
};

function isKey<Result extends {}>(schema: any): schema is keyof Result {
	const tof = typeof schema;
	return tof === "string" || tof === "number" || tof === "symbol";
}

function getQuery<Result extends {}>(query: any, schema: keyof Result | CtxQueryPageSchema<keyof Result>) {
	if (isKey(schema)) {
		schema = {
			...defaultProp[schema],
			name: schema,
		};
	}

	const {
		name,
		type = "string",
		isArray = false,
		asArray = false,
		defaultValue,
		...rest
	} = schema as CtxQueryPageSchema<keyof Result>;

	let fill = false;
	let value: any = null;
	let array = isArray;
	let val = query[name];

	if (val == null && defaultValue != null) {
		value = defaultValue;
	}

	if (isArray && !Array.isArray(val)) {
		val = val == null ? [] : [val];
	} else if (Array.isArray(val)) {
		if (asArray) {
			array = true;
		} else {
			val = val[0];
		}
	}

	if (array) {
		value = [];
		rest.nullable = false;
		(val as any[]).forEach((item) => {
			item = getTypeOf(item, type, rest);
			if (item != null && !value.includes(item)) {
				value.push(item);
			}
		});
		fill = value.length > 0 || isArray;
	} else {
		value = getTypeOf(val, type, rest);
		if (value !== undefined) {
			fill = true;
		} else if (defaultValue != null) {
			value = defaultValue;
			fill = true;
		}
	}

	return {
		name,
		value,
		fill,
	};
}

export default function ctxQueryPage<Result extends {} = any>(
	ctx: Context,
	schema: (CtxQueryPageSchema<keyof Result> | keyof Result)[] = []
) {
	const q = ctx.query || {};
	if (!Array.isArray(schema)) {
		return {};
	}
	const result: any = {};
	for (const item of schema) {
		const { name, value, fill } = getQuery(q, item);
		if (fill) {
			result[name] = value;
		}
	}
	return result;
}
