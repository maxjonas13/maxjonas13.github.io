# TD²NA

## Install Node

Node:

	https://nodejs.org/en/


### First run

	$ npm start

This command will install all npm packages that are needed for the project and run all active tasks in development mode.
The packages are listed in ./package.json

Run it when you just checked out the repository or when you have deleted the node_modules directory.

### Development

	$ npm run dev

This command will run all active tasks in development mode.
NO uglify, NO minify, NO optimize, ... => Waste of time in development.

### Production

	$ npm run production

This command will run all active tasks in production mode.
YES uglify, YES minify, YES optimize, ... => Better performance for production.



## Shame

This folder is used for them shamefull, fast and dirty fixes.
Only use this folder when you are short in time, not out of laziness.