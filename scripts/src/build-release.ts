import debug from "./debug";
import release from "./builders/release";
import { argv } from "./utils";

async function run() {
	const { prop } = argv();

	// channel
	const channel = prop.channel || [];
	if (!channel.length) {
		throw new Error("Release channel is not specified");
	}

	// scope
	const scope: string[] = prop.scope || [];

	for (const name of channel) {
		await release(name, scope);
	}
}

run().catch((err) => {
	debug("Release failure", err);
});
