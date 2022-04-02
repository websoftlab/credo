import type {BuildConfigure} from "../../types";
const WebpackManifestPlugin = require('../utils/manifest-webpack-plugin');

export default function(_: BuildConfigure) {
	return new WebpackManifestPlugin({
		filename: "manifest.json",
	});
}
