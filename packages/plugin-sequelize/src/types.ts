import type { PhragonJSGlobal } from "@phragon/server";
import type {
	Sequelize,
	Model,
	ModelStatic,
	SyncOptions,
	HasManyOptions,
	BelongsToOptions,
	HasOneOptions,
	BelongsToManyOptions,
} from "sequelize";
import type { Debug } from "./dynamic";

export declare namespace ORM {
	export interface Lambda {
		(sequelize: Sequelize): void;
	}

	export interface LambdaPromise {
		(sequelize: Sequelize): Promise<void>;
	}

	export interface DefineOptions<T extends Model = Model> {
		model: ModelStatic<T>;
		init: (model: ModelStatic<T>, sequelize: Sequelize) => void;
		relation?: Lambda;
		seeding?: LambdaPromise;
	}

	export interface SchemaColumn<Detail extends {} = any> {
		type: string;
		rangeType?: string;
		dimensions?: number | number[];
		allowNull?: boolean;
		binary?: boolean;
		defaultValue?: unknown;
		unsigned?: boolean;
		zerofill?: boolean;
		unique?: boolean | string | { name: string; msg: string };
		comment?: string;
		onUpdate?: string;
		onDelete?: string;
		values?: string[];
		setter?: string | string[];
		getter?: string | string[];
		detail?: Detail;
	}

	export interface SchemaTable<Detail extends {} = any> {
		model: string;
		creator: boolean;
		tableName?: string;
		timestamp?: boolean;
		createdAt?: boolean | string;
		updatedAt?: boolean | string;
		primary?: boolean;
		schema?: Record<string, string | SchemaColumn>;
		observer?: string | string[];
		detail?: Detail;
	}

	export type SchemaRelationHasOneType = "hasOne" | "has-one";
	export type SchemaRelationHasManyType = "hasMany" | "has-many";
	export type SchemaRelationBelongsToType = "belongsTo" | "belongs-to";
	export type SchemaRelationBelongsToManyType = "belongsToMany" | "belongs-to-many";
	export type SchemaRelationType =
		| SchemaRelationHasOneType
		| SchemaRelationHasManyType
		| SchemaRelationBelongsToType
		| SchemaRelationBelongsToManyType;

	interface SchemaRelationBase {
		from: string;
		to: string;
	}

	export interface SchemaRelationHasOne extends SchemaRelationBase {
		type: SchemaRelationHasOneType;
		options?: HasOneOptions;
	}

	export interface SchemaRelationHasMany extends SchemaRelationBase {
		type: SchemaRelationHasManyType;
		options?: HasManyOptions;
	}

	export interface SchemaRelationBelongsTo extends SchemaRelationBase {
		type: SchemaRelationBelongsToType;
		options?: BelongsToOptions;
	}

	export interface SchemaRelationBelongsToMany extends SchemaRelationBase {
		type: SchemaRelationBelongsToManyType;
		options?: BelongsToManyOptions;
	}

	export type SchemaRelation =
		| SchemaRelationHasOne
		| SchemaRelationHasMany
		| SchemaRelationBelongsTo
		| SchemaRelationBelongsToMany;

	export interface DefineDynamicOptions {
		table?: SchemaTable | SchemaTable[];
		relation?: SchemaRelation | SchemaRelation[];
	}

	export interface Models {}

	export interface MigrationOptions {
		version?: string;
		initial?: boolean;
		callback?: LambdaPromise;
	}
}

export interface LoadDynamicInfo {
	ok: boolean;
	status: "rejected" | "void" | "modify" | "wait";
	debug: Debug[];
}

export declare class ORMService {
	readonly phragon: PhragonJSGlobal;
	readonly sequelize: Sequelize;
	readonly loaded: boolean;
	connect(): Promise<Sequelize>;
	reconnect(sync?: boolean): Promise<void>;
	model<Name extends keyof ORM.Models>(name: Name): ORM.Models[Name];
	syncAll(options?: SyncOptions): Promise<void>;

	reloadDynamic(): Promise<LoadDynamicInfo>;
	removeDynamic(name: string): Promise<LoadDynamicInfo>;
	loadDynamic(name: string, options: ORM.DefineDynamicOptions): Promise<LoadDynamicInfo>;

	isDefined(name: string): boolean;
	define<T extends Model = Model>(options: ORM.DefineOptions<T>): this;

	defineMigration(name: string, options: ORM.MigrationOptions): this;
	defineMigration(name: string, callback: ORM.LambdaPromise): this;
	defineMigration(name: string, version: string): this;
	defineMigration(name: string): this;
}
