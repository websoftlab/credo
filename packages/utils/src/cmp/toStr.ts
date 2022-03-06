export default function toStr(value: any) {
	if(typeof value === "string") {
		return value;
	}
	if(value === 0) {
		return "0";
	}
	if(!value || value === true) {
		return "";
	}
	if(value instanceof Date) {
		return value.toISOString();
	}
	return String(value);
}
