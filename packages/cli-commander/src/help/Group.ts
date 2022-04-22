import type GroupItem from "./GroupItem";

export default class Group {
	items: GroupItem[] = [];

	constructor(public name: string) {}

	addItem(item: GroupItem) {
		this.items.push(item);
	}

	get delta() {
		let calc = 0;
		this.items.forEach((item) => {
			const delta = item.delta;
			if (delta > calc) {
				calc = delta;
			}
		});
		return calc;
	}
}
