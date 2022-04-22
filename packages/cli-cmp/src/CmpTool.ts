import type { StringifyOptions } from "./types";
import stringify from "./stringify";
import keyVar from "./keyVar";
import CmpValue from "./CmpValue";

const TOOL_NAME_ID = Symbol();

export default class CmpTool {
	[TOOL_NAME_ID]: Record<string, number> = {};

	clone() {
		const tool = new CmpTool();
		tool[TOOL_NAME_ID] = JSON.parse(JSON.stringify(this[TOOL_NAME_ID]));
		return tool;
	}

	tmp(name: string = "tmp") {
		const tmp = this[TOOL_NAME_ID];
		if (!tmp[name]) {
			tmp[name] = 1;
			return name;
		} else {
			return `${name}_${tmp[name]++}`;
		}
	}

	keyVar(name: string, key: string | string[]) {
		return keyVar(name, key);
	}

	val(value: string) {
		return new CmpValue(value);
	}

	esc(value: any, opts: StringifyOptions = {}): string {
		return stringify(value, opts);
	}
}
