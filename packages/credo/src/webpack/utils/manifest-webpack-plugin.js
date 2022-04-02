const path = require("path");
const webpack = require('webpack');
const {RawSource} = webpack.sources || require('webpack-sources');

const pluginName = "ManifestWebpackPlugin";

class ManifestWebpackPlugin {

	/**
	 * Manifest plugin options
	 * @param {Object} options
	 * @param {String} options.filename Manifest filename
	 */
	constructor(options = {}) {
		this.addAssets = this.addAssets.bind(this);
		this.manifest = {};
		this.options = {
			filename: 'manifest.json',
			... options,
		};
	}

	/**
	 * Get the public path from Webpack configuation
	 * and add slash at the end if necessary
	 * @return {String} The public path
	 */
	getPublicPath() {
		let publicPath = this.compilation.options.output.publicPath || '';

		// Default value for the publicPath is "auto"
		// The value must be generated automatically from the webpack compilation data
		if (publicPath === 'auto') {
			publicPath = `/${path.relative(
				this.compilation.options.context,
				this.compilation.options.output.path
			)}`;
		} else if (typeof publicPath === 'function') {
			publicPath = publicPath();
		}

		return `${publicPath}${this.isPublicPathNeedsEndingSlash(publicPath) ? '/' : ''}`;
	}

	/**
	 * Check if the publicPath need an ending slash
	 * @param {String} publicPath Public path
	 * @returns {Boolean} The public path need an ending slash
	 */
	isPublicPathNeedsEndingSlash(publicPath) {
		return !!(publicPath && publicPath.slice(-1) !== '/');
	}

	/**
	 * Get files list by entrypoint name
	 *
	 * @param {String} entryName Entrypoint name
	 * @return {Array} List of entrypoint names
	 */
	getFiles(entryName) {
		return this.compilation.entrypoints.get(entryName).getFiles();
	}

	/**
	 * Check if file extension correspond to the type parameter
	 * @param {String} file File path
	 * @param {String} type File extension
	 * @returns {Boolean} File extension is valid
	 */
	isValidExtensionByType(file, type) {
		return path.extname(file).substring(1).toLowerCase() === type;
	}

	/**
	 * Sorts all chunks by type (styles or scripts)
	 * @param {Array} files List of files by entrypoint name
	 * @returns {Object} All chunks sorted by extension type
	 */
	sortsChunksByType(files) {
		return {
			styles: files
				.filter((file) => this.isValidExtensionByType(file, 'css'))
				.map((file) => `${this.publicPath}${file}`),
			scripts: files
				.filter((file) => this.isValidExtensionByType(file, 'js'))
				.map((file) => `${this.publicPath}${file}`)
		};
	}

	/**
	 * Update the class property manifest
	 * which contains all chunks informations by entrypoint
	 * @param {Object} options
	 * @param {String} options.entryName Entrypoint name
	 * @param {Object} options.chunks List of styles and scripts chunks by entrypoint
	 */
	updateManifest({ entryName, chunks }) {
		this.manifest[entryName] = {
			styles: chunks.styles,
			scripts: chunks.scripts
		};
	}

	/**
	 * Process for each entry
	 * @param {String} entryName Entrypoint name
	 */
	processEntry(entryName) {
		const files = this.getFiles(entryName);
		const chunks = this.sortsChunksByType(files);

		// Check if manifest option is enabled
		this.updateManifest({ entryName, chunks });
	}

	/**
	 * Create the chunks manifest file
	 * Contains all scripts and styles chunks grouped by entrypoint
	 */
	createChunksManifestFile() {
		// Stringify the content of the manifest
		const output = JSON.stringify(this.manifest, null, 2);

		// Expose the manifest file into the assets compilation
		// The file is automatically created by the compiler
		this.compilation.emitAsset(this.options.filename, new RawSource(output, false));
	}

	addAssets() {
		this.publicPath = this.getPublicPath();
		this.entryNames = Array.from(this.compilation.entrypoints.keys());

		this.entryNames
			.filter((entryName) => this.getFiles(entryName).length)
			.map((entryName) => this.processEntry(entryName));

		this.createChunksManifestFile();
	}

	apply (compiler) {
		compiler.hooks.thisCompilation.tap(pluginName, (compilation) => {

			this.compilation = compilation;
			this.fs = this.compilation.compiler.outputFileSystem;

			compilation.hooks.processAssets.tap({
				name: pluginName,
				stage: webpack.Compilation.PROCESS_ASSETS_STAGE_ADDITIONAL,
			}, this.addAssets);
		});
	}
}

module.exports = ManifestWebpackPlugin;