export default function defineGlobal(mode?: "development" | "production", ssr: boolean = true): void {
	if(typeof global !== "undefined") {
		const isDev = (mode || process.env.NODE_ENV) !== "production";
		if(typeof __DEV__ === "undefined") global.__DEV__ = isDev;
		if(typeof __DEV_SERVER__ === "undefined") global.__DEV_SERVER__ = false;
		if(typeof __PROD__ === "undefined") global.__PROD__ = !isDev;
		if(typeof __BUNDLE__ === "undefined") global.__BUNDLE__ = isDev ? "dev" : "build";
		if(typeof __SSR__ === "undefined") global.__SSR__ = Boolean(ssr);
		if(typeof __SRV__ === "undefined") global.__SRV__ = true;
		if(typeof __WEB__ === "undefined") global.__WEB__ = false;
	}
}