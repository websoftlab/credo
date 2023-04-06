import type { ORM } from "../types";
import type { HasOneOptions, HasManyOptions, BelongsToOptions, BelongsToManyOptions } from "sequelize";
import { isPlainObject } from "@phragon-util/plain-object";

function belongsTo(options: BelongsToOptions) {
	return options;
}

function belongsToMany(options: BelongsToManyOptions) {
	const { through } = options;
	if (!through) {
		throw new Error("The through is required for BelongsToMany relation type");
	}
	if (typeof through !== "string" && !isPlainObject(through)) {
		throw new Error("Invalid through type of BelongsToMany relation type");
	}
	return options;
}

function hasOne(options: HasOneOptions) {
	return options;
}

function hasMany(options: HasManyOptions) {
	return options;
}

export function getRelation(
	relation: ORM.SchemaRelation
):
	| ORM.SchemaRelationHasOne
	| ORM.SchemaRelationHasMany
	| ORM.SchemaRelationBelongsTo
	| ORM.SchemaRelationBelongsToMany {
	let { to, from, type, options = {} } = relation;

	switch (type.toLowerCase()) {
		case "belongs-to":
		case "belongsto":
			return {
				to,
				from,
				type: "belongsTo",
				options: belongsTo(options as BelongsToOptions),
			};
		case "belongs-to-many":
		case "belongstomany":
			return {
				to,
				from,
				type: "belongsToMany",
				options: belongsToMany(options as BelongsToManyOptions),
			};
		case "has-one":
		case "hasone":
			return {
				to,
				from,
				type: "hasOne",
				options: hasOne(options as HasOneOptions),
			};
		case "has-many":
		case "hasmany":
			return {
				to,
				from,
				type: "hasMany",
				options: hasMany(options as HasManyOptions),
			};
	}

	throw new Error(`Invalid relation type - ${type}`);
}
