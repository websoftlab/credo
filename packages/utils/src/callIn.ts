export default function callIn(object: any, name: string, args: any[], failure: () => void) {
	const segments = name.split(".");
	let handle: any = object[segments[0]];
	let self = handle;
	for (let i = 1; i < segments.length; i++) {
		const chunk = segments[i];
		if (handle) {
			if (typeof handle === "object") {
				self = handle;
			}
			handle = handle[chunk];
		}
	}
	if (typeof handle !== "function") {
		return failure();
	}
	if (typeof self !== "object") {
		self = undefined;
	}
	return handle.apply(self, args);
}
