import type { InferAttributes, InferCreationAttributes, CreationOptional, Sequelize } from "sequelize";
import { DataTypes, Model } from "sequelize";

export class Migration extends Model<InferAttributes<Migration>, InferCreationAttributes<Migration>> {
	declare name: string;
	declare version: string;
	declare createdAt: CreationOptional<Date>;
	declare updatedAt: CreationOptional<Date>;
}

let MigrationClass: typeof Migration = reload();

function reload() {
	return class MigrationClass extends Migration {};
}

export function getMigration() {
	return MigrationClass;
}

export function initMigration(sequelize: Sequelize) {
	if (MigrationClass.sequelize) {
		MigrationClass = reload();
	}
	MigrationClass.init(
		{
			name: {
				type: DataTypes.STRING(100),
				allowNull: false,
				unique: true,
			},
			version: {
				type: DataTypes.STRING(50),
				allowNull: false,
			},
			createdAt: DataTypes.DATE,
			updatedAt: DataTypes.DATE,
		},
		{
			sequelize,
			modelName: "Migration",
		}
	);
}
