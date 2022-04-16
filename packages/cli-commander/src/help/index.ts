import type Commander from "../Commander";
import type Command from "../Command";
import Option from "../Option";
import Help from "./Help";
import Group from "./Group";
import GroupItem from "./GroupItem";
import {newError} from "@credo-js/cli-color";
import {commands, titles} from "../constants";

function createGroupItem(option: Option) {
	const item = new GroupItem(option.name, option.description);
	if(option.multiple || option.isSingleValue) {
		item.property = option.propertyName;
		item.required = option.isRequired;
		item.multiple = option.multiple;
	}
	return item;
}

function helpGroup(help: Help, command: Command, option?: Option) {

	const argument = command.commandArgument;
	if(argument) {
		const group = new Group(titles.arguments);
		const item = new GroupItem("", argument.description);
		item.property = argument.propertyName;
		item.required = argument.isRequired;
		item.multiple = argument.multiple;
		group.addItem(item);
		help.addGroup(group);
	}

	const options = command.commandOptionList;
	if(option) {
		options.push(option);
	}

	if(options.length) {
		const group = new Group(titles.options);
		options.forEach(option => {
			group.addItem(createGroupItem(option));
		});
		help.addGroup(group);
	}
}

export async function helpCommand(commander: Commander, commandName: string) {

	const command = commander.commands.find(cmd => cmd.name === commandName);
	if(!command) {
		throw newError(commands.notFound, commandName);
	}

	const help = new Help({
		name: command.name,
		description: command.commandDescription,
		version: command.commandVersion,
		prompt: commander.prompt,
		stream: commander.stream,
	});

	const argument = command.commandArgument;
	if(argument) {
		help.addProp("argument", argument.required, argument.multiple, "blue");
	}

	const options = command.commandOptionList;
	if(options.length) {
		help.addProp("option", options.some(item => item.isRequired), options.length > 1, "yellow");
	}

	helpGroup(help, command);

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

	const helpOption = new Option("--help", {type: ["flag", "value"], name: "command", description: titles.help});
	const root = commander.find("*");
	const group = new Group(titles.commands);

	if(root) {
		helpGroup(help, root, helpOption);
	} else {
		const group = new Group(titles.options);
		group.addItem(createGroupItem(helpOption));
		help.addGroup(group);
	}

	commands.sort((a, b) => {
		const an = a.name.includes(":") ? `--${a.name}` : a.name;
		const bn = b.name.includes(":") ? `--${b.name}` : b.name;
		return an.localeCompare(bn);
	});

	let prevPref = "";
	let prevItem: GroupItem;

	commands.forEach(command => {
		const name = command.name;
		const item = new GroupItem(name, command.commandDescription);
		const prefIndex = name.indexOf(":");
		const pref = prefIndex > 0 ? name.substring(0, prefIndex + 1) : "--";

		if(prevPref !== pref) {
			prevPref = pref;
			if(prevItem) {
				prevItem.br = true;
			}
		}

		const arg = command.commandArgument;
		if(arg) {
			item.property = arg.propertyName;
			item.required = arg.isRequired;
			item.multiple = arg.multiple;
		} else {
			const optionList = command.commandOptionList;
			if(optionList.length) {
				item.property = "option";
				item.required = optionList.some(item => item.isRequired);
				item.multiple = optionList.length > 1;
			}
		}

		prevItem = item;
		group.addItem(item);
	});

	help.addProp("options", true, false, "yellow");
	help.addGroup(group);
	help.print();
}
