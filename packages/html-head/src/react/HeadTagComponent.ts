import React from 'react';
import ReactDOM from 'react-dom';
import { Consumer } from './context';
import type HeadManager from "../HeadManager";
import type {HeadTagName} from "../types";

function createHeadTag(headTag: HeadTagComponent) {
	const {singleton, tagName, typeName, props} =  headTag;
	return {
		type: typeName,
		props,
		tagName,
		singleton,
	};
}

export default abstract class HeadTagComponent extends React.Component {

	abstract typeName: HeadTagName;
	abstract tagName: string;
	abstract singleton: boolean;

	manager: HeadManager | null = null;
	index: number = -1;
	state = {
		canUseDOM: false,
	};

	componentDidMount() {
		if(this.manager) {
			this.setState({ canUseDOM: true });
			this.index = this.manager.addClientTag(createHeadTag(this));
		}
	}

	componentWillUnmount() {
		if(this.manager) {
			this.manager.removeClientTag(this.typeName, this.index);
		}
	}

	render() {
		const { typeName, tagName, props, index } = this;
		const { canUseDOM } = this.state;

		return React.createElement(Consumer, null, (manager?: HeadManager) => {
			if (!manager) {
				throw Error('HeadManager is not initialized.');
			}

			this.manager = manager;

			if (canUseDOM) {
				if (!manager.shouldRenderTag(typeName, index)) {
					return null;
				}
				return ReactDOM.createPortal(React.createElement(tagName, props), document.head);
			}

			if(typeof window === "undefined") {
				manager.addServerTag(createHeadTag(this));
			}

			return null;
		});
	}
}