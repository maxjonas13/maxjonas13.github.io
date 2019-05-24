/**
 *
 * BROWSERSYNC
 *
 */



// get the Config
var config = require('../taskmanager.config.json');



// the Imports
var gulp = require('gulp'),
	env = require('gulp-environments'),
	theSyncer = require('browser-sync').create();



// the Variables
var prod = env.production,
	theOptions = {
		'port': 9999,
		'online': true,
		'notify': false,
		'proxy': config.vhost,
		ghostMode: {
		  clicks: false,
		  forms: false,
		  scroll: false
		}
	};



// the Functions
function browser(cb) {

	// if --env production
	if(prod()) { console.log('Browersync is skipped on the production environment!'); cb(); return; }

	theSyncer.init(theOptions);

	cb();

}



// the Exports
module.exports = theSyncer;



// the Tasks
gulp.task(browser);