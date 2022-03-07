import type {HeadTag, HeadTagName} from "./types";

const attr: Record<HeadTagName, string[]> = {
	title: [
		"children"
	],
	base: [
		"href"
	],
	charset: [
		"charset"
	],
	viewport: [
		"content"
	],
	link: [
		"href",
		"media",
		"rel",
		"sizes",
		"type",
	],
	meta: [
		"name",
		"property",
		"httpEquiv",
		"content",
	],
	style: [
		"children"
	]
};

function hash(node: HeadTag) {
	const {type, props} = node;
	const forHash: any = {};
	(attr[type] || []).forEach(name => {
		if(props[name] != null) {
			forHash[name] = props[name];
		}
	});
	return JSON.stringify(forHash);
}

function compare(node1: HeadTag, node2: HeadTag) {
	return hash(node1) === hash(node2);
}

function find(headTags: HeadTag[], type: HeadTagName, index: number): number {
	for(let i = 0; i < headTags.length; i++) {
		const tag = headTags[i];
		if(tag.type === type && (tag as any)[indexKey] == index) {
			return i;
		}
	}
	return -1;
}

const indexKey = Symbol();

export default class HeadManager {

	_lastIndex: number = 1;

	constructor(public headTags: HeadTag[]) {}

	addClientTag(node: HeadTag) {

		const {headTags} = this;
		const {type, singleton} = node;

		// search unique or exists tag
		for(let i = 0; i < headTags.length; i++) {
			const tag = headTags[i];
			if(tag.type === type && (singleton || compare(tag, node))) {
				return -1;
			}
		}

		const index = this._lastIndex ++;
		(node as any)[indexKey] = index;

		headTags.push(node);

		return index;
	}

	shouldRenderTag(type: HeadTagName, index: number) {
		const {headTags} = this;
		return find(headTags, type, index) !== -1;
	}

	removeClientTag(type: HeadTagName, index: number) {
		const {headTags} = this;
		const found = find(headTags, type, index);
		if(found !== -1) {
			headTags.splice(found, 1);
		}
	}

	addServerTag(node: HeadTag) {
		const {headTags} = this;
		const {type, singleton} = node;

		for(let i = 0; i < headTags.length; i++) {
			const tag = headTags[i];
			if(tag.type === type) {
				if(singleton || compare(tag, node)) {
					return;
				}
			}
		}

		headTags.push(node);
	}
}