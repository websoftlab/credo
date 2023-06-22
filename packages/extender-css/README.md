# @phragon/extender-css

Adds the `css` import to the PhragonJS project. Used only for the webpack builder.

## ❯ Install

```shell
# this is not necessary, once added to the configuration file, the dependencies are installed automatically
$ npm install --save @phragon/extender-css
```

## Usage

> Add an extension method to `phragon.config.ts`

```typescript
import type { BuilderI } from "phragon";

export default async function config(builder: BuilderI) {
	builder
		// extender
		.extender("css")

		// config
		.phragon
		.lexicon("en")
		.render("react", false)
		.publicPath("./public");
}
```

In typescript or javascript files:

```typescript
import "./file.css"
```

Or module:

```typescript
import classes from "./file.component.css"
```
