const path = require('path').posix;
const { src, dest, watch, series, parallel } = require('gulp');

const DefaultConfig = module.exports.DefaultConfig = require('./config');
const { I18nTaskGenerator } = require('./i18n');

module.exports.TaskGenerate = _config => {
	const config = { ...DefaultConfig, ..._config };
	const tasks = {};
	const task = (name, func, hidden = false) => {
		func.displayName = name;
		if (!hidden) {
			tasks[name] = func;
		}
		return func;
	}
	const paths = {
		distDirectory: path.join(config.distPath, '/'),
		distAllHtml: path.join(config.distPath, '**', '*.html'),
		allFiles: (p, type) => path.join(p, !type ? '*' : `*.${type}`),
		allFilesRecursive: (p, type) => path.join(p, !type ? '**/*' : `**/*.${type}`)
	};

	task('clean', () => src(config.distPath, { read: false, allowEmpty: true })
		.pipe(require('gulp-clean')())
	);

	task('minify:html', () => src(paths.distAllHtml)
		.pipe(require('gulp-htmlmin')({ collapseWhitespace: true }))
		.pipe(dest(paths.distDirectory))
	);

	task('copy:public', () => src(paths.allFilesRecursive(config.publicPath))
		.pipe(dest(paths.distDirectory))
	);
	task('copy:font', () => src(paths.allFilesRecursive(config.fontPath))
		.pipe(dest(path.join(config.distPath, config.fontDestinationDirectory)))
	);

	task('font-spider', () => src(paths.distAllHtml)
		.pipe(require('gulp-font-spider')({ ...config.fontSpiderOptions }))
		.pipe(dest(paths.distDirectory))
	);

	task('sass:compile', () => src(paths.allFiles(config.sassPath, '{scss,sass}'))
		.pipe(require('gulp-sass')(require('sass'))({
			outputStyle: config.isProduction ? 'compressed' : undefined,
			...config.sassOptions
		}))
		.pipe(dest(path.join(config.distPath, config.sassDestinationDirectory)))
	);

	task('watch', () => {
		watch(
			paths.allFilesRecursive(config.sassPath),
			tasks['sass:compile']
		);
		// watch(
		// 	[paths.allFilesRecursive(config.twigPath), paths.allFilesRecursive(config.i18nPath)],
		// 	parallel(...config.i18nLangs.map(lang => GeneratorOfI18nTasks(lang)))
		// );
	})
	I18nTaskGenerator(task, config, true);

	const TaskDefault = [
		parallel(
			tasks['copy:font'],
			tasks['copy:public'],
			tasks['sass:compile'],
			I18nTaskGenerator(task, config, false)
		),
		tasks['font-spider']
	];
	if (config.isProduction) {
		TaskDefault.push(tasks['minify:html']);
	}
	task('default', series(...TaskDefault));

	return tasks;
}
