export default class HttpJSON<Body extends {} = any> {
	constructor(public body: Body, public status: number = 200) {}
	toJSON() {
		return this.body;
	}
	static isHttpJSON(obj: any): obj is HttpJSON {
		return obj ? obj instanceof HttpJSON : false;
	}
}
