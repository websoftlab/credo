import debug from "./debug";
import { cwd } from "./utils";
import { loadPackages } from "./workspace";
import { join } from "path";
import prettier from "./builders/prettier";

async function run(names: string[] = []) {
	const all = await loadPackages();
	const directories: string[] = [];

	if (names.length < 1) {
		const cwdIt = process.cwd();
		const pg = all.find((pg) => pg.cwd === cwdIt);
		if (!pg) {
			throw new Error("Current package not found");
		}
		directories.push(pg.cwd);
	} else {
		if (names.includes("--script")) {
			directories.push(join(cwd(), "scripts"));
		}
		all.forEach((pg) => {
			if (names.includes(pg.name)) {
				directories.push(pg.cwd);
			}
		});
	}

	if (!directories.length) {
		throw new Error("Packages not found");
	}

	for (const directory of directories) {
		await prettier(directory);
	}
}

if (cwd() === process.cwd()) {
	const names = process.argv.slice(2);
	if (!names.length) {
		debug("Warning! Run prettier for one specific package only");
	} else {
		run(names).catch((err) => {
			debug("Prettier failure", err);
		});
	}
} else {
	run().catch((err) => {
		debug("Prettier failure", err);
	});
}
