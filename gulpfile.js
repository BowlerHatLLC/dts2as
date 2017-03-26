var gulp = require("gulp");
var ts = require("gulp-typescript");
var jasmine = require("gulp-jasmine");
var del = require("del");
var minimist = require("minimist");
var child_process = require("child_process");
var rimraf = require("rimraf");
var fs = require("fs");
var path = require("path");

gulp.task("clean-tests", function()
{
	return del(
	[
		"spec/bin"
	]);
});

gulp.task("clean", function()
{
	return del(
	[
		"bin/*.js"
	]);
});

gulp.task("build-tests", ["build", "clean-tests"], function()
{
	var tsProject = ts.createProject("spec/tsconfig.json");
	return gulp.src(
		[
			"source/*.ts",
			"spec/as3/*.ts",
			"spec/parser/*.ts",
		])
		.pipe(tsProject())
		.pipe(gulp.dest("spec/bin"));
});

gulp.task("build", ["clean"], function()
{
	var tsProject = ts.createProject("tsconfig.json");
	return gulp.src("source/*.ts")
		.pipe(tsProject())
		.pipe(gulp.dest("bin"));
});

gulp.task("test", ["build-tests"], function()
{
	return gulp.src("spec/bin/*-spec.js")
		.pipe(jasmine(
			{
				//includeStackTrace: true
			}));
});

//tests dts2as with a selection of libraries from DefinitelyTyped.
//https://github.com/DefinitelyTyped/DefinitelyTyped
//successful execution of this task is no guarantee that the generated output
//is correct. it simply ensures that the generated output will compile.
//usage: gulp test-definitely-typed --flexHome <Path to Apache FlexJS SDK>
gulp.task("test-definitely-typed", function(callback)
{
	var libraries =
	[
		[ "node_modules/typescript/lib/lib.d.ts" ],
		[ "node_modules/typescript/lib/lib.es2015.d.ts" ],
		[ "node_modules/typescript/lib/lib.es2016.d.ts" ],
		[ "node_modules/typescript/lib/lib.es2017.d.ts" ],
		//[ "node_modules/typescript/lib/typescript.d.ts" ],
		//[ "node_modules/typescript/lib/typescriptServices.d.ts" ],
		/*[
			"../../DefinitelyTyped/types/createjs-lib/index.d.ts",
			"../../DefinitelyTyped/types/tweenjs/index.d.ts",
			"../../DefinitelyTyped/types/soundjs/index.d.ts",
			"../../DefinitelyTyped/types/easeljs/index.d.ts",
			"../../DefinitelyTyped/types/preloadjs/index.d.ts",
		],*/
		//["../../DefinitelyTyped/types/angular/index.d.ts"],
		//["../../DefinitelyTyped/types/backbone/index.d.ts"],
		["../../DefinitelyTyped/types/bootstrap/index.d.ts"],
		//["../../DefinitelyTyped/types/box2d/index.d.ts"],
		["../../DefinitelyTyped/types/chartjs/index.d.ts"],
		["../../DefinitelyTyped/types/commonmark/index.d.ts"],
		["../../DefinitelyTyped/types/facebook-js-sdk/index.d.ts"],
		["../../DefinitelyTyped/types/firebase/index.d.ts"],
		["../../DefinitelyTyped/types/fb/index.d.ts"],
		["../../DefinitelyTyped/types/google.analytics/index.d.ts"],
		["../../DefinitelyTyped/types/gsap/index.d.ts"],
		//["../../DefinitelyTyped/types/grunt/index.d.ts"],
		["../../DefinitelyTyped/types/handlebars/index.d.ts"],
		//["../../DefinitelyTyped/types/history/index.d.ts"],
		["../../DefinitelyTyped/types/humane/index.d.ts"],
		//["../../DefinitelyTyped/types/ionic/index.d.ts"],
		["../../DefinitelyTyped/types/jade/index.d.ts"],
		["../../DefinitelyTyped/types/jquery/index.d.ts"],
		[
			//jquery ui modifies jquery types, so they must be
			//compiled together
			"../../DefinitelyTyped/types/jquery/index.d.ts",
			"../../DefinitelyTyped/types/jqueryui/index.d.ts"
		],
		["../../DefinitelyTyped/types/less/index.d.ts"],
		["../../DefinitelyTyped/types/marked/index.d.ts"],
		["../../DefinitelyTyped/types/mkdirp/index.d.ts"],
		["../../DefinitelyTyped/types/mocha/index.d.ts"],
		["../../DefinitelyTyped/types/minimist/index.d.ts"],
		["../../DefinitelyTyped/types/mustache/index.d.ts"],
		/*["../../DefinitelyTyped/types/node/index.d.ts"],
		[
			"../../DefinitelyTyped/types/node/index.d.ts",
			"../../DefinitelyTyped/types/nw.js/index.d.ts"
		],*/
		["../../DefinitelyTyped/types/onsenui/index.d.ts"],
		["../../DefinitelyTyped/types/page/index.d.ts"],
		["../../DefinitelyTyped/types/pdf/index.d.ts"],
		//["../../DefinitelyTyped/types/pixi.js/index.d.ts"],
		["../../DefinitelyTyped/types/qunit/index.d.ts"],
		["../../DefinitelyTyped/types/rimraf/index.d.ts"],
		//["../../DefinitelyTyped/types/semver/index.d.ts"],
		["../../DefinitelyTyped/types/source-map/index.d.ts"],
		["../../DefinitelyTyped/types/swfobject/index.d.ts"],
		["../../DefinitelyTyped/types/twitter/index.d.ts"],
		//["../../DefinitelyTyped/types/underscore/index.d.ts"],
		["../../DefinitelyTyped/types/zynga-scroller/index.d.ts"],
	];
	(function next()
	{
		var files = libraries.pop();
		run_dts2as(files, function(error)
		{
			if(error)
			{
				return callback(error);
			}
			if(libraries.length === 0)
			{
				return callback();
			}
			setImmediate(next);
		});
	})();
});

function run_dts2as(files, callback)
{
	var params = minimist(process.argv.slice(2));
	var flexHome = params["flexHome"];
	if(!fs.existsSync(flexHome))
	{
		console.error("Apache FlexJS SDK not found: " + flexHome);
		process.exit(1);
	}
	console.info(files.join(" "));
	child_process.exec("node " + path.join("bin", "cli.js") + " --flexHome " + flexHome + " --target ES2015 --debug 1 --outDir dts2astests_temp --outSWC " + path.join("dts2astests_temp", "test.swc") + " " + files.join(" "),
	{},
	function(error, stdout, stderr)
	{
		rimraf.sync("dts2astests_temp");
		if (error !== null)
		{
			return callback(error);
		}
		callback();
	});
}

gulp.task("default", ["build"]);