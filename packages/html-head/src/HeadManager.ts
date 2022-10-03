import type { HeadTag, HeadTagWithKey } from "./types";

function generateKey(prefix: string) {
	return `${prefix}--${Math.random().toString(36).substring(2)}`;
}

function find(headTags: HeadTagWithKey[], key: string): number {
	return headTags.findIndex((node) => node.key === key);
}

export default class HeadManager {
	constructor(public server: boolean, public headTags: HeadTagWithKey[]) {}

	addClientTag(originNode: HeadTag) {
		const { type } = originNode;
		const { headTags } = this;
		const node: HeadTagWithKey = { key: generateKey(type), renderable: false, ...originNode };

		headTags.push(node);

		return node.key;
	}

	removeClientTag(key: string) {
		const { headTags } = this;
		const found = find(headTags, key);
		if (found !== -1) {
			headTags.splice(found, 1);
		}
	}

	shouldRenderTag(key: string) {
		const { headTags } = this;
		const tag = headTags.find((tag) => tag.key === key);
		if (!tag) {
			return false;
		}
		if (tag.renderable) {
			return true;
		}
		if (
			tag.singleton &&
			headTags.some((headTag) => headTag.singleton && headTag.renderable && headTag.type === tag.type)
		) {
			return false;
		}
		tag.renderable = true;
		return true;
	}

	addServerTag(node: HeadTag): string | null {
		const { headTags } = this;
		const { type, singleton } = node;

		for (let i = 0; i < headTags.length; i++) {
			const tag = headTags[i];
			if (tag.type === type && singleton) {
				return null;
			}
		}

		const key = generateKey(type);
		headTags.push({ key, renderable: false, ...node });

		return key;
	}

	reset() {
		this.headTags.forEach((tag) => {
			tag.renderable = false;
		});
	}
}
