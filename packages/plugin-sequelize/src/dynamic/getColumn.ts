import type { GetType } from "./getType";
import type { GetUnique } from "./getUnique";
import type { DefineTypeObjectType } from "./define";
import { Sequelize } from "sequelize";
import { ORM } from "../types";
import { getType } from "./getType";
import { getUnique } from "./getUnique";
import { createValidateDynamicObjectTypes } from "./define";

export interface GetColumn extends GetType {
	__name: string;
	unique: GetUnique;
	setter: DefineTypeObjectType[];
	getter: DefineTypeObjectType[];
	comment?: string;
	onUpdate?: string;
	onDelete?: string;
}

export function getColumn(sequelize: Sequelize, name: string, column: ORM.SchemaColumn): GetColumn {
	const { detail = {}, comment, unique, onUpdate, onDelete, setter, getter, ...rest } = column;
	const typeOf = getType(sequelize, rest);
	const clm: GetColumn = {
		...typeOf,
		unique: getUnique(unique),
		setter: createValidateDynamicObjectTypes("setter", setter),
		getter: createValidateDynamicObjectTypes("setter", getter),
		__name: name,
	};
	if (typeof onUpdate === "string" && onUpdate) clm.onUpdate = onUpdate;
	if (typeof onDelete === "string" && onDelete) clm.onDelete = onDelete;
	if (typeof comment === "string") clm.comment = comment;
	return clm;
}
