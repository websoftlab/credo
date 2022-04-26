# @phragon/path-to-pattern

The project is under construction, the description will be later

## ❯ Install

```
$ npm install --save @phragon/plugin-orm
```

Example:

```javascript
pathToPattern("/:id"); // eq. "/all" -> {id: "all"}
pathToPattern("/:language|in(ru,en,fr)/*"); // eq. "/ru/any/123" -> {language: "ru", "*": ["any", "123"]}
pathToPattern("/s-1/s-2/:name?"); // eq. "/s-1/s-2" -> {} or "/s-1/s-2/abc" -> {name: "abc"}

// escape

// spetial chars :,?|{}()

// :keyName
// :keyName? - optional
// {prefix:keyNameInGroup\suffix}
// :keyName|modifier(arg1,arg2,arg3)
pathToPattern("/segment\:id/more/:id"); // eq. "/segment:id/more/abc" -> {id: "abc"}

// group

pathToPattern("/{prefix:id|d}{-:category?|d}"); // eq. "/1" -> {id: 1} or "/1-3" -> {id: 1, category: 3}

// modifiers

pathToPattern("/:id|d"); // only number from 0 to infinity
pathToPattern("/:id|r(1,20)"); // number from 1 to 20
pathToPattern("/:id|dIn(1,2,3,4)"); // number only 1,2,3,4
pathToPattern("/:id|n(5,7,-)"); // number with length from 5 to 7 with symbol - exm. "/01234" "/123-23-23"
```

## Functions

```typescript
declare function addModifier(name: string, options: AddModifierOptions): void;
declare function compilePath<R = any>(path: string): PatternInterface<R>;
declare function matchPath(path: string | PatternInterface, pathname: string, options?: MatchOptions): any;
declare function matchToPath<R = any>(path: string | PatternInterface, options?: ReplaceOptions<R>): string;
declare function pathToPattern<R = any>(path: string, options?: PathToPatternOptions): PatternInterface<R>;
```

## Modifiers

The parameter can have a modifier. Added after specifying the name through the sign `|`

#### Variant
```
/path/:id|d         ->  { id: number }
/path/:id?|d        ->  { id?: number }
/:lang|in(ru,en)/*  ->  { lang: "ru" | "en", "*": string[] }
```

### The `n` modifier

String consisting of numbers

> RegExp: `[0-9]+`

#### Variant
```
:name|n
:name|n(length: number)
:name|n(min: number, max: number)
:name|n(min: number, max: number, with_chars: string)
```

### The `d` modifier

Positive number from zero or more

> RegExp: `0|[1-9][0-9]*`

### The `l` modifier

Lower case

> RegExp: `[a-z]+`

### The `u` modifier

Upper case

> RegExp: `[A-Z]+`

### The `w` modifier

Letters, numbers, sign `_` and `-`

> RegExp: `[a-zA-Z0-9_\-]+`

### The `wl` modifier

Lower case, numbers, sign `_` and `-`

> RegExp: `[a-z0-9_\-]+`

### The `wu` modifier

Upper case, numbers, sign `_` and `-`

> RegExp: `[A-Z0-9_\-]+`

### The `in` & `dIn` modifier

List of choices

#### Variant
```
:name|in(... args: string[])
:name|dIn(... args: number[])
```

> RegExp: `.+?` & `0|[1-9][0-9]*`

### The `not` & `dNot` modifier

All choices except the specified list

#### Variant
```
:name|not(... args: string[])
:name|dNot(... args: number[])
```

> RegExp: `.+?` & `0|[1-9][0-9]*`

### The `uuid` modifier

UUID string, lowercase only or UPPERCASE only

> RegExp: `[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}|[0-9A-F]{8}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{12}`

### The `date` modifier

Date string

> RegExp: `.+?`

#### Variant
```
:name|date(format?: string, timezone_offset?: string)
:name|date
:name|date(c)
:name|date(U)
```

| Symbol  | Description | Example |
|---------|-------------|---------|
| `c`     | ISO 8601 date | 2004-02-12T15:19:21+00:00 |
| `U`     | Seconds since the Unix Epoch (January 1 1970 00:00:00 GMT) | |
| `d`     | Day of the month, 2 digits with leading zeros | 01 to 31 |
| `j`     | Day of the month without leading zeros | 1 to 31 |
| `m`     | Numeric representation of a month, with leading zeros | 01 through 12 |
| `n`     | Numeric representation of a month, without leading zeros | 1 through 12 |
| `Y`     | A full numeric representation of a year, 4 digits | Examples: 1999 or 2003 |
| `y`     | A two digit representation of a year | Examples: 99 or 03 |
| `a`     | Lowercase Ante meridiem and Post meridiem | am or pm |
| `A`     | Uppercase Ante meridiem and Post meridiem | AM or PM |
| `g`     | 12-hour format of an hour without leading zeros | 1 through 12 |
| `G`     | 24-hour format of an hour without leading zeros | 0 through 23 |
| `h`     | 12-hour format of an hour with leading zeros | 01 through 12 |
| `H`     | 24-hour format of an hour with leading zeros | 00 through 23 |
| `i`     | Minutes with leading zeros | 00 to 59 |
| `s`     | Seconds with leading zeros | 00 through 59 |
| `u`     | Microseconds | Example: 654321 |
| `v`     | Milliseconds | Example: 654 |
| `O`     | Difference to Greenwich time (GMT) without colon between hours and minutes | Example: +0200 |
| `P`     | Difference to Greenwich time (GMT) with colon between hours and minutes | Example: +02:00 |
| `-` `:` | Special chars | `date(d-m-Y\ H:i:s)` |
| `\\`    | Escape all symbol | `\d` |

### The `reg` modifier

Regular expression. Returns a string or math/array result if the regular expression includes groups

#### Variant
```
:reg|not(... args: string[])
```

> RegExp: `.+?`
