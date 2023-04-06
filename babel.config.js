module.exports = function getBabelConfig(api) {
	const useESModules = api.env(["legacy", "module", "modern", "stable"]);
	const presets = [];

	presets.push(
		[
			"@babel/preset-typescript",
			{
				allowDeclareFields: true,
			},
		],
		"@babel/preset-react"
	);

	if (api.env(["node", "commonjs", "module"])) {
		const targets = {};
		if (api.env("module")) targets.browsers = "> 0.5%, last 2 versions, not dead";
		else if (api.env("commonjs")) targets.esmodules = true;
		else if (api.env("node")) targets.node = "14";
		presets.push([
			"@babel/preset-env",
			{
				loose: true,
				bugfixes: true,
				debug: process.env.BUILD_VERBOSE === "verbose",
				modules: useESModules ? false : "commonjs",
				shippedProposals: api.env("modern"),
				forceAllTransforms: false,
				targets,
			},
		]);
	}

	const plugins = [
		[
			"@babel/plugin-transform-typescript",
			{
				allowDeclareFields: true,
			},
		],
	];

	if (!api.env("module")) {
		plugins.push(
			"babel-plugin-optimize-clsx",
			// Need the following 3 proposals for all targets in .browserslistrc.
			// With our usage the transpiled loose mode is equivalent to spec mode.
			["@babel/plugin-proposal-class-properties", { loose: true }],
			["@babel/plugin-proposal-private-methods", { loose: true }],
			["@babel/plugin-proposal-object-rest-spread", { loose: true }]
		);
	}

	plugins.push(
		["@babel/plugin-proposal-decorators", { loose: true, decoratorsBeforeExport: true }],
		[
			"@babel/plugin-transform-runtime",
			{
				useESModules,
				// any package needs to declare 7.4.4 as a runtime dependency. default is ^7.0.0
				version: "^7.21.0",
			},
		]
	);

	if (api.env("module")) {
		plugins.push("babel-plugin-add-import-extension");
	}

	if (api.env(["node", "commonjs"])) {
		plugins.push([
			"babel-plugin-transform-react-remove-prop-types",
			{
				mode: "unsafe-wrap",
			},
		]);
	}

	return {
		presets,
		plugins,
		ignore: [/@babel[\\|/]runtime/],
	};
};
