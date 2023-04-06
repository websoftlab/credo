import type { Builder } from "./createBuilder";
import type { GetTable } from "./getTable";
import type {
	Transaction,
	ModelAttributes,
	ModelAttributeColumnOptions,
	ThroughOptions,
	ModelStatic,
	Sequelize,
} from "sequelize";
import type { GetRangeType } from "./getType";
import type { GetColumn } from "./getColumn";
import type { ORM } from "../types";
import { getDynamicSequelize } from "../model/DynamicSequelize";
import { DataTypes, Model } from "sequelize";
import { createDynamicTypeHandler, getDynamicType, hasDynamicType } from "./define";

function compare<T extends {}>(left: T, right: T) {
	if (Array.isArray(left) && (!Array.isArray(right) || left.length !== right.length)) {
		return false;
	}

	const lk = Object.keys(left);
	const rk = Object.keys(right);

	if (lk.length !== rk.length) {
		return false;
	} else if (lk.length === 0) {
		return true;
	}

	for (const key of lk) {
		if (!rk.includes(key)) {
			return false;
		}
		const lv = left[key as keyof T];
		const rv = right[key as keyof T];

		if (typeof lv === "object") {
			if (lv === null) {
				if (rv !== null) {
					return false;
				}
			} else if (!compare(lv as {}, rv as {})) {
				return false;
			}
		} else if (lv !== rv) {
			return false;
		}
	}

	return true;
}

function createAttribute(field: string, column: GetColumn, invoke: boolean = false): ModelAttributeColumnOptions {
	const {
		__name,
		type,
		dimensions,
		rangeType,
		values,
		binary,
		unsigned,
		zerofill,
		defaultValue,
		defaultValueNow,
		setter,
		getter,
		...rest
	} = column;
	const fn =
		type === "RANGE"
			? DataTypes.RANGE(getType(rangeType as GetRangeType))
			: getType({ type, dimensions, binary, unsigned, zerofill, values });

	const attribute: ModelAttributeColumnOptions = {
		type: fn,
		defaultValue: defaultValueNow ? DataTypes.NOW : defaultValue,
		...rest,
	};

	if (!invoke) {
		return attribute;
	}

	if (setter.length > 0) {
		const set = setter.map((object) => createDynamicTypeHandler("setter", object));
		attribute.set = function (value) {
			for (const callback of set) {
				value = callback(this, value, field);
			}
			this.setDataValue(field, value);
		};
	}

	if (getter.length > 0) {
		const get = getter.map((object) => createDynamicTypeHandler("getter", object));
		attribute.get = function () {
			let value = this.getDataValue(field);
			for (const callback of get) {
				value = callback(this, value, field);
			}
			return value;
		};
	}

	return attribute;
}

function getType(info: GetRangeType) {
	const { type, dimensions, binary, unsigned, zerofill, values } = info;
	let fn: any;

	if (type === "ENUM") {
		fn = DataTypes.ENUM(...(values as string[]));
	} else if (type === "POINT") {
		fn = DataTypes.GEOGRAPHY("POINT", ...dimensions);
	} else if (["POLYGON", "LINESTRING"].includes(type)) {
		fn = DataTypes.GEOGRAPHY(type);
	} else {
		fn = hasDynamicType("type", type) ? getDynamicType("type", type) : (DataTypes[type as "STRING"] as Function);

		if (dimensions.length) fn = fn(...dimensions);
		if (unsigned) fn = fn.UNSIGNED;
		if (zerofill) fn = fn.ZEROFILL;
		if (binary) fn = fn.BINARY;
	}

	return fn;
}

function createTableAttributes(table: GetTable, invoke: boolean = false) {
	const attributes: ModelAttributes = {};
	const { primary, createdAt, updatedAt } = table;

	if (primary) {
		attributes.id = {
			type: DataTypes.INTEGER,
			primaryKey: true,
			autoIncrement: true,
		};
	}

	for (const field of Object.keys(table.schema)) {
		attributes[field] = createAttribute(field, table.schema[field], invoke);
	}

	if (createdAt) attributes[createdAt] = DataTypes.DATE;
	if (updatedAt) attributes[updatedAt] = DataTypes.DATE;

	return attributes;
}

