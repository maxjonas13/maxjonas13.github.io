/**
 *
 * SVG
 *
 */



// get the Config
var config = require('../taskmanager.config.json');



// the Imports
var gulp = require('gulp'),
	gulpif = require('gulp-if'),
	browser = require('./browser'),
	notify = require('gulp-notify'),
	svgmin = require('gulp-svgmin'),
	plumber = require('gulp-plumber'),
	flatten = require('gulp-flatten'),
	env = require('gulp-environments');



// the Variables
var prod = env.production,
	theCwd = config.directories.cwd,
	theSource = [
		'**/**/*.svg',
		'!**/**/icons/*.svg',
		'!**/**/*icon*.svg'
	],
	theDest = (config.directories.dest.svg || config.directories.dest.default) + '/' + config.dirNames.resources + '/svg',
	watchIt = true,
	watcher = null,
	theOptions = {
		plugins: [
			{ removeDoctype: true },
			{ removeComments: true },
			{ removeDimensions: true },
			{ convertShapeToPath: true },
			{ convertStyleToAttrs: true },
			{ cleanupNumericValues: { floatPrecision: 0 } }
		]
	};



// the Function
function svg() {

	// get browser reload function ... or not
	var reloadIt = !!browser.stream ? browser.stream({once: true}) : function() { return true; };

	// the Watcher
	if(!watcher && !prod() && watchIt) {

		watcher = gulp.watch(theSource, {cwd: theCwd}, svg);
		watcher.on('all', function(event, path) { console.log(path + ' : ' + event); });

	}

	// the Stream
	return gulp.src(theSource, {cwd: theCwd})
		.pipe(plumber({errorHandler: notify.onError("Error: <%= error.message %>")}))
		.pipe(flatten())
		.pipe(svgmin(theOptions))
		.pipe(gulp.dest(theDest))
		.pipe(gulpif(!!browser.stream, reloadIt));

}



// the Task
gulp.task(svg);