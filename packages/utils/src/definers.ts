export function __isDev__() {
	return typeof __DEV__ !== "undefined" ? __DEV__ : false;
}

export function __isProd__() {
	return typeof __PROD__ !== "undefined" ? __PROD__ : true;
}

export function __isWeb__() {
	return typeof __WEB__ !== "undefined" ? __WEB__ : typeof window !== "undefined";
}

export function __isSrv__() {
	return typeof __SRV__ !== "undefined" ? __SRV__ : typeof window === "undefined";
}

export function __env__() {
	return typeof __ENV__ !== "undefined" ? __ENV__ : "production";
}
