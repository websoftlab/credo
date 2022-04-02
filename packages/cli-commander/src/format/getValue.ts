export default function getValue<T>(value: T): {valid: true, value: T} {
	return {
		valid: true,
		value
	};
}