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
		[ "node_modules/typescript/lib/lib.es6.d.ts" ],
		[ "node_modules/typescript/lib/lib.es7.d.ts" ],
		[ "node_modules/typescript/lib/typescript.d.ts" ],
		[ "node_modules/typescript/lib/typescriptServices.d.ts" ],
		[
			"../DefinitelyTyped/createjs-lib/createjs-lib.d.ts",
			"../DefinitelyTyped/tweenjs/tweenjs.d.ts",
			"../DefinitelyTyped/soundjs/soundjs.d.ts",
			"../DefinitelyTyped/easeljs/easeljs.d.ts",
			"../DefinitelyTyped/preloadjs/preloadjs.d.ts",
		],
		["../DefinitelyTyped/angularjs/angular.d.ts"],
		["../DefinitelyTyped/backbone/backbone.d.ts"],
		["../DefinitelyTyped/bootstrap/bootstrap.d.ts"],
		["../DefinitelyTyped/box2d/box2dweb.d.ts"],
		["../DefinitelyTyped/chartjs/chart.d.ts"],
		["../DefinitelyTyped/commonmark/commonmark.d.ts"],
		["../DefinitelyTyped/facebook-js-sdk/facebook-js-sdk.d.ts"],
		["../DefinitelyTyped/firebase/firebase.d.ts"],
		["../DefinitelyTyped/fbsdk/fbsdk.d.ts"],
		["../DefinitelyTyped/google.analytics/ga.d.ts"],
		["../DefinitelyTyped/greensock/greensock.d.ts"],
		["../DefinitelyTyped/gruntjs/gruntjs.d.ts"],
		["../DefinitelyTyped/handlebars/handlebars.d.ts"],
		["../DefinitelyTyped/history/history.d.ts"],
		["../DefinitelyTyped/humane/humane.d.ts"],
		["../DefinitelyTyped/ionic/ionic.d.ts"],
		["../DefinitelyTyped/jade/jade.d.ts"],
		["../DefinitelyTyped/jquery/jquery.d.ts"],
		[
			//jquery ui modifies jquery types, so they must be
			//compiled together
			"../DefinitelyTyped/jquery/jquery.d.ts",
			"../DefinitelyTyped/jqueryui/jqueryui.d.ts"
		],
		["../DefinitelyTyped/less/less.d.ts"],
		["../DefinitelyTyped/marked/marked.d.ts"],
		["../DefinitelyTyped/mkdirp/mkdirp.d.ts"],
		["../DefinitelyTyped/mocha/mocha.d.ts"],
		["../DefinitelyTyped/minimist/minimist.d.ts"],
		["../DefinitelyTyped/mustache/mustache.d.ts"],
		["../DefinitelyTyped/node/node.d.ts"],
		["../DefinitelyTyped/node-webkit/node-webkit.d.ts"],
		["../DefinitelyTyped/onsenui/onsenui.d.ts"],
		["../DefinitelyTyped/page/page.d.ts"],
		["../DefinitelyTyped/pdf/pdf.d.ts"],
		["../DefinitelyTyped/pixi.js/pixi.js.d.ts"],
		["../DefinitelyTyped/qunit/qunit.d.ts"],
		["../DefinitelyTyped/rimraf/rimraf.d.ts"],
		["../DefinitelyTyped/semver/semver.d.ts"],
		["../DefinitelyTyped/source-map/source-map.d.ts"],
		["../DefinitelyTyped/swfobject/swfobject.d.ts"],
		["../DefinitelyTyped/twitter/twitter.d.ts"],
		["../DefinitelyTyped/underscore/underscore.d.ts"],
		["../DefinitelyTyped/zynga-scroller/zynga-scroller.d.ts"],
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
	child_process.exec("node " + path.join("bin", "cli.js") + " --flexHome " + flexHome + " --target ES6 --outDir dts2astests_temp --outSWC " + path.join("dts2astests_temp", "test.swc") + " " + files.join(" "),
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