/**
 *
 * COPY
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
	flatten = require('gulp-flatten'),
	changed = require('gulp-changed'),
	env = require('gulp-environments');



// the Variables
var prod = env.production,
	theCwd = config.directories.cwd,
	theSource = [
		'**/**/**/*.*',
		'**/**/**/.htaccess',
		'!**/**/**/.{DS_Store,gitignore,gitkeep}',
		'!**/**/**/*.{css,scss,sass,js,ts,coffee,php,html,twig,njk,blade,jpeg,jpg,gif,png,svg,yml,yaml,md}'
	],
	theDest = config.directories.dest.copy || config.directories.dest.default,
	watchIt = true,
	watcher = null;



// the Function
function copy() {

	// get browser reload function ... or not
	var reloadIt = !!browser.stream ? browser.stream({once: true}) : function() { return true; };

	// the Watcher
	if(!watcher && !prod() && watchIt) {

		watcher = gulp.watch(theSource, {cwd: theCwd}, copy);
		watcher.on('all', function(event, path) { console.log(path + ' : ' + event); });

	}

	// the Stream
	return gulp.src(theSource, {cwd: theCwd})
		.pipe(plumber({errorHandler: notify.onError('Error: <%= error.message %>')}))
		.pipe(flatten({includeParents: -1}))
		.pipe(changed(theDest, {hasChanged: changed.compareLastModifiedTime}))
		.pipe(gulp.dest(function(path) {

			var pathParams = path.dirname.replace(/\\/g, '/');
				pathParams = pathParams.split('/');
			var pathLength = pathParams.length;
			var parentDir = pathParams[pathLength - 1];
			var destination = theDest;

			// add assets folder to theDest if parent is not the 00_global dir
			if(parentDir !== '00_global') {
				destination += '/' + config.dirNames.resources;

				if(parentDir === '00_languages') {
					destination += '/languages';
				}
			}

			// remove 00_global dir from the path
			if(parentDir === '00_global' || parentDir === '00_languages') {
				pathParams.pop();
				path.dirname = pathParams.join('/');
			}

			return destination;

		}))
		.pipe(gulpif(!!browser.stream, reloadIt));

}



// the Task
gulp.task(copy);