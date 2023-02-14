import { isPlainObject } from "@phragon/utils";

const definers: Record<DefineType, { [key: string]: Function }> = {
	type: {},
	getter: {},
	setter: {},
	observer: {},
};

const dbType: string[] = [
	"STRING",
	"TEXT",
	"TINYTEXT",
	"BOOLEAN",
	"INTEGER",
	"BIGINT",
	"FLOAT",
	"DOUBLE",
	"DECIMAL",
	"DATE",
	"DATETIME",
	"DATEONLY",
	"UUID",
	"UUIDV1",
	"UUIDV4",
	"ENUM",
	"CITEXT",
	"TSVECTOR",
	"REAL",
	"RANGE",
	"CIDR",
	"INET",
	"MACADDR",
	"ARRAY",
	"BLOB",
	"TINYBLOB",
	"MEDIUMBLOB",
	"LONGBLOB",
	"JSON",
	"JSONB",
	"GEOMETRY",
	"POINT",
	"POLYGON",
	"LINESTRING",
	"GEOGRAPHY",
	"HSTORE",
];

export type DefineType = "type" | "getter" | "setter" | "observer";

function getName(type: DefineType, name: string) {
	name = name.trim();
	if (type === "type") {
		name = name.toUpperCase();
	}
	return name;
}

export function hasDynamicType(type: DefineType, name: string) {
	const typeOf = definers[type];
	if (!typeOf) {
		throw new Error(`Invalid define type - ${type}`);
	}
	name = getName(type, name);
	return typeOf.hasOwnProperty(name);
}

export function getDynamicType(type: DefineType, name: string) {
	const typeOf = definers[type];
	if (!typeOf) {
		throw new Error(`Invalid define type - ${type}`);
	}
	name = getName(type, name);
	if (!typeOf.hasOwnProperty(name)) {
		throw new Error(`The type ${name} for ${type} is not defined`);
	}
	return typeOf[name];
}

export function defineDynamicType(type: DefineType, name: string, callback: Function) {
	const typeOf = definers[type];
	if (!typeOf) {
		throw new Error(`Invalid define type - ${type}`);
	}
	name = getName(type, name);
	if (typeOf.hasOwnProperty(name) || (type === "type" && dbType.includes(name))) {
		if (typeOf[name] === callback) {
			return;
		}
		throw new Error(`The type ${name} for ${type} is already defined`);
	}
	if (typeof callback !== "function") {
		throw new Error(`Define callback is not function`);
	}
	typeOf[name] = callback;
}

export type DefineTypeObjectType<T extends {} = {}> = { name: string; options: T };
export type DefineTypeType<T extends {} = {}> = string | DefineTypeObjectType<T>;

export function createValidateDynamicObjectTypes(type: DefineType, name?: DefineTypeType | DefineTypeType[]) {
	if (!Array.isArray(name)) {
		name = typeof name === "string" || (name && isPlainObject(name) && typeof name.name) ? [name] : [];
	}
	if (name.length === 0) {
		return [];
	}
	return name.map((n) => {
		const object: DefineTypeObjectType = typeof n === "string" ? { name: n, options: {} } : n;
		if (!hasDynamicType(type, object.name)) {
			throw new Error(`The type ${object.name} for ${type} is not defined`);
		}
		return object;
	});
}

export function createDynamicTypeHandler(type: DefineType, object: DefineTypeObjectType) {
	const { name, options } = object;
	const callback = getDynamicType(type, name);
	return function <T>(target: T, ...args: any[]) {
		if (options) {
			args.push(options);
		}
		return callback.apply(target, args);
	};
}
