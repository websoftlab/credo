import spawn from "cross-spawn";
import { cwdPath, existsStat, readJsonFile } from "phragon/utils/index";
import { sep, extname } from "path";

async function cmd(parser: string, files: string[], ext: string[]) {
	files = await scan(files, ext);
	if (files.length === 0) {
		return;
	}

	// prettier-ignore
	const args = [
		"--no-error-on-unmatched-pattern",
		"--config", cwdPath(".prettierrc.json"),
		"--parser", parser,
		"--write"
	].concat(files);

	return new Promise<void>((resolve, reject) => {
		const child = spawn("prettier", args, {
			stdio: "inherit",
		});
		child.on("close", (code) => {
			if (code !== 0) {
				reject({
					command: `prettier ${args.join(" ")}`,
				});
			} else {
				resolve();
			}
		});
	});
}

async function scan(find: string[], ext: string[]) {
	const files: string[] = [];

	// convert ".JSON" to "json"
	ext = ext.slice().map((name) => {
		if (name.startsWith(".")) {
			name = name.substring(1);
		}
		return name.toLowerCase();
	});

	const dirEnd = ext.length === 1 ? `*.${ext[0]}` : `*.{${ext.join(",")}}`;

	for (let name of find) {
		if (!name.startsWith("./")) {
			name = `./${name}`;
		}
		const stat = await existsStat(name);
		if (!stat) {
			continue;
		}
		if (stat.isDirectory) {
			files.push([stat.file, "**", dirEnd].join(sep));
		} else if (stat.isFile) {
			let extName = extname(name).toLowerCase();
			if (extName && extName.length > 1 && ext.includes(extName.substring(1))) {
				files.push(stat.file);
			}
		}
	}

	return files;
}

export default async function prettier() {
	// 1. javascript
	await cmd(
		"babel",
		["./src-client", "./src-server", "./src-full", "./lexicon", "./config", "./phragon.config.js"],
		["js"]
	);

	// 2. typescript
	await cmd("typescript", ["./src-client"], ["ts", "tsx"]);
	await cmd(
		"typescript",
		["./src-server", "./src-full", "./lexicon", "./phragon-env.d.ts", "./phragon.config.ts"],
		["ts"]
	);

	// 3. json
	await cmd("json", ["./config", "./lexicon", "./package.json", "./.prettierrc.json", "./tsconfig.json"], [".json"]);

	// 4. more
	const stat = await existsStat("./.phragon/prettier.json");
	if (!stat || !stat.isFile) {
		return;
	}

	const data: { parser?: string[] } = await readJsonFile(stat.file);
	const { parser = [] } = data;
	if (!parser || !Array.isArray(parser) || parser.length === 0) {
		return;
	}

	type Finder = { parser: string; find: string[]; ext: string[]; types?: string[] };

	const finder: Finder[] = [
		{ parser: "yaml", find: ["./config"], ext: [".yaml"] },
		{ parser: "css", find: ["./src-client"], ext: [".css"], types: ["css", "scss", "less"] },
		{ parser: "scss", find: ["./src-client"], ext: [".scss", ".sass"] },
		{ parser: "less", find: ["./src-client"], ext: [".less"] },
		{ parser: "html", find: ["./src-client"], ext: [".html", ".htm"] },
	];

	for (const item of finder) {
		const { parser, find, ext, types = [parser] } = item;
		if (types.some((type) => parser.includes(type))) {
			await cmd(parser, find, ext);
		}
	}
}
