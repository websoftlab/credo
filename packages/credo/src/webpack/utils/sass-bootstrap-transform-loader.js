const {join: joinPath, extname} = require("path");
const {existsSync} = require("fs");
const loaderUtils = require('loader-utils');

module.exports = function sassBootstrapTransformLoader(srcContent) {
	const loaderOptions = loaderUtils.getOptions(this);

	let { sassBootstrapTransformLoader: compilerOptions = {} } = this.options || {};
	if (typeof compilerOptions === 'function') {
		compilerOptions = compilerOptions.call(this, this);
	}

	const { pack = 'default' } = loaderOptions;

	const options = {
		... (pack in compilerOptions ? compilerOptions[pack] : compilerOptions),
		... loaderOptions,
	};

	if (typeof this.cacheable === 'function') {
		this.cacheable(!compilerOptions.noCache);
	}

	const { cwdPath } = options;
	const bootstrap = ["bootstrap.scss", "_bootstrap.scss", "bootstrap.sass", "_bootstrap.sass"].find(file => {
		return existsSync(joinPath(cwdPath, "pages", file));
	});

	if(!bootstrap) {
		return srcContent;
	}

	let text = String(srcContent);
	let append = `@import "pages/${bootstrap}"`;
	const isScss = extname(this.resourcePath).toLowerCase() === ".scss";
	if(isScss) {
		append += ";";
	}

	let br = '\n';
	if(text.indexOf('\r\n') !== -1) {
		br = '\r\n';
	} else if(text.indexOf(br) === -1 && text.indexOf('\r') !== -1) {
		br = '\r';
	}

	let index = -1;
	let ps = 0;
	top: while(true) {
		const start = text.indexOf('@use ', ps);
		if(start === -1) {
			break;
		}

		for(let i = start - 1; i > -1; i--) {
			const val = text.charAt(i);
			if(val === " " || val === "\t") continue;
			if(val === "\r" || val === "\n" || isScss && val === ";") break;

			ps = start + 1;
			continue top;
		}

		index = start;
		ps = start + 1;
	}

	if(index === -1) {
		text = `${append}${br}${text}`;
	} else {

		if(isScss) {
			let firstLine = text.substring(0, index);
			let lastLine = text.substring(index);
			const match = lastLine.match(/^@use\s+[^\r\n]+;/);
			if(match) {
				return firstLine + match[0] + br + append + lastLine.substring(match[0].length);
			}
		}

		const endR = text.indexOf('\r', index);
		const endN = text.indexOf('\n', index);
		if(endR === endN) {
			text += br + append;
		} else {
			if(endR > index) {
				index = endR;
			}
			if(endN > index &&(endR === -1 || endR + 1 === endN)) {
				index = endN;
			}
			text = `${text.substring(0, index)}${br}${append}${text.substring(index)}`;
		}
	}

	return text;
};