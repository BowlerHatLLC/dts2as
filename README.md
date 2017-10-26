# dts2as

*Note: This project is no longer under active development. Use at your own risk.*

A command line utility that converts TypeScript definitions (d.ts files) to ActionScript classes and interfaces and generates a SWC file. Use these SWCs with Apache FlexJS for strict compile-time type checking, as if the JavaScript library were written in ActionScript. You can add the SWCs to IDEs, like [Visual Studio Code](https://nextgenactionscript.com/vscode/), Flash Builder, or IntelliJ IDEA, and you'll get helpful code suggestions as you type.

## Installation

Requires [Node.js](https://nodejs.org/).

```
npm install -g dts2as
```

## Usage

```
dts2as hello.d.ts
dts2as file1.d.ts file2.d.ts
dts2as --outSWC hello.swc hello.d.ts
dts2as --outDir ./as3-files file.d.ts
dts2as --exclude com.example.SomeType file.d.ts
```

The following arguments are available:

* `-outSWC FILE`

	Generate a compiled SWC file. Requires either `FLEX_HOME` environment variable or `--flexHome` option.

* `-outDir DIRECTORY`

	Generate ActionScript files in a specific output directory. Defaults to `./dts2as_generated`.

* `--flexHome DIRECTORY`

	Specify the directory where Apache FlexJS is located. Defaults to `FLEX_HOME` environment variable, if available.

* `--moduleMetadata`

	Adds `[JSModule]` metadata to CommonJS modules. If a module is used in code, Apache FlexJS will automatically require it.

* `-e SYMBOL` or `--exclude SYMBOL`

	Specify the fully-qualified name of a symbol to exclude when emitting ActionScript.

* `-i SYMBOL` or `--include SYMBOL`

	Specify the fully-qualified name of a symbol to include when emitting ActionScript. Excludes all other symbols.

* `-t VERSION` or `--target VERSION`

	Specify ECMAScript target version for the TypeScript standard library: 'ES3', 'ES5', 'ES2015', 'ES2016', 'ES2017', or 'Latest' (default)

* `-v` or `--version`

	Print the version of `dts2as`.

## Using the SWC with Apache FlexJS

To use the generated SWC file with Apache FlexJS, you need to append it to the *external* library path.

If you're using the FlexJS framework components, you can compile with `mxmlc`:

```
mxmlc --external-library-path+=generated.swc src/MyProject.mxml
```

For pure ActionScript projects that target native JavaScript APIs, like the HTML DOM, you can compile with `asjsc`:

```
asjsc --external-library-path+=generated.swc src/MyProject.as
```

For more details, please check out the following tutorial:

[Introduction to `dts2as`: Using TypeScript definitions with ActionScript](http://nextgenactionscript.com/tutorials/dts2as-typescript-definitions-with-actionscript/)

## Troubleshooting

TypeScript definition files support a surprisingly large subset of the TypeScript language. Sometimes, dts2as won't know how to parse some of the more advanced syntax (although it's certainly getting better at it over time!). When dts2as runs into problems, it may not be able to compile a SWC file for you. You have a few options when dts2as fails:

* Use the `--exclude` option to remove some symbols that you know you won't need, or use the `--include` option to include only the symbols that you definitely need.

* Modify the original d.ts file to simplify the TypeScript syntax or to remove some symbols that you don't need.

* Use the `--outDir` option instead of the `--outSWC` option to generate only ActionScript files. Then, modify the ActionScript files and compile them into a SWC yourself.

---

Special thanks to the following sponsors for their generous support:

* [YETi CGI](http://yeticgi.com/)

* [Moonshine IDE](http://moonshine-ide.com/)
