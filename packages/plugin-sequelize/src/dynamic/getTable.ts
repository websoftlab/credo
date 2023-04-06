import type { ORM } from "../types";
import type { Sequelize } from "sequelize";
import type { GetColumn } from "./getColumn";
import type { DefineTypeObjectType } from "./define";
import { isPlainObject } from "@phragon-util/plain-object";
import { pluralize } from "inflection";
import { getColumn } from "./getColumn";
import { createValidateDynamicObjectTypes } from "./define";

export interface GetTable<Detail extends {} = any> {
	__name: string;
	model: string;
	creator: boolean;
	tableName: string;
	observer: DefineTypeObjectType[];
	primary: boolean;
	schema: { [key: string]: GetColumn };
	createdAt: false | string;
	updatedAt: false | string;
	detail: Detail;
}

export function getTable(sequelize: Sequelize, name: string, table: ORM.SchemaTable): GetTable {
	let {
		model,
		creator,
		tableName,
		schema = {},
		detail = {},
		primary = true,
		createdAt = "createdAt",
		updatedAt = "updatedAt",
		observer,
	} = table;

	if (!model) {
		throw new Error("Model name is not defined");
	}
	if (!isPlainObject(schema)) {
		throw new Error("Invalid table schema type");
	}

	const created = createdAt ? (createdAt === true ? "createdAt" : createdAt.trim()) : false;
	const updated = updatedAt ? (updatedAt === true ? "updatedAt" : updatedAt.trim()) : false;
	const schemaData: { [key: string]: GetColumn } = {};
	const keys = Object.keys(schema);
	if (keys.includes("id")) {
		throw new Error("Field name 'id' is reserved and cannot be used");
	}
	if (created && keys.includes(created)) {
		throw new Error(`Field name '${created}' is reserved and cannot be used`);
	}
	if (created === "") {
		throw new Error(`The createdAt field name cannot be empty string`);
	}
	if (updated && keys.includes(updated)) {
		throw new Error(`Field name '${updated}' is reserved and cannot be used`);
	}
	if (updated === "") {
		throw new Error(`The updatedAt field name cannot be empty string`);
	}

	keys.forEach((field) => {
		const column = schema[field];
		schemaData[field] = getColumn(sequelize, name, typeof column === "string" ? { type: column } : column);
	});

	return {
		__name: name,
		model,
		creator: Boolean(creator),
		tableName: tableName || pluralize(model),
		primary,
		schema: schemaData,
		createdAt: created,
		updatedAt: updated,
		observer: createValidateDynamicObjectTypes("observer", observer),
		detail,
	};
}
