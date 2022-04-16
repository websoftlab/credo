const HTTP_TEXT_ID = Symbol();

export default class HttpText {
	[HTTP_TEXT_ID] = true;
	constructor(public body: string | number | null, public status: number = 200) {}
	toText() {
		return String(this.body === 0 ? "0" : (this.body || ""));
	}
	static isHttpText(obj: any): obj is HttpText {
		return obj ? obj[HTTP_TEXT_ID] === true : false;
	}
}