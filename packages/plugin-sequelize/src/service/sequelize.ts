import type { PhragonJSGlobal } from "@phragon/server";
import type { Sequelize } from "sequelize";
import { BootGetter } from "@phragon/server";
import orm from "./orm";

export default function createSequelizeService(phragon: PhragonJSGlobal): BootGetter<Sequelize> {
	const service = orm(phragon);
	return new BootGetter(() => service.sequelize);
}
