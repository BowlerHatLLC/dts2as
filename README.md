# dts2as

Converts TypeScript definition files into ActionScript. The FlexJS transpiler may use the output as an external library to use JavaScript APIs in ActionScript.

## Usage

```
dts2as hello.d.ts
dts2as file1.d.ts file2.d.ts
dts2as --outDir ./as3-files file.d.ts
```

The following arguments are available:

* `-outDir DIRECTORY`

	Generate ActionScript files in a specific output directory.

* `-e SYMBOL` or `--exclude SYMBOL`

	Specify the fully-qualified name of a symbol to exclude when emitting ActionScript.

* `-i SYMBOL` or `--include SYMBOL`

	Specify the fully-qualified name of a symbol to include when emitting ActionScript. Excludes all other symbols.

* `-v` or `--version`

	Print the version of `dts2as`.
