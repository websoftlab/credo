import toStr from "./toStr";

export default class CmpValue {
	constructor(public value: string) {}
	toString() {
		return toStr(this.value);
	}
}
