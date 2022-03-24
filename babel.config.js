module.exports = function getBabelConfig(api) {
	const useESModules = api.env(['legacy', 'modern', 'stable']);
	const presets = [];

	if(api.env(["node", "commonjs"])) {
		presets.push([
			'@babel/preset-env', {
				loose: true,
				bugfixes: true,
				browserslistEnv: process.env.BABEL_ENV || process.env.NODE_ENV,
				debug: process.env.BUILD_VERBOSE === "verbose",
				modules: useESModules ? false : 'commonjs',
				shippedProposals: api.env('modern'),
				targets: {
					node: "12",
					esmodules: true,
				}
			},
		]);
	}

	presets.push(
		'@babel/preset-react',
		'@babel/preset-typescript',
	);

	const plugins = [
		'babel-plugin-optimize-clsx',
		// Need the following 3 proposals for all targets in .browserslistrc.
		// With our usage the transpiled loose mode is equivalent to spec mode.
		['@babel/plugin-proposal-class-properties', { loose: true }],
		['@babel/plugin-proposal-private-methods', { loose: true }],
		['@babel/plugin-proposal-object-rest-spread', { loose: true }],
		[
			'@babel/plugin-transform-runtime', {
				useESModules,
				// any package needs to declare 7.4.4 as a runtime dependency. default is ^7.0.0
				version: '^7.4.4',
			},
		]
	];

	if(api.env(["node", "commonjs"])) {
		plugins.push([
			'babel-plugin-transform-react-remove-prop-types', {
				mode: 'unsafe-wrap',
			},
		]);
	}

	return {
		presets,
		plugins,
		ignore: [
			/@babel[\\|/]runtime/,
		],
	};
};
