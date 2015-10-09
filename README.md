# dts2as

A command line tool that converts TypeScript definitions (d.ts files) to ActionScript classes and interfaces. A compiled SWC file may be used as an external library with the Apache FlexJS transpiler to expose JavaScript APIs to ActionScript.

## Installation

Requires [Node.js](https://nodejs.org/).

```
npm install -g dts2as
```

## Usage

```
dts2as hello.d.ts
dts2as file1.d.ts file2.d.ts
dts2as --outDir ./as3-files file.d.ts
dts2as --exclude com.example.SomeType file.d.ts
```

The following arguments are available:

* `-outDir DIRECTORY`

	Generate ActionScript files in a specific output directory.

* `-e SYMBOL` or `--exclude SYMBOL`

	Specify the fully-qualified name of a symbol to exclude when emitting ActionScript.

* `-i SYMBOL` or `--include SYMBOL`

	Specify the fully-qualified name of a symbol to include when emitting ActionScript. Excludes all other symbols.

* `-t VERSION` or `--target VERSION`

	Specify ECMAScript target version for the TypeScript standard library: 'ES3', 'ES5' (default), or 'ES6'

* `-v` or `--version`

	Print the version of `dts2as`.
