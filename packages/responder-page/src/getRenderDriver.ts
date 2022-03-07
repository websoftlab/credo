import {Render} from "./types";

export default async function getRenderDriver(name: Render.HTMLDriver, page: Render.PageFound | Render.PageNotFound): Promise<Render.HtmlDocumentInterface<any>> {

	// system drivers
	switch(name) {
		case "react": return new (await import("./react/server")).HtmlDocument(page);
	}

	let driver: any;
	try {
		driver = await import(name);
	} catch(err) {
		throw new Error(`Render driver [${name}] not found`);
	}

	if(typeof driver.HtmlDocument === "function") {
		driver = driver.HtmlDocument;
	} else if(typeof driver.default === "function") {
		driver = driver.default;
	} else if(typeof driver !== "function") {
		throw new Error(`Unknown render driver [${name}]`);
	}

	return new driver(page);
}
