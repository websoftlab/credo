import type Commander from "../Commander";
import Help from "./Help";
import Group from "./Group";
import GroupItem from "./GroupItem";
import {newError} from "@credo-js/cli-color";
import {commands, titles} from "../constants";

export async function helpCommand(commander: Commander, commandName: string) {

	const command = commander.commands.find(cmd => cmd.name === commandName);
	if(!command) {
		throw newError(commands.notFound, commandName);
	}

	const info = command.info();
	const {argument, options} = info;
	const help = new Help({
		name: info.name,
		description: info.description,
		version: info.version,
		prompt: commander.prompt,
		stream: commander.stream,
	});

	if(argument) {
		help.addProp("argument", argument.required, argument.multiple, "blue");

		const group = new Group("Arguments");
		const item = new GroupItem("", argument.description);
		item.property = argument.propertyName;
		item.required = argument.required;
		item.multiple = argument.multiple;
		group.addItem(item);
		help.addGroup(group);
	}

	if(options.length) {
		help.addProp("option", options.some(item => item.required), options.length > 1, "yellow");

		const group = new Group("Options");
		options.forEach(option => {
			const item = new GroupItem(option.name, option.description);
			if(option.multiple || option.isSingleValue) {
				item.property = option.propertyName;
				item.required = option.required;
				item.multiple = option.multiple;
			}
			group.addItem(item);
		});

		help.addGroup(group);
	}

	help.print();
}

export async function helpCommandList(commander: Commander) {

	const commands = commander.commands;
	const help = new Help({
		description: commander.description,
		prompt: commander.prompt,
		stream: commander.stream,
		version: commander.version,
	});

	const groupOptions = new Group(titles.options);
	const groupCommands = new Group(titles.commands);

	const groupHelpItem = new GroupItem("--help", titles.help);
	groupHelpItem.property = "command";

	groupOptions.addItem(groupHelpItem);

	commands.sort((a, b) => {
		const an = a.name.includes(":") ? `--${a.name}` : a.name;
		const bn = b.name.includes(":") ? `--${b.name}` : b.name;
		return an.localeCompare(bn);
	});

	let prevPref = "";
	let prevItem: GroupItem;

	commands.forEach(command => {
		const info = command.info();
		const name = info.name;
		const item = new GroupItem(name, info.description);
		const prefIndex = name.indexOf(":");
		const pref = prefIndex > 0 ? name.substring(0, prefIndex + 1) : "--";

		if(prevPref !== pref) {
			prevPref = pref;
			if(prevItem) {
				prevItem.br = true;
			}
		}

		if(info.argument) {
			item.property = info.argument.propertyName;
			item.required = info.argument.required;
			item.multiple = info.argument.multiple;
		} else if(info.options.length) {
			item.property = "option";
			item.required = info.options.some(item => item.required);
			item.multiple = info.options.length > 1;
		}

		prevItem = item;
		groupCommands.addItem(item);
	});

	help.addProp("options", true, false, "yellow");
	help.addGroup(groupOptions);
	help.addGroup(groupCommands);
	help.print();
}
