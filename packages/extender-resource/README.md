# @phragon/extender-resource

Adds the images and fonts import to the PhragonJS project. Used only for the webpack builder.

## ❯ Install

```shell
# this is not necessary, once added to the configuration file, the dependencies are installed automatically
$ npm install --save @phragon/extender-resource
```

> Add an extension method to `phragon.config.ts`\

```typescript
import type { BuilderI } from "phragon";

export default async function config(builder: BuilderI) {
	builder
		// extender
		.extender("resource")

		// config
		.phragon
		.lexicon("en")
		.render("react", false)
		.publicPath("./public");
}
```
