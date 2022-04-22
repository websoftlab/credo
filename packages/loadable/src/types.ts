export type Initializer = () => Promise<void>;

export type Loader<T = any> = () => Promise<T>;

export type FallbackHandler<Element, Props = any> = (props: Props) => Element;

export type RenderHandler<Element, Result = any, Props = any> = (loadResult: Result, props: Props) => Element;

export interface Options<Element, FallbackProps> {
	name: string;
	loader: Loader | Loader[] | Record<string, Loader>;
	throwable?: boolean;
	fallback?: FallbackHandler<Element, FallbackProps>;
	delay?: number | null;
	timeout?: number | null;
	render?: RenderHandler<Element>;
}

export interface ObserverOptions<Element, FallbackProps> {
	name: string;
	init(): Promise<any>;
	isDone(): boolean;
	isLoading(): boolean;
	reset(): void;
	done(error: Error | false, props: any, createFallbackProps: (err: Error | false) => FallbackProps): Element;
	delay?: null | number;
	timeout?: null | number;
}

export interface CreateLoadableOptions<Type, Element, FallbackProps> {
	render: RenderHandler<Element>;
	fallback: FallbackHandler<Element>;
	observer(options: ObserverOptions<Element, FallbackProps>): Type;
}

export interface Loadable<Type, Element, FallbackProps> {
	load(name: string | string[]): Promise<void>;
	loadAll(depth?: number): Promise<void>;
	defined(name: string): boolean;
	loaded(name: string): boolean;
	definedComponents(): string[];
	loadedComponents(): string[];
	component(name: string): Type;
	loadable(options: Options<Element, FallbackProps>): Type;
	reset(name: string | string[]): number;
	resetAll(): number;
}
