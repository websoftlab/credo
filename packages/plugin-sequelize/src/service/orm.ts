import type { Model, SyncOptions } from "sequelize";
import type { LoadDynamicInfo, ORM, ORMService } from "../types";
import type { Builder, Debug, LoadSchemaBuilder } from "../dynamic";
import type { PhragonJSGlobal } from "@phragon/server";
import { createBuilder, loadSchemaBuilder, BuildError, LoadSchemaBuilderOptions } from "../dynamic";
import { Op, Sequelize } from "sequelize";
import { isPlainObject } from "@phragon-util/plain-object";
import { toAsync } from "@phragon-util/async";
import { initMigration, getMigration } from "../model/Migration";
import { initDynamicSequelize, getDynamicSequelize } from "../model/DynamicSequelize";
import semver from "semver/preload";

let serviceORMService: ORMService | null = null;

const serverRegExp =
	/(?<=^v?|\sv?)(?:(?:0|[1-9]\d{0,9}?)\.){2}(?:0|[1-9]\d{0,9})(?:-(?:--+)?(?:0|[1-9]\d*|\d*[a-z]+\d*)){0,100}(?=$| |\+|\.)(?:(?<=-\S+)(?:\.(?:--?|[\da-z-]*[a-z-]\d*|0|[1-9]\d*)){1,100}?)?(?!\.)(?:\+(?:[\da-z]\.?-?){1,100}?(?!\w))?(?!\+)/gi;

function getVersion(version: string) {
	const m = version.match(serverRegExp);
	if (m) {
		return m[0];
	} else {
		return version;
	}
}

function createLogger(phragon: PhragonJSGlobal) {
	return function (message: string, timing?: number | object | undefined) {
		let detail: any = {};
		if (
			isPlainObject<{
				raw: boolean;
				type: string;
				plain: boolean;
				name?: unknown;
			}>(timing)
		) {
			const { raw, type, plain, name } = timing;
			detail = {
				raw,
				type,
				plain,
				name,
			};
		} else if (typeof timing === "number") {
			detail = { timing };
		}
		phragon.debug.orm(message, detail);
	};
}

