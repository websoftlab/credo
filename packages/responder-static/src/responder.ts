import type {CredoJS, Ctor} from "@credo-js/server";
import type {Context, Next} from "koa";
import type {ResponderStaticOptions, StaticCtorConfig} from "./types";
import type {Stats} from "fs";
import {basename, extname, join, normalize, parse, resolve, sep} from "path";
import resolvePath from "resolve-path";
import fsPromises from "fs/promises";
import createError from "http-errors";
import fs from "fs";

type ReadPathFound = {
	stats: Stats;
	path: string;
	contentEncoding: string;
	removeContentLength: boolean;
	encodingExt: string;
};

type ReadPath =
	false |
	ReadPathFound |
	{
		code: number;
		message: string;
	};

async function exists(path: string) {
	try {
		await fsPromises.access(path);
	} catch (e) {
		return false;
	}
	return true;
}

/**
 * Check if it's hidden.
 */
function isHidden(root: string, fromPath: string) {
	const path = fromPath.substring(root.length).split(sep);
	for (let i = 0; i < path.length; i++) {
		if (path[i][0] === '.') {
			return true;
		}
	}
	return false;
}

function type(file: string, ext: string) {
	return ext !== '' ? extname(basename(file, ext)) : extname(file);
}

function decode(path: string): string | false {
	try {
		return decodeURIComponent(path);
	} catch (err) {
		return false;
	}
}

function cwd(file: string) {
	return join(process.cwd(), file);
}

