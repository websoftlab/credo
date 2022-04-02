import type {BuildConfigure} from "../../types";

export default async function babel(config: BuildConfigure) {
	const {
		type,
		isDev,
		bundle,
		isClient,
		cwdPath,
	} = config;

	const presets: any[] = [];

	// preset ENV
	presets.push([
		'@babel/preset-env', isClient ? {
			modules: "commonjs",
			targets: {
				browsers: ['>1%', 'last 4 versions', 'not ie < 9']
			},
			useBuiltIns: 'usage',
			corejs: 3,
			debug: false,
			exclude: [
				"proposal-dynamic-import"
			],
		} : {
			bugfixes: true,
			targets: {
				node: "12",
			}
		},
	]);

	const plugins: string[] = [
		'@babel/plugin-proposal-class-properties',
		'@babel/plugin-proposal-export-namespace-from',
		'@babel/plugin-proposal-throw-expressions',
		'@babel/plugin-proposal-object-rest-spread',
	];

	let cacheDirectory: false | string = false;
	if(isDev) {
		cacheDirectory = cwdPath(`${bundle}/${type}/.cache`);
	}

	return config.fireOnOptionsHook("config.babel", {
		presets,
		plugins,
		cacheDirectory,
	});
}
