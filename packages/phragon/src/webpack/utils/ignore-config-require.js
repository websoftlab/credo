class IgnoreConfigRequire {
	apply (compiler) {
		compiler.hooks.normalModuleFactory.tap('IgnoreDynamicRequire', factory => {
			factory.hooks.parser.for('javascript/auto').tap('IgnoreDynamicRequire', (parser, options) => {
				parser.hooks.call.for('require').tap('IgnoreDynamicRequire', expression => {
					if(
						expression.type === "CallExpression" &&
						expression.arguments.length === 1 &&
						expression.callee.type === "Identifier" &&
						expression.callee.name === "require" &&
						expression.arguments[0].type === "Identifier" &&
						expression.arguments[0].name === "__file_config__"
					) {
						return true;
					}
				});
			});
		});
	}
}

module.exports = IgnoreConfigRequire;