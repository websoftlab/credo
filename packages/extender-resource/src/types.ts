type Tester = RegExp | ((value: string) => boolean);

export interface ExtendResourceType {
	test?: Tester;
	exclude?: Tester;
	issuer?:
		| Tester
		| {
				not: Tester | Tester[];
		  };
	generator?: {
		filename: string;
	};
	parser?: any;
}

export interface ExtenderResourceOptions {
	image?: boolean | ExtendResourceType;
	font?: boolean | ExtendResourceType;
	svg?: boolean | ExtendResourceType;
}
