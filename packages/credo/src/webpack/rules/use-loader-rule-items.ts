import {join as joinPath} from "path";
import MiniCssExtractPlugin from 'mini-css-extract-plugin';
import {babel, postcss} from '../config';
import type {BuildLoaderRule} from "../types";
import type {BuildConfigure} from "../../types";

const cssLoader = (config: BuildConfigure, options: any = {}): BuildLoaderRule => ({
	loader: 'css-loader',
	options: {
		... options,
		sourceMap: config.isDev,
	}
});

/**
 * Sass loader with sass-resources-loader
 */
const sassLoaderItems = (config: BuildConfigure): BuildLoaderRule[] => {
	const {isDev, cwd} = config;
	return [
		{
			loader: 'sass-loader',
			options: {
				sourceMap: isDev,
				implementation: require('sass'),
			},
		},
		{
			loader: joinPath(__dirname, "../utils/sass-bootstrap-transform-loader.js"),
			options: {
				cwdPath: cwd
			}
		}
	];
};

async function postCssLoader(config: BuildConfigure): Promise<BuildLoaderRule> {
	return {
		loader: 'postcss-loader',
		options: {
			postcssOptions: {
				... await postcss(config),
			},
			sourceMap: config.isDev,
		},
	};
}

/***
 * Using MiniCssExtractPlugin in production or style-loader in development
 * @see https://webpack.js.org/plugins/mini-css-extract-plugin/#root
 * @see https://webpack.js.org/loaders/style-loader/#root
 */
const miniCssExtractLoader = (config: BuildConfigure): BuildLoaderRule => ({
	loader: config.isDevServer ? "style-loader" : MiniCssExtractPlugin.loader,
	options: {
		esModule: false,
	},
});

async function babelLoader(config: BuildConfigure): Promise<BuildLoaderRule> {
	return {
		loader: 'babel-loader',
		options: {
			... await babel(config),
		},
	};
}

export {
	cssLoader,
	sassLoaderItems,
	postCssLoader,
	miniCssExtractLoader,
	babelLoader,
}
