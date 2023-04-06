export function isNullValue(value: any, isNull?: (value: any) => boolean) {
	return typeof isNull === "function" ? isNull(value) : value == null;
}
