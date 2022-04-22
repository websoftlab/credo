import isUnescapedName from "./isUnescapedName";

export default function keyVar(name: string, key: string | string[]) {
	if (!Array.isArray(key)) {
		key = [key];
	}
	for (let k of key) {
		name += isUnescapedName(k) ? `.${key}` : `[${JSON.stringify(key)}]`;
	}
	return name;
}
