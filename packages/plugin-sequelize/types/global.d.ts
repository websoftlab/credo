import type { Sequelize, Options } from "sequelize";
import type { ORMService } from "@phragon/plugin-sequelize/types";

declare module "@phragon/server" {
	declare namespace Config {
		interface PluginORMConfig extends Options {}
	}
	declare interface PhragonServices {
		sequelize: Sequelize;
		orm: ORMService;
	}
	declare interface ConfigHandler {
		(name: "db", def?: Partial<Config.PluginORMConfig>): Config.PluginORMConfig;
	}
}
