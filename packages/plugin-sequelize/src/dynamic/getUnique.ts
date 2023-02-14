export type GetUnique = boolean | string | { name: string; msg: string };

export function getUnique(type?: GetUnique) {
	if (!type) {
		return false;
	}
	if (typeof type === "boolean") {
		return true;
	}
	if (typeof type === "string") {
		return type;
	}
	const { name, msg } = type;
	if (!name) {
		return true;
	}
	if (!msg) {
		return name;
	}
	return {
		name,
		msg,
	};
}
