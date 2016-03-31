var gulp = require("gulp");
var ts = require("gulp-typescript");
var jasmine = require("gulp-jasmine");
var del = require("del");
var minimist = require("minimist");
var child_process = require("child_process");
var rimraf = require("rimraf");
var fs = require("fs");

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
	return gulp.src(
		[
			"source/*.ts",
			"spec/as3/*.ts",
			"spec/parser/*.ts",
		])
		.pipe(ts(
		{
			module: "commonjs",
			target: "ES5",
			outDir: "spec/bin"
		}))
		.pipe(gulp.dest("spec/bin"));
});

gulp.task("build", ["clean"], function()
{
	return gulp.src("source/*.ts")
		.pipe(ts(
		{
			module: "commonjs",
			target: "ES5"
		}))
		.pipe(gulp.dest("bin"));
});

gulp.task("test", ["build-tests"], function()
{
	return gulp.src("spec/bin/spec/**/*.js")
		.pipe(jasmine());
});

//tests dts2as with several libraries from DefinitelyTyped
//https://github.com/DefinitelyTyped/DefinitelyTyped
//usage: gulp test-definitely-typed --flexHome <Path to Apache FlexJS SDK>
gulp.task("test-definitely-typed", function(callback)
{
	var libraries =
	[
		[ "node_modules/typescript/lib/lib.d.ts" ],
		[ "node_modules/typescript/lib/lib.es6.d.ts" ],
		[
			"../DefinitelyTyped/createjs-lib/createjs-lib.d.ts",
			"../DefinitelyTyped/tweenjs/tweenjs.d.ts",
			"../DefinitelyTyped/soundjs/soundjs.d.ts",
			"../DefinitelyTyped/easeljs/easeljs.d.ts",
			"../DefinitelyTyped/preloadjs/preloadjs.d.ts",
		],
		["../DefinitelyTyped/pixi.js/pixi.js.d.ts"],
		["../DefinitelyTyped/angularjs/angular.d.ts"],
		["../DefinitelyTyped/jquery/jquery.d.ts"],
		["../DefinitelyTyped/bootstrap/bootstrap.d.ts"],
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
			next();
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
	child_process.exec("bin/dts2as --flexHome " + flexHome + " --outSWC dts2astests_temp/test.swc " + files.join(" "),
	{},
	function(error)
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