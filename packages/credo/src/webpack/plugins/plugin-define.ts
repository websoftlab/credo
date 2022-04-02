import webpack from 'webpack';
import define from "../../config/define";
import type {BuildConfigure} from "../../types";

export default async function pluginDefine(config: BuildConfigure) {
	return new webpack.DefinePlugin(await define(config));
}