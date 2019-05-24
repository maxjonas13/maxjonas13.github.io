/**
 *
 * CLEAN
 *
 */



// the Imports
var del = require('del'),
	gulp = require('gulp'),
	config = require('../taskmanager.config.json');



// the Function
function clean(cb) {

	del(config.directories.clean, {force: true});

	setTimeout(cb, 1000);

}



// the Task
gulp.task(clean);