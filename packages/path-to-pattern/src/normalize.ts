export default function normalize(path: string) {
	if(!path) {
		return "/";
	}
	if(path === "*" || path === "/*") {
		return "/*";
	}
	if(!path.startsWith("/")) {
		path = `/${path}`;
	}
	while(path.length > 1 && path.endsWith("/")) {
		path = path.substring(0, path.length - 1);
	}
	return path;
}