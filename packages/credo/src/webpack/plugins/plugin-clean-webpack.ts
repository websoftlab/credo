import type {BuildConfigure} from "../../types";
import {CleanWebpackPlugin} from "clean-webpack-plugin";

export default function(_: BuildConfigure) {
	return new CleanWebpackPlugin({
		cleanOnceBeforeBuildPatterns: [
			'**/*',
			'!profile.json',
			'!tsconfig.tsbuildinfo',
		],
	});
}