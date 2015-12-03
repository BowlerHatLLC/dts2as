var gulp = require("gulp");
var ts = require("gulp-typescript");
var jasmine = require("gulp-jasmine");
var del = require("del");

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

gulp.task("default", ["build"]);