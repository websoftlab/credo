import type {BuildConfigure} from "../../types";
import MiniCssExtractPlugin from 'mini-css-extract-plugin';

export default function(_: BuildConfigure) {
	return new MiniCssExtractPlugin({
		// Options similar to the same options in webpackOptions.output
		// both options are optional
		filename: '[name].[fullhash].css',
		chunkFilename: 'styles/[id].[fullhash].css',
	});
}