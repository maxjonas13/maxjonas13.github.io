/**
 *
 * GRAPHICS
 *
 */



// get the Config
var config = require('../taskmanager.config.json');



// the Imports
var gulp = require('gulp'),
	gulpif = require('gulp-if'),
	browser = require('./browser'),
	notify = require('gulp-notify'),
	plumber = require('gulp-plumber'),
	changed = require('gulp-changed'),
	flatten = require('gulp-flatten'),
	env = require('gulp-environments'),
	imagemin = require('gulp-imagemin');



// the Variables
var prod = env.production,
	theCwd = config.directories.cwd,
	theSource = ['**/**/*.{jpg,jpeg,gif,png}'],
	theDest = (config.directories.dest.graphics || config.directories.dest.default) + '/' + config.dirNames.resources + '/graphics',
	watchIt = true,
	watcher = null,
	theOptions = {
		interlaced: true,
		progressive: true,
		optimizationLevel: 5
	};



// the Function
function graphics() {

	// get browser reload function ... or not
	var reloadIt = !!browser.stream ? browser.stream({once: true}) : function() { return true; };

	// the Watcher
	if(!watcher && !prod() && watchIt) {

		watcher = gulp.watch(theSource, {cwd: theCwd}, graphics);
		watcher.on('all', function(event, path) { console.log(path + ' : ' + event); });

	}

	// the Stream
	return gulp.src(theSource, {cwd: theCwd})
		.pipe(plumber({errorHandler: notify.onError("Error: <%= error.message %>")}))
		.pipe(flatten())
		.pipe(prod(imagemin(theOptions)))
		.pipe(changed(theDest, {hasChanged: changed.compareLastModifiedTime}))
		.pipe(gulp.dest(theDest))
		.pipe(gulpif(!!browser.stream, reloadIt));

}



// the Task
gulp.task(graphics);