import type { StringifyOptions } from "./types";
import CmpTool from "./CmpTool";
import stringify from "./stringify";
import keyVar from "./keyVar";
import toStr from "./toStr";

function getVar(pref: "var" | "let" | "const", name: string, value?: any, escape?: boolean | StringifyOptions) {
	if (escape) {
		value = stringify(value, escape === true ? {} : escape);
	} else {
		value = toStr(value);
	}
	return `${pref} ${name}${value ? ` = ${value}` : ""};`;
}

type DepthLambda = (tool: CmpTool) => void;

type CmpType = {
	capture: [boolean, boolean, string];
	js: string;
	ji: string[];
	tabs: string;
	aborted: boolean;
	id: number;
	pref: string;
	keys: string[];
	name: Record<string, string>;
	data: Record<string, Record<string, string>>;
	dataKeys: Record<string, string[]>;
	dataAll: Record<string, boolean>;
	req: Record<string, string>;
	set: Record<string, [string, string?]>;
};

const CMP_ID = Symbol();

function getName(cmp: CmpType, from: string) {
	const match = from.match(/([a-zA-Z][a-zA-Z0-9_]+)(?:\.[a-z]+)?$/);
	return (match ? match[1].charAt(0).toUpperCase() + match[1].substring(1) : "Req") + cmp.id++;
}

function getReq(cmp: CmpType) {
	let out = "";
	Object.keys(cmp.req).forEach((from) => {
		out += `const ${cmp.req[from]} = require(${JSON.stringify(from)});\n`;
	});
	return out;
}

function importOnce(cmp: CmpType, from: string) {
	if (!cmp.ji.includes(from)) {
		cmp.ji.push(from);
	}
}

function addJS(cJs: CmpJS, source: string) {
	const cmp = cJs[CMP_ID];
	const { capture } = cmp;
	if (capture[0]) {
		capture[2] += source;
		if (!capture[1]) {
			capture[1] = source.replace(/\s+/g, "").length > 0;
		}
	} else {
		cmp.js += source;
	}
}

class CmpJS {
	[CMP_ID]: CmpType = {
		capture: [false, false, ""],
		js: "",
		ji: [],
		tabs: "",
		aborted: false,
		id: 1,
		pref: "",
		keys: [],
		name: {},
		data: {},
		dataKeys: {},
		dataAll: {},
		req: {},
		set: {},
	};

	tool: CmpTool;

	constructor(prefix?: string, tool?: CmpTool) {
		this.tool = tool || new CmpTool();
		this[CMP_ID].pref = prefix || "Imp";
	}

	clone() {
		const cmp = this[CMP_ID];
		const cJs = new CmpJS(cmp.pref, this.tool.clone());
		cJs[CMP_ID] = JSON.parse(JSON.stringify(cmp));
		return cJs;
	}

	abort() {
		this[CMP_ID].aborted = true;
		return this;
	}

	get aborted(): boolean {
		return this[CMP_ID].aborted;
	}

	reset() {
		this[CMP_ID].aborted = false;
		return this;
	}

	get captured(): boolean {
		return this[CMP_ID].capture[0];
	}

	capture() {
		const cmp = this[CMP_ID];
		if (cmp.capture[0]) {
			throw new Error("Capture is already underway");
		}
		cmp.capture[0] = true;
		return {
			get filled(): boolean {
				return cmp.capture[0] && cmp.capture[1];
			},
			get source(): string {
				return cmp.capture[2];
			},
			reset() {
				cmp.capture = [false, false, ""];
			},
			close() {
				cmp.js += cmp.capture[2];
				cmp.capture = [false, false, ""];
			},
		};
	}

	set(from: string, varName?: string, name?: string) {
		if (!name) {
			name = varName || "default";
		}
		this[CMP_ID].set[name] = [from, varName];
		return this;
	}

	get(name: string) {
		const cmp = this[CMP_ID].set;
		if (cmp.hasOwnProperty(name)) {
			return this.imp(...cmp[name]);
		} else {
			throw new Error(`The ${name} id not defined`);
		}
	}

	impOnly(from: string | string[]) {
		if (Array.isArray(from)) {
			for (let file of from) {
				importOnce(this[CMP_ID], file);
			}
		} else {
			importOnce(this[CMP_ID], from);
		}
		return this;
	}

	req(from: string) {
		const cmp = this[CMP_ID];
		if (!cmp.req.hasOwnProperty(from)) {
			cmp.req[from] = `_${cmp.pref}_${getName(cmp, from)}`;
		}
		return cmp.req[from];
	}

	imp(from: string, varName?: string): string {
		const iid = this[CMP_ID];

		if (!iid.keys.includes(from)) {
			const name = getName(iid, from);
			iid.keys.push(from);
			iid.name[from] = name;
			iid.data[from] = {};
			iid.dataKeys[from] = [];
		}

		if (!varName) {
			varName = "default";
		} else if (varName === "*") {
			iid.dataAll[from] = true;
			return `_${iid.pref}_${iid.name[from]}`;
		}

		if (!iid.dataKeys[from].includes(varName)) {
			iid.dataKeys[from].push(varName);
			iid.data[from][varName] = `${iid.pref}_${iid.name[from]}_${iid.id++}`;
		}

		return iid.data[from][varName];
	}

