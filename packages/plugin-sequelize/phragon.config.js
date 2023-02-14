/**
 * @param builder {BuilderI}
 */
module.exports = function config(builder) {
	builder
		.docTypeReference()
		.phragon
		.service("orm", "./service/orm")
		.service("sequelize", "./service/sequelize");
}
