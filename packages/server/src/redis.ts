import redis from "redis";
import { debug } from "@credo-js/cli-debug";
import type { RedisClientType, RedisClientOptions } from "redis";

// redis://alice:foobared@awesome.redis.server:6380
// redis[s]://[[username][:password]@][host][:port][/db-number]

const defaultClientOptions: RedisClientOptions = {
	url: `redis://${process.env.REDIS_HOST || "127.0.0.1"}:${process.env.REDIS_PORT || 6379}`,
};
let redisClient: RedisClientType | null = null;
let clientOptions: RedisClientOptions = defaultClientOptions;

// default ttl value - 2 hour
const DEFAULT_TTL: number = 3600 * 2;
const REDIS_OPTIONS = Symbol("redis.options");
const connections: Record<string | symbol, RedisClientType> = {};

function createClient(options: RedisClientOptions) {
	try {
		return redis.createClient(options);
	} catch (err) {
		error(err as Error);
		throw new Error("Redis client connection error");
	}
}

function getClient(): RedisClientType {
	if (!redisClient) {
		redisClient = createClient(clientOptions);
	}
	return redisClient;
}

function getClientFromConnection(obj: RedisConnection): RedisClientType {
	const opt = obj[REDIS_OPTIONS];
	if (!opt.unique) {
		return getClient();
	}
	const { name, clientOptions } = opt;
	if (!connections[name]) {
		connections[name] = createClient({
			...defaultClientOptions,
			...clientOptions,
		});
	}
	return connections[name];
}

function error(err: Error) {
	debug.error("Redis cache failure", err);
}

export type RedisCacheReadBuilder<T> = () => Promise<T>;

export interface RedisCacheOptions<T> {
	ttl?: number;
	cacheable?: (data: T) => boolean;
	readFromCache?: () => void;
}

export interface RedisCacheInterface {
	data<T = any>(name: string): Promise<T>;
	save<T = any>(name: string, data: T, options?: Omit<RedisCacheOptions<T>, "cacheable">): void;
	read<T = any>(name: string, builder: RedisCacheReadBuilder<T>, options?: RedisCacheOptions<T>): Promise<T>;
	clear(...args: string[]): void;
	clear(keys: string[]): void;
}

export interface RedisStoreInterface {
	get<T = any>(name: string): Promise<T | null>;
	set(name: string, data: any, ttl?: number): Promise<void>;
	destroy(name: string): Promise<number>;
}

async function redisGet<T = any>(obj: RedisConnection, name: string, throwable: boolean = false): Promise<T> {
	let data: any = null;
	try {
		const value = await getClientFromConnection(obj).get(name);
		if (typeof value === "string") {
			data = JSON.parse(value);
		}
	} catch (err) {
		error(err as Error);
		if (throwable) {
			throw err;
		}
	}
	return data;
}

async function redisSet(obj: RedisConnection, name: string, data: any, ttl?: number) {
	if (data != null) {
		await getClientFromConnection(obj).set(name, JSON.stringify(data), {
			EX: ttl || DEFAULT_TTL,
		});
	}
}

async function redisQuit(name: string | symbol | null) {
	const client = name ? connections[name] : redisClient;
	if (!client) {
		return;
	}
	try {
		await client.quit();
	} finally {
		if (name) {
			delete connections[name];
		} else {
			redisClient = null;
		}
	}
}

interface RedisConnectionOptions {
	unique: boolean;
	name: string | symbol;
	clientOptions: RedisClientOptions;
}

export interface RedisOptions extends Partial<RedisConnectionOptions> {}

abstract class RedisConnection {
	readonly connected!: boolean;

	[REDIS_OPTIONS]: RedisConnectionOptions;

	protected constructor(options: RedisOptions) {
		const { name = Symbol(), unique = false, clientOptions = {} } = options;
		this[REDIS_OPTIONS] = { name, unique, clientOptions };
		Object.defineProperty(this, "connected", {
			enumerable: true,
			get() {
				return getClientFromConnection(this).isOpen;
			},
		});
	}

	getClient() {
		return getClientFromConnection(this);
	}

	async quit() {
		const { unique, name } = this[REDIS_OPTIONS];
		if (unique) {
			await redisQuit(name);
		}
	}
}

class RedisCache extends RedisConnection implements RedisCacheInterface {
	constructor(options: RedisOptions = {}) {
		super(options);
	}

	async data<T = any>(name: string): Promise<T> {
		return redisGet<T>(this, name);
	}

	save<T = any>(
		name: string,
		data: T,
		options: Omit<RedisCacheOptions<T>, "cacheable" | "readFromCache"> = {}
	): void {
		redisSet(this, name, data, options.ttl).catch(error);
	}

	async read<T = any>(
		name: string,
		builder: RedisCacheReadBuilder<T>,
		options: RedisCacheOptions<T> = {}
	): Promise<T> {
		if (typeof builder !== "function") {
			throw new Error("Cache compiler is not function");
		}

		const { ttl = DEFAULT_TTL, readFromCache, cacheable } = options;

		let data: any = null;
		try {
			data = await redisGet(this, name, true);
		} catch (err) {
			return builder();
		}

		if (!data) {
			data = await builder();
			if (data == null) {
				return data;
			}

			// cacheable off ?
			if (typeof cacheable === "function" && !cacheable(data)) {
				return data;
			}

			redisSet(this, name, data, ttl).catch(error);
		} else if (typeof readFromCache === "function") {
			readFromCache();
		}

		return data;
	}

	clear(...args: string[] | [string[]]): void {
		if (!args.length) {
			// clear all
			getClientFromConnection(this).flushDb().catch(error);
		} else {
			if (args.length === 1 && Array.isArray(args[0])) {
				args = args[0];
			}

			const remove = async (keys: string | string[]) => {
				if (Array.isArray(keys)) {
					if (keys.length) {
						return getClientFromConnection(this).del(keys);
					}
				} else {
					return getClientFromConnection(this).del(keys);
				}
			};

			const clear = (keys: string | string[] | [string[]]) => {
				if (Array.isArray(keys)) {
					keys.forEach((item: string | string[]) => {
						if (Array.isArray(item)) {
							clear(item);
						} else if (item.includes("*")) {
							// remove by pattern
							getClientFromConnection(this).keys(item).then(remove).catch(error);
						} else {
							remove(item).catch(error);
						}
					});
				} else if (typeof keys === "string") {
					remove(keys).catch(error);
				}
			};

			// clear
			clear(args);
		}
	}
}

class RedisStore extends RedisConnection implements RedisStoreInterface {
	constructor(options: RedisOptions = {}) {
		super(options);
	}
	async get(name: string) {
		return redisGet(this, name);
	}
	async set(name: string, data: any, ttl?: number) {
		return redisSet(this, name, data, ttl);
	}
	async destroy(name: string) {
		return getClientFromConnection(this).del(name);
	}
}

function init(options: RedisClientOptions) {
	clientOptions = {
		...defaultClientOptions,
		...options,
	};
}

async function quit(forAll: boolean = false) {
	await redisQuit(null);
	if (forAll) {
		await Promise.all(Object.keys(connections).map((name) => redisQuit(name)));
	}
}

const redisStore = new RedisStore();
const redisCache = new RedisCache();

export { RedisStore, RedisCache, redisStore as store, redisCache as cache, init, quit, getClient };
