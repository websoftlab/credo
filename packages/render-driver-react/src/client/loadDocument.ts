export default function loadDocument(id: string, def: any = {}) {
	if(typeof document === "undefined") {
		return def;
	}
	const script = document.getElementById(id);
	if(script) {
		try {
			return JSON.parse(script.innerText) || def;
		} catch(err) {}
	}
	return def;
}