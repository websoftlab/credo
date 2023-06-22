# @phragon/extender-sass

Adds the `sass` import to the PhragonJS project. Used only for the webpack builder.

## ❯ Install

```shell
# this is not necessary, once added to the configuration file, the dependencies are installed automatically
$ npm install --save @phragon/extender-sass
```

> Add an extension method to `phragon.config.ts`\
> You must use `sass` with the `css` extender and after the `css` extender!

```typescript
import type { BuilderI } from "phragon";

export default async function config(builder: BuilderI) {
	builder
		// extender
		.extender("css")
		.extender("sass")

		// config
		.phragon
		.lexicon("en")
		.render("react", false)
		.publicPath("./public");
}
```

In typescript or javascript files:

```typescript
import "./file.scss"
```

Or module:

```typescript
import classes from "./file.component.scss"
```
