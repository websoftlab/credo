export default function argv() {
	const { argv } = process;
	const args: string[] = [];
	const flag: Record<string, undefined | true> = {};
	const prop: Record<string, undefined | string[]> = {};

	let key = "";

	for (let i = 2; i < argv.length; i++) {
		let name = argv[i];
		if (name.startsWith("--")) {
			key = name.substring(2);
			if (!prop.hasOwnProperty(key)) {
				prop[key] = [];
			}
		} else if (name.startsWith("-")) {
			key = "";
			flag[name.substring(1)] = true;
		} else if (key) {
			prop[key]?.push(name);
		} else {
			args.push(name);
		}
	}

	return {
		args,
		prop,
		flag,
	};
}
