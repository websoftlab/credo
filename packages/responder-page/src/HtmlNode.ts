export default class HtmlNode {
	constructor(public name: string, public attributes: Record<string, any> = {}, public html: string = "") {}
}