function createRelation(sequelize: Sequelize, relation: ORM.SchemaRelation[]) {
	for (const { from, to, type, options } of relation) {
		const fromModel = sequelize.model(from);
		const toModel = sequelize.model(to);
		switch (type) {
			case "hasOne":
			case "has-one":
				fromModel.hasOne(toModel, options);
				break;
			case "hasMany":
			case "has-many":
				fromModel.hasMany(toModel, options);
				break;
			case "belongsTo":
			case "belongs-to":
				fromModel.belongsTo(toModel, options);
				break;
			case "belongsToMany":
			case "belongs-to-many":
				if (options) {
					let through = options.through;
					if (typeof through === "string") {
						options.through = sequelize.model(through);
					} else if (through) {
						const t = through as ThroughOptions;
						if (typeof t.model === "string") {
							t.model = sequelize.model(t.model);
						}
					}
					fromModel.belongsToMany(toModel, options);
				}
				break;
		}
	}
}

export type DebugType = "error" | "info";

export interface Debug {
	level: DebugType;
	text: string;
}

export interface BuildInit<T extends Model = Model> {
	model: ModelStatic<T>;
	name: string;
	init<T extends Model = Model>(model: ModelStatic<T>, sequelize: Sequelize): void;
}

export interface LoadSchemaBuilder {
	init: BuildInit[];
	relation(sequelize: Sequelize): void;
	debug: Debug[];
	modify: boolean;
	builder: Builder;
	tables: Record<string, GetTable>;
}

export interface LoadSchemaBuilderOptions {
	action: "load" | "reload" | "remove";
	name?: string;
	builder?: Builder;
}

export class BuildError extends Error {
	constructor(message: string, public debug: Debug[], public parent?: Error) {
		super(message);
	}
}

