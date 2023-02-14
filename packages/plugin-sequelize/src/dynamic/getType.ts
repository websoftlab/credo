import type { Sequelize } from "sequelize";
import type { ORM } from "../types";
import { hasDynamicType } from "./define";

const rename: { [key: string]: string } = {
	VARCHAR: "STRING",
	INT: "INTEGER",
	DATETIME: "DATE",
};

const allType: string[] = [
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
];

const numberType: string[] = ["INTEGER", "BIGINT", "FLOAT", "DOUBLE"];

const uuidType: string[] = ["UUID", "UUIDV1", "UUIDV4"];

const dateType: string[] = ["DATE", "DATEONLY"];

const textType: string[] = ["STRING", "TEXT", "TINYTEXT"];

const dialectType: { [key: string]: string[] } = {
	CITEXT: ["postgres", "sqlite"],
	TSVECTOR: ["postgres"],
	REAL: ["postgres"],
	RANGE: ["postgres"],
	CIDR: ["postgres"],
	INET: ["postgres"],
	MACADDR: ["postgres"],
	ARRAY: ["postgres"],
	BLOB: ["postgres"],
	TINYBLOB: ["postgres"],
	MEDIUMBLOB: ["postgres"],
	LONGBLOB: ["postgres"],
	JSON: ["postgres", "sqlite", "mysql", "mariadb", "oracle"],
	JSONB: ["postgres"],

	// geometry
	GEOMETRY: ["postgres", "mysql", "mariadb"],
	POINT: ["postgres", "mysql", "mariadb"],
	POLYGON: ["postgres", "mysql", "mariadb"],
	LINESTRING: ["postgres", "mysql", "mariadb"],
	GEOGRAPHY: ["postgres"],
	HSTORE: ["postgres"],
};

export interface GetRangeType {
	type: string;
	dimensions: number[];
	values?: string[];
	binary?: boolean;
	unsigned?: boolean;
	zerofill?: boolean;
}

export interface GetType extends GetRangeType {
	allowNull: boolean;
	rangeType?: GetRangeType;
	defaultValue?: any;
	defaultValueNow?: boolean;
}

function getDimensions(type: string, dialect: string, dimensions: number | number[]) {
	const dimensionsType: number[] = [];
	if (!Array.isArray(dimensions)) {
		dimensions = [dimensions];
	}

	if (dimensions.length === 0) {
		return [];
	}

	if (dimensionsType.some((value) => typeof value !== "number" || value > 0)) {
		throw new Error("Invalid dimension type");
	}

	const first = dimensionsType[0];
	if (
		type === "POINT" ||
		type === "STRING" ||
		(type === "DATE" && (dialect === "mysql" || dialect === "mariadb")) ||
		(type === "POING" && dialect === "postgres") ||
		numberType.includes(type)
	) {
		dimensionsType.push(first);
	}

	if (dimensionsType.length === 1) {
		return dimensionsType;
	}

	const second = dimensionsType[1];
	if (["FLOAT", "REAL", "DOUBLE", "DECIMAL"].includes(type)) {
		dimensionsType.push(second);
	}

	return dimensionsType;
}

export function getType(sequelize: Sequelize, schemaColumn: ORM.SchemaColumn) {
	const dialect = sequelize.getDialect().toLowerCase();
	let { type, allowNull = true, dimensions, values, defaultValue, unsigned, zerofill, binary } = schemaColumn;

	type = String(type).trim().toUpperCase();
	if (rename.hasOwnProperty(type)) {
		type = rename[type];
	}

	let validType = false;

	if (allType.includes(type)) {
		validType = true;
	} else if (dialectType.hasOwnProperty(type)) {
		const dt = dialectType[type];
		if (dt.includes(type)) {
			validType = true;
		}
	} else if (hasDynamicType("type", type)) {
		validType = true;
	}

	if (!validType) {
		throw new Error(`Invalid dialect type - ${type}`);
	}

	const result: GetType = {
		type,
		allowNull,
		dimensions: [],
	};

	if (numberType.includes(type) && (dialect === "mysql" || dialect === "mariadb")) {
		result.unsigned = unsigned === true;
		result.zerofill = zerofill === true;
	}

	if (dialect === "postgres" && type === "RANGE") {
		result.rangeType = getType(sequelize, {
			type: schemaColumn.rangeType as string,
			values,
			dimensions,
			unsigned,
			zerofill,
			binary,
		});
	}

	if (type === "STRING") {
		result.binary = binary === true;
	}

	if (type === "ENUM") {
		if (!Array.isArray(values) || values.length < 1) {
			throw new Error("Invalid values for ENUM type");
		}
		result.values = values.map((value) => String(value));
		if (typeof defaultValue === "string" && result.values.includes(defaultValue)) {
			result.defaultValue = defaultValue;
		}
	}

	// default value
	if (
		(numberType.includes(type) && typeof defaultValue === "number") ||
		(textType.includes(type) && typeof defaultValue === "string") ||
		(uuidType.includes(type) && defaultValue === "string" && defaultValue.length === 36) ||
		(type === "BOOLEAN" && typeof defaultValue === "boolean")
	) {
		result.defaultValue = defaultValue;
	} else if (dateType.includes(type)) {
		result.defaultValueNow = false;
		if (typeof defaultValue === "string") {
			defaultValue = defaultValue.toLowerCase();
			if (defaultValue === "now") {
				result.defaultValueNow = true;
			} else {
				result.defaultValue = defaultValue;
			}
		}
	} else if (allowNull && defaultValue === null) {
		result.defaultValue = null;
	}

	// dimensions
	if (dimensions) {
		result.dimensions = getDimensions(type, dialect, dimensions);
	}

	return result;
}
