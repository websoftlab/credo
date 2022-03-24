export {};

declare global {
	export var __DEV__: boolean;
	export var __DEV_SERVER__: boolean;
	export var __PROD__: boolean;
	export var __BUNDLE__: string;
	export var __SSR__: boolean;
	export var __SRV__: boolean;
	export var __WEB__: boolean;
}