export default function createORMService(phragon: PhragonJSGlobal): ORMService {
	if (phragon.loaded) {
		throw new Error("Unable to instantiate ORM because the system has already been booted");
	}

	if (serviceORMService) {
		return serviceORMService;
	}

	let dynamic: LoadSchemaBuilder | null = null;

	const dbConfig = phragon.config("db");
	const modelList: ORM.DefineOptions<any>[] = [];
	const dynamicBuilderList: { name: string; builder: Builder }[] = [];
	const dynamicBuilderName: string[] = [];
	const migrationList: {
		name: string;
		migrations: { version: string; initial: boolean; callback: ORM.LambdaPromise }[];
	}[] = [];

	function definePhragon(object: any) {
		Object.defineProperty(object, "phragon", { value: phragon, configurable: false });
	}

	let loaded = false;
	let conn: Sequelize | null = null;

	function reloadDynamic(link: Sequelize) {
		if (!dynamic) {
			return;
		}

		// init models
		for (const { model, init } of dynamic.init) {
			definePhragon(model);
			definePhragon(model.prototype);
			init(model, link);
		}

		// create relations
		dynamic.relation(link);
	}

	function reload(link: Sequelize) {
		const relations: ORM.Lambda[] = [];

		// init models
		for (const item of modelList) {
			const model = class extends item.model {};
			definePhragon(model);
			definePhragon(model.prototype);
			item.init(model, link);
			if (typeof item.relation === "function") {
				relations.push(item.relation);
			}
		}

		// create relations
		for (const callback of relations) {
			callback(link);
		}
	}

	async function migrate(link: Sequelize) {
		for (const { name, migrations } of migrationList) {
			const sort = migrations.sort((v1, v2) => semver.compare(v1.version, v2.version));
			let migrate = await getMigration().findOne({ where: { name } });

			// create migration
			if (!migrate) {
				const last = sort[sort.length - 1].version;
				const init = sort.find((item) => item.initial);
				if (init) {
					migrate = await getMigration().create({
						name,
						version: init.version,
					});
					if (migrate.version === last) {
						continue;
					}
				}
			}

			let last = migrate ? migrate.version : null;
			let next = last == null;
			for (const { version, callback } of sort) {
				if (!next && last != null) {
					if (semver.lt(last, version)) {
						next = true;
					} else {
						continue;
					}
				}
				await callback(link);
				if (!migrate) {
					await getMigration().create({ name, version });
				} else {
					await migrate.update({ version });
				}
			}
		}
	}

	function createSequelize(): Sequelize {
		// load config
		const link = new Sequelize({
			logging: createLogger(phragon),
			...dbConfig,
		});

		definePhragon(link);

		return link;
	}

	async function sync(sequelize: Sequelize, options: SyncOptions) {
		// start sync
		for (const name of Object.keys(sequelize.models)) {
			if (name === "Migration" || name === "DynamicSequelize") {
				continue;
			}
			await sequelize.models[name].sync(options);
		}
	}

	function getSequelize(): Sequelize {
		if (conn == null) {
			conn = createSequelize();
			if (loaded) {
				reload(conn);
				reloadDynamic(conn);
			}
		}
		return conn;
	}

	function printDebug(incoming: string, debug: Debug[]) {
		if (!debug.length) {
			return;
		}
		phragon.debug.orm(incoming);
		debug.forEach(({ text, level }) => {
			phragon.debug.orm(`[${level}] ${text}`);
		});
	}

	async function _loadSchemaBuilder(options: LoadSchemaBuilderOptions) {
		try {
			const dynamic = await loadSchemaBuilder(options);
			printDebug("Dynamic ORM debug:", dynamic.debug);
			return dynamic;
		} catch (err) {
			phragon.debug.orm("Dynamic ORM model failure", err);
			if (err instanceof BuildError) {
				if (err.parent) {
					phragon.debug.orm("Original error:", err.parent);
				}
				printDebug("Debug messages before crash:", err.debug);
			}
		}
		return false;
	}

	async function reconnect(syncAllModels: boolean = false, load = false): Promise<Sequelize> {
		let link: Sequelize | null = null;
		if (loaded) {
			load = false;
		} else if (load && conn) {
			link = conn;
		}

		if (!link) {
			link = createSequelize();
		}

		initMigration(link);
		initDynamicSequelize(link);
		await getMigration().sync();
		await getDynamicSequelize().sync();

		reload(link);

		if (load && dynamicBuilderList.length === 0) {
			dynamic = await loadSchemaBuilder({ action: "reload" });
		}

		while (dynamicBuilderList.length > 0) {
			const t = dynamicBuilderList.shift();
			if (!t) {
				break;
			}
			const { name, builder } = t;
			const test = await _loadSchemaBuilder({ action: "load", name, builder });
			if (!test) {
				break;
			}
			dynamic = test;
			if (!dynamicBuilderName.includes(name)) {
				dynamicBuilderName.push(name);
			}
		}

		if (dynamicBuilderList.length === 0) {
			const count1 = await getDynamicSequelize().count();
			const count2 = await getDynamicSequelize().count({ where: { name: { [Op.in]: dynamicBuilderName } } });
			if (count1 - count2 > 0 || count2 !== dynamicBuilderName.length) {
				phragon.debug.orm(
					"The number of registered dynamic ORM schemas does not match the number of schemas in the database"
				);
			}
		}

		reloadDynamic(link);

		if (!load) {
			try {
				await link.authenticate();
			} catch (err) {
				phragon.debug.error("Database connection refused", err);
				throw new Error("Database authenticate error");
			}
		}

		if (load) {
			await migrate(link);
		}

		if (syncAllModels) {
			await sync(link, {});
		}

		if (load) {
			loaded = true;
		} else if (conn != null) {
			try {
				await conn.close();
			} catch (err) {
				link.close().catch((err) => {
					phragon.debug.error("Error closing the database connection", err);
				});
				throw new Error("Can't close last connection");
			}
			conn = null; // kill last
		}

		if (conn !== link) {
			conn = link;
		}

		// start seeding
		if (load) {
			for (const item of modelList) {
				const { seeding } = item;
				if (typeof seeding === "function") {
					await toAsync(seeding(conn));
				}
			}
		}

		return link;
	}

	async function dynamicAction(options: LoadSchemaBuilderOptions, force = false): Promise<LoadDynamicInfo> {
		if (!force) {
			const d = await _loadSchemaBuilder(options);
			if (!d) {
				return { ok: false, status: "rejected", debug: [] };
			}
			if (!d.modify) {
				return { ok: false, status: "void", debug: d.debug };
			}
			dynamic = d;
			await reconnect();
		}
		return {
			ok: true,
			status: force && dynamicBuilderList.length !== 0 ? "rejected" : "modify",
			debug: dynamic ? dynamic.debug : [],
		};
	}

	class ORMServiceClass implements ORMService {
		get phragon(): PhragonJSGlobal {
			return phragon;
		}
		get sequelize(): Sequelize {
			return getSequelize();
		}
		get loaded() {
			return loaded;
		}
		async connect(): Promise<Sequelize> {
			const link = getSequelize();
			try {
				await link.authenticate();
			} catch (err) {
				throw new Error("Database authenticate error");
			}
			return link;
		}
		async reconnect(sync?: boolean) {
			if (loaded) {
				await reconnect(sync);
			} else {
				await this.connect();
			}
		}
		model<Name extends keyof ORM.Models>(name: Name): ORM.Models[Name] {
			return getSequelize().model(name) as ORM.Models[Name];
		}
		syncAll(options: SyncOptions = {}) {
			return sync(getSequelize(), options);
		}
		isDefined(modelName: string): boolean {
			return getSequelize().isDefined(modelName);
		}
		define<T extends Model>(options: ORM.DefineOptions<T>): this {
			if (loaded) {
				throw new Error("Schema loaded, use bootstrap handler for call ORMService.define(...)");
			}
			if (modelList.findIndex((item) => item.model === options.model) !== -1) {
				throw new Error("Model already defined");
			}
			modelList.push(options);
			return this;
		}

		async reloadDynamic(): Promise<LoadDynamicInfo> {
			if (!loaded) {
				return { ok: true, status: "wait", debug: [] };
			}
			return dynamicAction({ action: "reload" }, dynamicBuilderList.length !== 0);
		}

		async removeDynamic(name: string): Promise<LoadDynamicInfo> {
			let index = dynamicBuilderName.indexOf(name);
			if (index !== -1) {
				dynamicBuilderName.splice(index, 1);
			}
			index = dynamicBuilderList.findIndex((item) => item.name === name);
			if (index !== -1) {
				dynamicBuilderList.splice(index, 1);
			}
			if (!loaded) {
				return { ok: true, status: "wait", debug: [] };
			}
			return dynamicAction({ action: "remove", name });
		}

		async loadDynamic(name: string, options: ORM.DefineDynamicOptions): Promise<LoadDynamicInfo> {
			if (!dynamicBuilderName.includes(name)) {
				dynamicBuilderName.push(name);
			}
			const builder: Builder = createBuilder(getSequelize(), name, options);
			if (loaded) {
				return dynamicAction({ action: "load", name, builder });
			} else {
				dynamicBuilderList.push({ name, builder });
				return { ok: true, status: "wait", debug: [] };
			}
		}

		defineMigration(name: string, options: ORM.MigrationOptions): this;
		defineMigration(name: string, callback: ORM.LambdaPromise): this;
		defineMigration(name: string, version: string): this;
		defineMigration(name: string): this;
		defineMigration(name: string, options?: string | ORM.LambdaPromise | ORM.MigrationOptions): this {
			if (loaded) {
				throw new Error("Schema loaded, use bootstrap handler for call ORMService.defineMigration(...)");
			}

			if (typeof options === "function") {
				options = {
					callback: options,
				};
			} else if (typeof options === "string") {
				options = {
					version: options,
				};
			} else if (options == null) {
				options = {};
			}

			let { initial, version, callback } = options;
			let migrator = migrationList.find((item) => item.name === name);

			if (!migrator) {
				migrator = {
					name,
					migrations: [],
				};
				migrationList.push(migrator);
			}

			// check version
			if (!version) {
				version = typeof callback === "function" ? "0.0.1" : "0.0.0";
			} else {
				version = getVersion(version);
				if (!semver.valid(version)) {
					throw new Error(`Invalid migration version name: ${version}`);
				}
			}

			// callback
			if (typeof callback !== "function") {
				if (initial !== false) {
					initial = true;
				}
				callback = async () => {
					phragon.debug(`Initial ${name} ORM migration`);
				};
			}

			migrator.migrations.push({ version, callback, initial: initial === true });
			return this;
		}
	}

	serviceORMService = new ORMServiceClass();

	Object.freeze(serviceORMService);

	phragon.hooks.once("onLoad", async () => {
		if (serviceORMService) {
			await reconnect(true, true);
			await phragon.hooks.emit("onORMLoad", { orm: serviceORMService });
		}
	});

	return serviceORMService;
}
