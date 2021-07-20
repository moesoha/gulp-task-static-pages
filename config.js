module.exports = Object.freeze({
	i18nLangs: ['zh', 'en'],
	i18nDefaultLang: 'en',
	i18nPath: './i18n',
	
	yamlStringifyOptions: Object.freeze({ indent: 4 }),

	twigPath: './template',

	sassPath: './sass',
	sassDestinationDirectory: 'css',
	sassOptions: Object.freeze({}),

	fontPath: './font',
	fontDestinationDirectory: 'font',
	fontSpiderOptions: Object.freeze({ silent: false, backup: false }),

	publicPath: './public',

	distPath: './dist',
	
	isProduction: false
});
