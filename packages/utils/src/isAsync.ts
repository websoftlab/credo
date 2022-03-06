const AsyncFunction = (async () => {}).constructor;
const GeneratorFunction = (function* () {}).constructor;

export default function isAsync(func: Function | (() => void)): boolean {
	if(typeof func !== "function") {
		return false;
	}
	// @ts-ignore
	return func[Symbol.toStringTag] === 'AsyncFunction' || (
		func instanceof AsyncFunction &&
		AsyncFunction !== Function &&
		AsyncFunction !== GeneratorFunction
	);
}
