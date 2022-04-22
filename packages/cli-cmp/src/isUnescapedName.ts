import { PRIVATE_JS_NAME } from "./constant";

const regName = /^[a-zA-Z_$][a-zA-Z0-9_$]*$/;

export default function isUnescapedName(name: string): boolean {
	return regName.test(name) && !PRIVATE_JS_NAME.includes(name);
}
