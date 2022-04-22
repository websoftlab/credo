const AsyncFunction = (async () => {}).constructor;
const GeneratorFunction = function* () {}.constructor;

export default function isAsync(func: Function | (() => void)): boolean {
	if (typeof func !== "function") {
		return false;
	}
	return (
		(func as any)[Symbol.toStringTag] === "AsyncFunction" ||
		(func instanceof AsyncFunction && AsyncFunction !== Function && AsyncFunction !== GeneratorFunction)
	);
}
