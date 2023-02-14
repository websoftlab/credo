import type { InferAttributes, InferCreationAttributes, CreationOptional, Sequelize } from "sequelize";
import type { Builder } from "../dynamic";
import { DataTypes, Model } from "sequelize";

export class DynamicSequelize extends Model<
	InferAttributes<DynamicSequelize>,
	InferCreationAttributes<DynamicSequelize>
> {
	declare name: string;
	declare data: Builder;
	declare createdAt: CreationOptional<Date>;
	declare updatedAt: CreationOptional<Date>;
}

let DynamicSequelizeClass: typeof DynamicSequelize = reload();

function reload() {
	return class DynamicSequelizeClass extends DynamicSequelize {};
}

export function getDynamicSequelize() {
	return DynamicSequelizeClass;
}

export function initDynamicSequelize(sequelize: Sequelize) {
	if (DynamicSequelizeClass.sequelize) {
		DynamicSequelizeClass = reload();
	}
	DynamicSequelizeClass.init(
		{
			name: {
				type: DataTypes.STRING(255),
				allowNull: false,
				unique: true,
			},
			data: {
				type: DataTypes.JSON,
				allowNull: false,
			},
			createdAt: DataTypes.DATE,
			updatedAt: DataTypes.DATE,
		},
		{
			sequelize,
			modelName: "DynamicSequelize",
		}
	);
}
