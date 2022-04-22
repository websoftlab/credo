import type { BuildConfigureOptions } from "../types";
import rollupConfigure from "./configure";
import { rollup } from "rollup";

export default async function builder(options: BuildConfigureOptions) {
	const config = await rollupConfigure(options);
	const { output: outputOptions, ...inputOptions } = config;

	// create a bundle
	const bundle = await rollup(inputOptions);

	// write the bundle to disk
	await bundle.write(outputOptions);

	// closes the bundle
	await bundle.close();
}
