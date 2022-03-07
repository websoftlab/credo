export default class HttpRedirect {
	constructor(public location: string) {}
	static isHttpRedirect(obj: any): obj is HttpRedirect {
		return obj ? obj instanceof HttpRedirect : false;
	}
}