# @phragon/extender-prettier

Adds the `prettier` formatter to the PhragonJS project.

## ❯ Install

```shell
# this is not necessary, once added to the configuration file, the dependencies are installed automatically
$ npm install --save @phragon/extender-prettier
```

## Usage

> Add an extension method to `phragon.config.ts`\
> If you want to use the `prettier` version installed globally, add to the configuration: `{ version: "global" }`

```typescript
import type { BuilderI } from "phragon";
import type { ExtenderPrettierOptions } from "@phragon/extender-prettier";

export default async function config(builder: BuilderI) {
	builder
		// extender
		.extender("prettier", {
			parser: [/* additional extension */],
			// version: "global" | "latest" | "^2.7.1"
		} as ExtenderPrettierOptions)

		// config
		.phragon
		.lexicon("en")
		.render("react", false)
		.publicPath("./public");
}
```