export default (function responder(credo: CredoJS, name: string, config: StaticCtorConfig = {}) {

	const options = credo.config<ResponderStaticOptions>(`responder/${name}`);
	const {
		exclude: excludePath = [],
		root: configRoot
	} = options;
	const {
		publicPath = [],
	} = config;

	let root: string[] = publicPath.slice();
	if(configRoot) {
		if(typeof configRoot === "string") {
			root.push(configRoot);
		} else if(Array.isArray(configRoot)) {
			root = root.concat(configRoot);
		}
	}

	if(!root.length) {
		root.push(cwd("/public"));
	}

	let exclude: Array<string | RegExp | ((path: string) => boolean)> = Array.isArray(excludePath) ? excludePath.slice() : (excludePath ? [excludePath] : []);

	// add client directory
	if(credo.renderHTMLDriver) {
		const mid = credo.process?.mid;
		const clientPath: string = cwd(`${__BUNDLE__}/client${mid ? `-${mid}` : ""}`);
		const clientPrivate: string = clientPath + sep + ".";
		const clientManifest: string = join(clientPath, `/manifest.json`);
		root.unshift(clientPath);
		exclude.unshift((path: string) => (path === clientManifest || path.startsWith(clientPrivate)));
	}

	const rootTree = root.map(rootPoint => normalize(resolve(rootPoint)));
	const excludeTree = exclude.map(excludePoint => {
		if(excludePoint instanceof RegExp) {
			return (path: string) => excludePoint.test(path);
		} else if(typeof excludePoint === "function") {
			return excludePoint;
		} else {
			return (path: string) => path === excludePoint;
		}
	});

	const index = options.index === true ? "index.html" : options.index;
	const maxAge = options.maxAge || 0;
	const immutable = options.immutable || false;
	const hidden = options.hidden || false;
	const format = options.format !== false;
	const brotli = options.brotli !== false;
	const gzip = options.gzip !== false;

	let extensions: string[] | false = Array.isArray(options.extensions) ? options.extensions : false;
	if(extensions) {
		extensions = extensions.map(ext => {
			if (typeof ext !== "string") {
				throw new TypeError('Option extensions must be array of strings or false');
			}
			if (!/^\./.exec(ext)) {
				ext = `.${ext}`;
			}
			return ext;
		});
	}

	const readPath = async (ctx: Context, root: string): Promise<ReadPath> => {
		let readPath = ctx.path;
		const trailingSlash = readPath[readPath.length - 1] === "/";

		readPath = readPath.substring(parse(readPath).root.length);

		// normalize path
		let path = decode(readPath);
		if (path === false) {
			return {
				code: 400,
				message: 'Failed to decode',
			};
		}

		// index file support
		if (index && trailingSlash) {
			path += index;
		}

		path = resolvePath(root, path);

		// hidden file support, ignore
		if (!hidden && isHidden(root, path)) {
			return false;
		}

		let encodingExt = "";
		let contentEncoding = "";
		let removeContentLength = false;

		// serve brotli file when possible otherwise gzipped file when possible
		if (ctx.acceptsEncodings('br', 'identity') === 'br' && brotli && (await exists(`${path}.br`))) {
			path = `${path}.br`;
			contentEncoding = "br";
			removeContentLength = true;
			encodingExt = ".br";
		} else if (ctx.acceptsEncodings('gzip', 'identity') === 'gzip' && gzip && (await exists(`${path}.gz`))) {
			path = `${path}.gz`;
			contentEncoding = "gzip";
			removeContentLength = true;
			encodingExt = ".gz";
		}

		if (extensions && !/\./.exec(basename(path))) {
			for (let i = 0; i < extensions.length; i++) {
				const pathExt = `${path}${extensions[i]}`;
				if (await exists(pathExt)) {
					path = pathExt;
					break;
				}
			}
		}

		// stat
		let stats: Stats;
		try {
			stats = await fsPromises.stat(path);

			// Format the path to serve static file servers
			// and not require a trailing slash for directories,
			// so that you can do both `/directory` and `/directory/`
			if (stats.isDirectory()) {
				if (format && index) {
					path += `/${index}`;
					stats = await fsPromises.stat(path);
				} else {
					return false;
				}
			}
		} catch (err: any) {
			const notfound = ['ENOENT', 'ENAMETOOLONG', 'ENOTDIR'];
			if (notfound.includes(err.code)) {
				throw createError(404, err);
			}
			err.status = 500;
			throw err;
		}

		// check exclude
		if(excludeTree.some(func => func(path as string))) {
			return false;
		}

		return {
			path,
			stats,
			contentEncoding,
			removeContentLength,
			encodingExt,
		};
	};

	async function responder(ctx: Context, data: ReadPathFound) {
		const {
			path,
			stats,
			contentEncoding,
			removeContentLength,
			encodingExt,
		} = data;

		if(contentEncoding) {
			ctx.set('Content-Encoding', contentEncoding);
		}

		if(removeContentLength) {
			ctx.remove('Content-Length');
		} else {
			// stream
			ctx.set('Content-Length', String(stats.size));
		}

		if (!ctx.response.get('Last-Modified')) {
			ctx.set('Last-Modified', stats.mtime.toUTCString());
		}

		if (!ctx.response.get('Cache-Control')) {
			let directives = `max-age=${(maxAge / 1000 | 0)}`;
			if (immutable) {
				directives += ',immutable';
			}
			ctx.set('Cache-Control', directives);
		}

		ctx.bodyEnd(
			fs.createReadStream(path),
			undefined,
			ctx.type ? undefined : type(path, encodingExt)
		);
	}

	return {
		name,
		depth: -10,
		async middleware(ctx: Context, next: Next) {
			if(ctx.isBodyEnded || ctx.route || !["HEAD", "GET"].includes(ctx.method)) {
				return next();
			}

			let found: ReadPath = false;
			for(let i = 0; i < rootTree.length; i++) {
				try {
					found = await readPath(ctx, rootTree[i]);
				} catch (err: any) {
					if (err.status !== 404) {
						throw err;
					}
				}
			}

			if(!found) {
				return next();
			}

			if("code" in found) {
				return ctx.throw(found.code, found.message);
			}

			// set router point
			ctx.route = {
				name: `file:${ctx.path}`,
				controller: {
					name: Symbol(),
					handler() { return found; },
				},
				responder: {
					name,
				},
			};

			return next();
		},
		responder,
	};
}) as Ctor.Responder<StaticCtorConfig>;