import { isHttpStatus } from "./utils/status";

export default class HttpPage<Data = any, Page extends string = string, Props extends {} = any> {
	data: Data;
	status: number = 200;
	page: Page | null | undefined = null;
	props: Props = <Props>{};
	ssr: boolean | null = false;

	constructor(data: any, status: number = 200) {
		this.data = data;
		this.setStatusCode(status);
	}

	setStatusCode(code: number) {
		if (isHttpStatus(code) && code !== 204 && !String(code).startsWith("30")) {
			this.status = code;
		}
		return this;
	}

	setPage(page: Page) {
		this.page = page;
		return this;
	}

	setProps(props: Props) {
		this.props = props;
		return this;
	}

	setSSR(ssr: boolean) {
		this.ssr = ssr;
		return this;
	}

	static isHttpPage(obj: any): obj is HttpPage {
		return obj ? obj instanceof HttpPage : false;
	}
}
