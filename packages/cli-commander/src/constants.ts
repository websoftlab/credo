
export const commands = {
	notFound: "The {cyan %s} command not found",
	duplicateName: "Duplicate command name {cyan %s}",
	duplicateAction: "The command action already defined",
	actionFunctionType: "The command action must be a function",
	actionNotDefined: "The {cyan %s} command action is not defined",
};

export const opts = {
	onlyOne: "Only one value allowed for option {cyan %s}",
	tooMany: "Too many values for {cyan %s} option",
	flagOnly: "The {cyan %s} flag must not contain a value",
	valuable: "Expected value for the {cyan %s} option",
	unknown: "Unknown {cyan %s} request option",
	duplicate: "The command option {cyan %s} already defined",
	duplicateAlt: "Duplicate alternative option name {%s cyan}",
	required: "Option value {cyan %s} {yellow <...>} required",
	invalidName: "Invalid command option name {red %s}, expected {cyan --?[\\w-]+}",
	invalidValue: "Invalid {cyan %s} option value",
	invalidType: "Invalid option type {cyan %s}",
	notAllowed: "%s {cyan %s} option not allowed",
	notEnough: "Not enough values for option {cyan %s} {yellow <...>}",
	valueTypeConflict: "Can't use type {cyan value} and {cyan multiple} at the same time",
};

export const args = {
	notEnough: "Not enough arguments",
	onlyOne: "Only one argument allowed",
	tooMany: "Too many arguments",
	duplicate: "The command argument options already defined",
	unknown: "Unknown {cyan %s} request argument",
	required: "Command argument required",
};

export const formats = {
	optionError: "The option value {cyan %s} {{color} <%s>} of index {yellow %s} %s",
	argumentError: "The argument value {red <%s>} at index {yellow %s} %s",
	empty: "is empty",
	emptyError: "The argument value at index {yellow %s} %s",
	invalid: "is invalid",
	invalidTime: "must be a valid time range (number or string [0-9](ms|s|m|h|d|w|mn|y) separated by space)",
	invalidPort: "must be a port number (ranging from 0 to 65535)",
	invalidNumber: "must be a number",
	invalidBoolean: "must be yes or no",
	invalidType: "Invalid format type",
};

export const titles = {
	error: "Error!",
	warning: "Warning!",
	options: "Options",
	commands: "Commands",
	help: "Display help",
};