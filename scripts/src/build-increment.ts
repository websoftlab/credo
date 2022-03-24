import {loadPackages, selectPackage} from "./workspace";
import {increment} from "./version";
import debug from "./debug";
import {argv} from "./utils";

async function run() {
	const all = await loadPackages();
	const pgNames: string[] = all.map(item => item.name);
	const names: string[] = [];
	const {args} = argv();

	for(const name of args) {
		if(!pgNames.includes(name)) {
			debug("Warning! {darkRed %s} package not found", name);
		} else if(!names.includes(name)) {
			names.push(name);
		}
	}

	if(!names.length) {
		names.push(... await selectPackage());
	}

	if(!names.length) {
		return debug("Packages not selected. Exit...");
	}

	for(const name of names) {
		const details = all.find(w => w.name === name);
		if(details) {
			const ver = await increment(details);
			if(ver.version !== details.latestVersion) {
				debug("Set {yellow %s} package version {cyan %s}", details.name, ver.version);
			}
		}
	}
}

run().catch(err => {
	debug("Increment failure", err);
});
