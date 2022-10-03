export default class HttpRedirect {
	constructor(public location: string, public back: boolean = false) {}
	static isHttpRedirect(obj: any): obj is HttpRedirect {
		return obj ? obj instanceof HttpRedirect : false;
	}
}
