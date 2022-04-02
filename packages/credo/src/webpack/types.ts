export type BuildLoaderRule = string | {
	loader: string;
	options?: Record<string, any>;
}

type Tester = RegExp | ((value: string) => boolean);

type BuildBaseRule<E> = E & {
	test?: Tester;
	exclude?: Tester;
	issuer?: Tester | {
		not: Tester | Tester[]
	};
};

export type BuildRule =
	BuildBaseRule<{
		use: BuildLoaderRule | BuildLoaderRule[];
	}> |
	BuildBaseRule<{
		type: string;
		parser?: any;
		generator?: {
			filename: string;
		}
	}> |
	BuildBaseRule<BuildLoaderRule>;
