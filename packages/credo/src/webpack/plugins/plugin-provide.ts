import webpack from 'webpack';
import type {BuildConfigure} from "../../types";

export default function(_: BuildConfigure) {
	return new webpack.ProvidePlugin({
		/**
		 * @example {
		 *       $: 'jquery',
		 *  }
		 */
	});
}
