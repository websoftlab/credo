import type { ORM } from "../types";
import type { Sequelize } from "sequelize";
import type { GetTable } from "./getTable";
import { isPlainObject } from "@phragon/utils";
import { getTable } from "./getTable";
import { getRelation } from "./getRelation";

export interface Builder {
	table: GetTable[];
	relation: ORM.SchemaRelation[];
}

export function createBuilder(sequelize: Sequelize, name: string, schema: ORM.DefineDynamicOptions) {
	let { table = [], relation = [] } = schema;
	if (!Array.isArray(table)) {
		table = isPlainObject(table) ? [table] : [];
	}
	if (!Array.isArray(relation)) {
		relation = isPlainObject(relation) ? [relation] : [];
	}

	// merge model
	const tableList: GetTable[] = [];
	table
		.map((t) => getTable(sequelize, name, t))
		.forEach((t) => {
			const found = tableList.find((tl) => tl.model === t.model);
			if (found) {
				found.schema = {
					...found.schema,
					...t.schema,
				};
			} else {
				tableList.push(t);
			}
		});

	return {
		table: tableList,
		relation: relation.map((r) => getRelation(r)),
	};
}
