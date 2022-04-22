export default function prepareBabelConfig(babelConfig: any) {
	if (!babelConfig.presets) {
		babelConfig.presets = [];
	}

	const presets: Array<string | [string, any]> = babelConfig.presets;
	const index = presets.findIndex((item) => {
		if (typeof item === "string") {
			return item === "@babel/preset-env";
		}
		if (Array.isArray(item)) {
			return item[0] === "@babel/preset-env";
		}
	});

	// preset React
	const presetReact: [string, any] = [
		"@babel/preset-react",
		{
			runtime: "automatic",
		},
	];

	if (index === -1) {
		presets.push(presetReact);
	} else {
		presets.splice(index, 0, presetReact);
	}
}
