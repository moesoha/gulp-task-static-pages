// TODO: split Twig and i18n

const path = require('path');
const { src, dest, series, parallel } = require('gulp');
const Vinyl = require('vinyl');
const through = require('through2');
const YAML = require('yaml');

module.exports.I18nTaskGenerator = (task, config, extractKey = false) => {
	const langs = config.i18nLangs;
	const langDefault = config.i18nDefaultLang;

	const getI18nFilename = (basename, lang, ext) => {
		const idxDot = basename.lastIndexOf('.');
		let extension = ext;
		if (!extension) {
			extension = basename.substring(idxDot);
		}
		if (!!extension && !extension.startsWith('.')) {
			extension = '.' + extension;
		}

		let langName = '';
		if (langs.indexOf(lang) < 0) {
			throw new Error(`Unknown language code: ${lang}`);
		}
		if (lang !== langDefault) {
			langName = '.' + lang;
		}
		const filename = idxDot < 1 ? basename : basename.substring(0, idxDot);
		return filename + langName + extension;
	};

	const finalTasks = [];
	for(const lang of langs) {
		const i18nStrings = {};
		const i18nGetString = (filename, s) => {
			const key = s.trim();
			const domain = getI18nFilename(filename, lang, 'yaml');

			if (!i18nStrings[domain]) i18nStrings[domain] = {};
			if (!i18nStrings[domain][key]) i18nStrings[domain][key] = '';

			return i18nStrings[domain][key].trim() || key;
		};

		const taskLangFileLoad = task('i18n:load:' + lang, () => src(path.join(config.i18nPath, `*.${lang}.yaml`))
			.pipe(through.obj(function (file, _, callback) {
				if (file.isBuffer()) {
					i18nStrings[file.basename] = YAML.parse(file.contents.toString());
				}
				callback();
			}))
		, true);
		const taskLangFileSave = task('i18n:save:' + lang, () => (() => {
			const src = require('stream').Readable({ objectMode: true });
			src._read = function () {
				for (let [filename, keys] of Object.entries(i18nStrings)) {
					this.push(new Vinyl({
						path: filename,
						contents: Buffer.from(YAML.stringify(keys, config.yamlStringifyOptions), 'utf-8')
					}));
				}
				this.push(null);
			};
			return src;
		})().pipe(dest(config.i18nPath)), true);

		const taskTwig = task(
			'twig:compile:' + lang,//'./templates/**/*.twig', '!./templates/**/_*.twig'
			() => src([path.posix.join(config.twigPath, '**', '*.twig'), '!' + path.posix.join(config.twigPath, '**', '_*.twig')])
				.pipe(gulpTwig = require('gulp-twig')({
					base: path.resolve(config.twigPath),
					data: {
						_lang: lang,
						_prod: config.isProduction
					},
					extend (Twig) {
						Twig.exports.extendFunction(
							'url',
							function (url) { return getI18nFilename(url, this.context._lang); } // FIXME: this is url
						);

						Twig.exports.extendFunction(
							'i18nSwitch',
							function (lang) { return getI18nFilename(this.context._target.relative, lang); }
						);
						
						Twig.exports.extendFilter(
							'trans',
							function (s) { return i18nGetString(path.basename(this.template.path), s); }
						);

						Twig.exports.extendTag({
							type: 'trans',
							regex: /^trans$/,
							next: ['endtrans'],
							open: true,
							compile (token) {
								delete token.match;
								return token;
							},
							parse (token, context, chain) {
								const text = this.parse(token.output, context).trim();
								return {
									chain,
									output: i18nGetString(path.basename(this.template.path), text)
								}
							}
						});
						Twig.exports.extendTag({
							type: 'endtrans',
							regex: /^endtrans$/,
							next: [],
							open: false
						});
					}
				}))
				.pipe(through.obj(function (file, _, callback) {
					if (file.isBuffer()) {
						if (lang !== langDefault) {
							file.basename = getI18nFilename(file.basename, lang);
						}
						this.push(file);
						callback();
					}
				}))
				.pipe(dest(config.distPath)),
			true
		);

		if (extractKey) {
			if (lang !== langDefault) {
				finalTasks.push(task('i18n:extract:' + lang, series(taskLangFileLoad, taskTwig, taskLangFileSave)));
			}
		} else {
			finalTasks.push(task('i18n:compile:' + lang, series(taskLangFileLoad, taskTwig)));
		}
	}
	if (extractKey) {
		return task('i18n:extract', parallel(...finalTasks));
	} else {
		return task('i18n:compile', parallel(...finalTasks));
	}
}
