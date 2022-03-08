import {Render} from "./types";
import HtmlDriverPrototype from "./HtmlDriverPrototype";

const baseDriver: string[] = [
	"react"
];

export default async function getRenderDriver(name: Render.HTMLDriver, page: Render.PageFound | Render.PageNotFound): Promise<Render.HtmlDriverInterface<any>> {

	// system drivers
	if(baseDriver.includes(name)) {
		name = `@credo-js/render-driver-${name}`;
	}

	let HtmlDriver: any;
	try {
		HtmlDriver = await import((`${name}/server`));
	} catch(err) {
		throw new Error(`Render driver {${name}/server} not found`);
	}

	if(typeof HtmlDriver.HtmlDriver === "function") {
		HtmlDriver = HtmlDriver.HtmlDriver;
	} else if(typeof HtmlDriver.default === "function") {
		HtmlDriver = HtmlDriver.default;
	} else if(typeof HtmlDriver !== "function") {
		throw new Error(`Unknown render driver {${name}/server}`);
	}

	if(!HtmlDriverPrototype.isPrototypeOf(HtmlDriver)) {
		throw new Error(`The {${name}/server} driver is not an HtmlDriverPrototype prototype`);
	}

	return new HtmlDriver(page);
}
