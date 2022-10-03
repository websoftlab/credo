export function isList<T>(value: T[] | undefined): value is T[] {
	return Array.isArray(value) && value.length > 0;
}
