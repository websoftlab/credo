export default function mergeExtensions(left: string[], right: string | string[]) {
	if(typeof right === "string") {
		right = [right];
	}
	const ext: string[] = left.slice();
	right.forEach(one => {
		if(!ext.includes(one)) {
			ext.push(one);
		}
	});
	return ext;
}