	gef(name: string, args: string | string[] = "") {
		if (Array.isArray(args)) {
			args = args.join(", ");
		}
		return `${this.get(name)}(${args})`;
	}

	fnc(from: string, varName?: string, args: string | string[] = "") {
		if (Array.isArray(args)) {
			args = args.join(", ");
		}
		return `${this.imp(from, varName)}(${args})`;
	}

	gl(name: string, value?: any, escape: boolean | StringifyOptions = false) {
		return this.append(getVar("let", name, value, escape));
	}
	gc(name: string, value?: any, escape: boolean | StringifyOptions = false) {
		return this.append(getVar("const", name, value, escape));
	}
	gv(name: string, value?: any, escape: boolean | StringifyOptions = false) {
		return this.append(getVar("var", name, value, escape));
	}

	imported(from: string, varName?: string) {
		const iid = this[CMP_ID];
		if (!iid.keys.includes(from)) {
			return false;
		}
		if (varName) {
			return typeof iid.data[from][varName] === "string";
		}
		return false;
	}

	toImport() {
		let out = "";
		let outConst = "";
		const cmp = this[CMP_ID];

		for (let from of cmp.keys) {
			const data = cmp.data[from];

			if (cmp.dataAll[from]) {
				const baseName = `_${cmp.pref}_${cmp.name[from]}`;
				out += `import * as ${baseName} from ${stringify(from)};\n`;

				Object.keys(data).forEach((name) => {
					const varName = data[name];
					if (name === "default") {
						outConst += `const ${varName} = ${baseName}.default;\n`;
					} else {
						outConst += `const ${varName} = ${keyVar(baseName, name)};\n`;
					}
				});
			} else {
				out += `import { ${Object.keys(data)
					.map((name) => `${name} as ${data[name]}`)
					.join(", ")} } from ${stringify(from)};\n`;
			}
		}

		cmp.ji.forEach((file) => {
			out += `import ${stringify(file)};\n`;
		});

		return out + getReq(cmp) + outConst;
	}

	toRequire() {
		let def = false;
		let out = "";
		const cmp = this[CMP_ID];

		for (let from of cmp.keys) {
			const baseName = `_${cmp.pref}_${cmp.name[from]}`;
			const data = cmp.data[from];
			out += `const ${baseName} = require(${stringify(from)});\n`;
			Object.keys(data).forEach((name) => {
				const varName = data[name];
				if (name === "default") {
					def = true;
					out += `const ${varName} = _interopRequireDefault(${baseName}).default;\n`;
				} else {
					out += `const ${varName} = ${keyVar(baseName, name)};\n`;
				}
			});
		}

		if (def) {
			out = `const _interopRequireDefault = require("@babel/runtime/helpers/interopRequireDefault");\n${out}`;
		}

		out += getReq(cmp);
		cmp.ji.forEach((file) => {
			out += `require(${stringify(file)});\n`;
		});

		return out;
	}

	nl() {
		addJS(this, "\n");
		return this;
	}

	tl(val: string) {
		addJS(this, val);
		return this;
	}

	append(exp: string | number | Array<string | number>) {
		if (!Array.isArray(exp)) {
			exp = [exp];
		}
		for (let line of exp) {
			line = toStr(line);
			if (line.length > 0) {
				addJS(this, "\n" + this[CMP_ID].tabs + line);
			}
		}
		return this;
	}

	tab(func: () => void, count: number = 1) {
		const cmp = this[CMP_ID];
		if (typeof count !== "number" || isNaN(count) || count < 1) {
			count = 1;
		} else if (count > 20) {
			count = 20;
		}
		cmp.tabs += "\t".repeat(count);
		func();
		cmp.tabs = cmp.tabs.substring(count);
		return this;
	}

	group(exp: string, end: string, func: DepthLambda) {
		if (exp) {
			exp = exp.trimEnd();
			exp += " ";
		}

		const cmp = this[CMP_ID];

		addJS(this, "\n" + cmp.tabs + exp + "{");

		cmp.tabs += "\t";
		func(new CmpTool());
		cmp.tabs = cmp.tabs.substring(1);

		addJS(this, "\n" + cmp.tabs + "}" + (end || ""));

		return this;
	}

	comment(text: string) {
		text = toStr(text)
			.trim()
			.replace(/\r\n|\r/g, "\n");
		if (!text.length) {
			return this;
		}
		if (text.includes("\n")) {
			text = "/* " + text.replace(/\*\//g, "*|") + " */";
		} else {
			text = "// " + text;
		}
		return this.append(text);
	}

	toJS(type: "import" | "require" | false = false) {
		let out = "";
		if (type === "import") {
			out += this.toImport();
		} else if (type === "require") {
			out += this.toRequire();
		}
		return out + this.toString();
	}

	toString() {
		return this[CMP_ID].js;
	}
}

export default CmpJS;
