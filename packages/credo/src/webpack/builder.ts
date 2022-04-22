import webpack from "webpack";
import configure from "./configure";
import type { BuildConfigureOptions } from "../types";

export default async function builder(options: BuildConfigureOptions) {
	const config = await configure(options);
	return new Promise<void>((resolve, reject) => {
		webpack(config, (err, stats) => {
			if (err) {
				reject(err);
			} else if (!stats) {
				reject(new Error("Stats webpack object is empty"));
			} else {
				console.log(
					stats.toString({
						colors: true,
					})
				);
				resolve();
			}
		});
	});
}
