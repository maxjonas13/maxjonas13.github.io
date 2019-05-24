/**
 *
 * STYLES
 *
 */



// get the Config
var config = require('../taskmanager.config.json');



// the Imports
var gulp = require('gulp'),
	gulpif = require('gulp-if'),
	sass = require('gulp-sass'),
	browser = require('./browser'),
	notify = require('gulp-notify'),
	postcss = require('gulp-postcss'),
	plumber = require('gulp-plumber'),
	flatten = require('gulp-flatten'),
	env = require('gulp-environments'),
	sassGlob = require('gulp-sass-glob'),
	autoprefixer = require('autoprefixer'),
	sourcemaps = require('gulp-sourcemaps');



// the Variables
var dev = env.development,
	prod = env.production,
	theCwd = config.directories.cwd,
	theSource = ['**/**/*.{sass,scss}'],
	theDest = (config.directories.dest.styles || config.directories.dest.default) + '/' + config.dirNames.resources + '/styles',
	watchIt = true,
	watcher = null,
	theOptions = {
		sass: {
			outputStyle: 'compressed'
		},
		autoprefixer: {
			cascade: false,
			browsers: config.browserSupport
		}
	};



// the Function
function styles() {

	// get browser reload function ... or not
	var reloadIt = !!browser.stream ? browser.stream({once: true}) : function() { return true; };

	// the Watcher
	if(!watcher && !prod() && watchIt) {

		watcher = gulp.watch(theSource, {cwd: theCwd}, styles);
		watcher.on('all', function(event, path) { console.log(path + ' : ' + event); });

	}

	// the Stream
	return gulp.src(theSource, {cwd: theCwd})
		.pipe(plumber({errorHandler: notify.onError("Error: <%= error.message %>")}))
		.pipe(sassGlob())
		.pipe(dev(sourcemaps.init()))
		.pipe(sass(theOptions.sass))
		.pipe(postcss([autoprefixer(theOptions.autoprefixer)]))
		.pipe(dev(sourcemaps.write()))
		.pipe(flatten())
		.pipe(gulp.dest(theDest))
		.pipe(gulpif(!!browser.stream, reloadIt));

}



// the Task
gulp.task(styles);