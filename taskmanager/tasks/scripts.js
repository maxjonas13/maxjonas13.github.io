/**
 *
 * SCRIPTS
 *
 */



// get the Config
var config = require('../taskmanager.config.json');



// the Imports
var gulp = require('gulp'),
	gulpif = require('gulp-if'),
	browser = require('./browser'),
	uglify = require('gulp-uglify'),
	concat = require('gulp-concat'),
	notify = require('gulp-notify'),
	plumber = require('gulp-plumber'),
	env = require('gulp-environments'),
	sourcemaps = require('gulp-sourcemaps');



// the Variables
var dev = env.development,
	prod = env.production,
	theCwd = config.directories.cwd,
	theSource = ['00_libs/**/*.js', '00_plugins/**/*.js', '00_global/**/*.js', '01_fundaments/**/*.js', '02_atoms/**/*.js', '03_molecules/**/*.js', '04_organisms/**/*.js', '05_buckets/**/*.js'],
	theDest = (config.directories.dest.scripts || config.directories.dest.default) + '/' + config.dirNames.resources + '/scripts',
	watchIt = true,
	watcher = null,
	theOptions = 'main.js';



// the Function
function scripts() {

	// get browser reload function ... or not
	var reloadIt = !!browser.stream ? browser.stream({once: true}) : function() { return true; };

	// the Watcher
	if(!watcher && !prod() && watchIt) {

		watcher = gulp.watch(theSource, {cwd: theCwd}, scripts);
		watcher.on('all', function(event, path) { console.log(path + ' : ' + event); });

	}

	// the Stream
	return gulp.src(theSource, {cwd: theCwd})
		.pipe(plumber({errorHandler: notify.onError("Error: <%= error.message %>")}))
		.pipe(dev(sourcemaps.init()))
		.pipe(concat(theOptions))
		.pipe(dev(sourcemaps.write()))
		.pipe(prod(uglify()))
		.pipe(gulp.dest(theDest))
		.pipe(gulpif(!!browser.stream, reloadIt));

}



// the Task
gulp.task(scripts);