export async function loadSchemaBuilder(options: LoadSchemaBuilderOptions): Promise<LoadSchemaBuilder> {
	const DynamicSequelize = getDynamicSequelize();
	const sequelize = DynamicSequelize.sequelize;
	if (!sequelize) {
		throw new Error("Sequelize for DynamicSequelize not defined");
	}

	const { action, name, builder } = options;
	if (action === "load") {
		if (typeof name !== "string" || name.length === 0 || !builder) {
			throw new Error(`The "load" action requires a "name" and a "builder" option`);
		}
	} else if (action === "remove") {
		if (typeof name !== "string" || name.length === 0) {
			throw new Error(`The "remove" action requires a "name" option`);
		}
	} else if (action !== "reload") {
		throw new Error(`Invalid action "${action}" name`);
	}

	const queryInterface = sequelize.getQueryInterface();
	const debug: { level: "error" | "info"; text: string }[] = [];
	function log(text: string, level: DebugType = "info") {
		debug.push({ level, text });
	}

	async function createTable(t: Transaction, table: GetTable) {
		await queryInterface.createTable(table.tableName, createTableAttributes(table), { transaction: t });
	}

	async function updateTable(t: Transaction, prev: GetTable, table: GetTable) {
		const create: { field: string; attribute: ModelAttributeColumnOptions }[] = [];
		const update: { field: string; attribute: ModelAttributeColumnOptions }[] = [];
		const remove: string[] = [];
		const rename: { oldName: string; newName: string }[] = [];
		const name = table.__name;
		const left = Object.keys(table.schema);

		left.forEach((field) => {
			const p = prev.schema.hasOwnProperty(field) ? prev.schema[field] : false;
			const n = table.schema[field];
			if (p) {
				if (p.__name !== name) {
					log(`The ${field} field already defined`, "error");
				} else if (!compare(p, n)) {
					update.push({ field, attribute: createAttribute(field, n) });
				}
			} else {
				create.push({ field, attribute: createAttribute(field, n) });
			}
		});

		Object.keys(prev.schema)
			.filter((field) => prev.schema[field].__name === name && !left.includes(field))
			.forEach((field) => {
				remove.push(field);
			});

		function dateAttribute(before: string | false, after: string | false) {
			if (before === after) {
				return;
			}
			if (!before) {
				create.push({ field: after as string, attribute: { type: DataTypes.DATE } });
			} else if (!after) {
				remove.push(before as string);
			} else {
				rename.push({ oldName: before, newName: after });
				const removeIndex = remove.indexOf(before);
				if (removeIndex !== -1) {
					remove.splice(removeIndex, 1);
				}
			}
		}

		dateAttribute(prev.createdAt, table.createdAt);
		dateAttribute(prev.updatedAt, table.updatedAt);

		for (const { field, attribute } of create) {
			await queryInterface.addColumn(prev.tableName, field, attribute, { transaction: t });
		}
		for (const { field, attribute } of update) {
			await queryInterface.changeColumn(prev.tableName, field, attribute, { transaction: t });
		}
		for (const field of remove) {
			await queryInterface.removeColumn(prev.tableName, field, { transaction: t });
		}
		for (const { oldName, newName } of rename) {
			await queryInterface.renameColumn(prev.tableName, oldName, newName, { transaction: t });
		}

		return create.length > 0 || update.length > 0 || remove.length > 0 || rename.length > 0;
	}

	try {
		return await sequelize.transaction(async (transaction) => {
			let modify = false;
			let last: Builder | null = null;

			if (action === "remove" && name != null) {
				const item = await DynamicSequelize.findOne({ where: { name }, transaction });
				if (item != null) {
					await item.destroy({ transaction });
					log(`schema [${name}] removed`);
					modify = true;
				}
			}

			const table = action === "load" && builder ? builder.table : [];
			const tables: { [key: string]: GetTable } = {};
			const data = await DynamicSequelize.findAll({ order: ["createdAt"], transaction });

			// merge last records
			for (const item of data) {
				if (item.name === name) {
					last = item.data;
				}
				for (const t of item.data.table) {
					if (!tables[t.model]) {
						if (t.creator) {
							tables[t.model] = t;
						} else {
							// warning only!
							log(`The ${t.model} model creator not found`, "error");
						}
					} else if (t.creator) {
						throw new BuildError(`The ${t.model} model creator already defined`, debug);
					} else {
						tables[t.model].schema = {
							...tables[t.model].schema,
							...t.schema,
						};
					}
				}
			}

			for (const t of table) {
				const { model } = t;
				if (!tables.hasOwnProperty(model)) {
					modify = true;
					await createTable(transaction, t);
				} else if (await updateTable(transaction, tables[model], t)) {
					modify = true;
				}
			}

			if (action === "load" && name != null && builder != null) {
				if (last != null) {
					// remove tables
					const left = table.filter((t) => t.creator).map((t) => t.model);
					const right = last.table
						.filter((t) => t.creator && !left.includes(t.model))
						.map((t) => {
							if (tables.hasOwnProperty(t.model)) {
								delete tables[t.model];
							}
							return t.tableName;
						});
					for (const tableName of right) {
						modify = true;
						await queryInterface.dropTable(tableName, { transaction });
					}
					// check modify flag
					if (!modify) {
						modify = !compare(builder, last);
					}
				}

				if (last != null) {
					await DynamicSequelize.create({ name, data: builder }, { transaction });
				} else if (modify) {
					await DynamicSequelize.update({ data: builder }, { where: { name }, transaction });
				}
			}

			// tree
			const modelNames = Object.keys(tables);
			const details: { [key: string]: unknown } = {};
			const init: BuildInit[] = [];

			for (const modelName of modelNames) {
				const table = tables[modelName];
				const { tableName, createdAt, updatedAt, observer, detail } = table;
				const TableModel = class TableModel extends Model {};
				const attributes = createTableAttributes(table, true);
				details[modelName] = detail;
				init.push({
					model: TableModel,
					name: modelName,
					init(model: ModelStatic<Model>, sequelize: Sequelize) {
						for (const dynamic of observer) {
							model = createDynamicTypeHandler("observer", dynamic)(null, model, {
								fields: Object.keys(attributes),
								modelName,
								tableName,
								createdAt,
								updatedAt,
								detail,
							});
						}
						model.init(attributes, {
							sequelize,
							modelName,
							tableName,
							createdAt,
							updatedAt,
						});
					},
				});
			}

			return {
				init,
				relation(sequelize: Sequelize) {
					for (const {
						data: { relation },
					} of data) {
						createRelation(sequelize, relation);
					}
				},
				debug,
				modify,
				builder,
				tables,
			} as LoadSchemaBuilder;
		});
	} catch (err) {
		if (err instanceof BuildError) {
			throw err;
		}
		throw new BuildError("Database failure", debug, err as Error);
	}
}
