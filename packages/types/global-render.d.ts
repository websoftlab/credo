declare module "*.module.css" {
	const classes: { readonly [key: string]: string };
	export default classes;
}

declare module "*.module.sass" {
	const classes: { readonly [key: string]: string };
	export default classes;
}

declare module "*.module.scss" {
	const classes: { readonly [key: string]: string };
	export default classes;
}

// svg react element

declare module "*.component.svg" {
	const value: import("react").FC<import("react").SVGProps<SVGSVGElement>>;
	export default value;
}

// images

declare module "*.png" {
	const value: string;
	export default value;
}

declare module "*.jpeg" {
	const value: string;
	export default value;
}

declare module "*.gif" {
	const value: string;
	export default value;
}

declare module "*.svg" {
	const value: string;
	export default value;
}
