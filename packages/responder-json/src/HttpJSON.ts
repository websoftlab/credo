export default class HttpJSON {
	constructor(public body: any, public status: number = 200) {}
	toJSON() {
		return this.body;
	}
	static isHttpJSON(obj: any): obj is HttpJSON {
		return obj ? obj instanceof HttpJSON : false;
	}
}