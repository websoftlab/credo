
export default class GroupItem {
	property: string = "";
	multiple: boolean = false;
	required: boolean = false;
	br: boolean = false;

	constructor(public name: string, public description: string) {}

	get delta() {
		let delta = 2;
		if(this.name) {
			delta += this.name.length + 2;
		}
		if(this.property) {
			delta += this.property.length + 4;
			if(this.multiple) {
				delta += 6; // ... dots[]
			}
			if(!this.required)  {
				delta += 2;
			}
		}
		return delta;
	}
}
