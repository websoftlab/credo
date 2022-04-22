export default function isObj<T = any>(obj: any): obj is T {
	return obj != null && typeof obj === "object";
}
