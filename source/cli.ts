/*
Copyright 2015 Bowler Hat LLC

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/
/// <reference path="../typings/tsd.d.ts" />
/// <reference path="../node_modules/typescript/lib/typescript.d.ts" />

import fs = require("fs");
import path = require("path");
import child_process = require("child_process");
import minimist = require("minimist");
import TS2ASParser = require("./parser");
import ASStubEmitter = require("./as-stub-emitter");
import JSExternsEmitter = require("./js-externs-emitter");
import flexjsUtils = require("./flexjs-utils");
import as3 = require("./as3");
import ts = require("typescript");
import mkdirp = require("mkdirp");
import rimraf = require("rimraf");

let sourceOutputPathIsTemp = false;
let outputDirectory: string = null;
let swcOutputPath: string = null;
let externsOutputPath: string = null;
let flexHome: string = null;
let fileNames: string[];
let debugLevel: TS2ASParser.DebugLevel;
let excludedSymbols: string[];
let includedSymbols: string[];
let scriptTarget: ts.ScriptTarget = ts.ScriptTarget.ES5;
let sourcePaths: string[] = [];

let params = minimist(process.argv.slice(2),
{
	alias:
	{
		i: ["include"],
		e: ["exclude"],
		v: ["version"]
	}
});
for(let key in params)
{
	switch(key)
	{
		case "_":
		{
			fileNames = params[key];
			fileNames.forEach(fileName =>
			{
				if(!fs.existsSync(fileName))
				{
					console.error("File not found: " + fileName);
					process.exit(1);
				}
			});
			break;
		}
		case "debug":
		{
			debugLevel = params[key];
			break;
		}
		case "version":
		{
			printVersion();
			process.exit(0);
		}
		case "outSWC":
		{
			swcOutputPath = path.join(params[key]);
			break;
		}
		case "outDir":
		{
			outputDirectory = path.join(params[key]);
			break;
		}
		case "flexHome":
		{
			let path = params[key];
			if(flexjsUtils.isValidApacheFlexJSPath(path))
			{
				flexHome = path;
			}
			else
			{
				console.error("Path to Apache FlexJS SDK is not valid: " + path);
				process.exit(1);
			}
			break;
		}
		case "target":
		{
			let scriptTargetName = params[key];
			switch(scriptTargetName)
			{
				case "ES3":
				{
					scriptTarget = ts.ScriptTarget.ES3;
					break;
				}
				case "ES5":
				{
					scriptTarget = ts.ScriptTarget.ES5;
					break;
				}
				case "ES6":
				{
					scriptTarget = ts.ScriptTarget.ES6;
					break;
				}
				default:
				{
					console.error("Unknown script target: " + scriptTargetName);
					process.exit(1);
				}
			}
			break;
		}
		case "exclude":
		{
			let value = params[key];
			if(value instanceof String)
			{
				excludedSymbols = [value];
			}
			else
			{
				excludedSymbols = value;
			}
			break;
		}
		case "include":
		{
			let value = params[key];
			if(value instanceof String)
			{
				includedSymbols = [value];
			}
			else
			{
				includedSymbols = value;
			}
			break;
		}
		case "e":
		case "i":
		case "v":
		{
			//ignore aliases
			break;
		}
		default:
		{
			console.error("Unknown argument: " + key);
			process.exit(1);
		}
	}
}
if(fileNames.length === 0)
{
	printUsage();
	process.exit(1);
}
if(flexHome === null)
{
	flexHome = flexjsUtils.findFlexHome();
}
if(swcOutputPath !== null)
{
	if(flexHome === null)
	{
		console.error("--outSWC option requires Apache FlexJS. Please specify the --flexHome option or set the FLEX_HOME environment variable.");
		process.exit(1);
	}
	else
	{
        if(this.debugLevel >= TS2ASParser.DebugLevel.INFO)
        {
			console.info("Apache FlexJS: " + flexHome);
		}
	}
}
if(outputDirectory === null)
{
	if(swcOutputPath !== null)
	{
		sourceOutputPathIsTemp = true;
	}
	outputDirectory = path.join(process.cwd(), "dts2as_generated");
}

let parser = new TS2ASParser(scriptTarget);
parser.debugLevel = debugLevel;

function canEmit(symbol: as3.PackageLevelDefinition): boolean
{
	if(symbol.external)
	{
		return false;
	}
	if(excludedSymbols && excludedSymbols.indexOf(symbol.getFullyQualifiedName()) >= 0)
	{
		return false;
	}
	if(includedSymbols && includedSymbols.indexOf(symbol.getFullyQualifiedName()) < 0)
	{
		return false;
	}
	return true;
}

let externsOutput = "";
fileNames.forEach(fileName =>
{
	let result = parser.parse(fileName);
	let packageLevelSymbols = result.definitions;
	let externsEmitter = new JSExternsEmitter(packageLevelSymbols);
	if(externsOutput.length === 0)
	{
		externsOutput += externsEmitter.emitFileHeader();
	}
	externsOutput += externsEmitter.emitPackages();
	let sourceEmitter = new ASStubEmitter(packageLevelSymbols);
	packageLevelSymbols.forEach(function(as3Type:as3.PackageLevelDefinition)
	{
		if(!canEmit(as3Type))
		{
			return;
		}
		//delete all output files first, if they exist, to detect duplicates
		//so that we can display a warning
		deleteAS3File(as3Type);
	});
	packageLevelSymbols.forEach(function(as3Type:as3.PackageLevelDefinition)
	{
		if(!canEmit(as3Type))
		{
			return;
		}
		if("superClass" in as3Type)
		{
			let as3Class = <as3.ClassDefinition> as3Type;
			writeAS3File(as3Class, sourceEmitter.emitClass(as3Class));
			externsOutput += externsEmitter.emitClass(as3Class);
		}
		else if("interfaces" in as3Type)
		{
			let as3Interface = <as3.InterfaceDefinition> as3Type;
			writeAS3File(as3Interface, sourceEmitter.emitInterface(as3Interface));
			externsOutput += externsEmitter.emitInterface(as3Interface);
		}
		else if("parameters" in as3Type)
		{
			let as3PackageFunction = <as3.PackageFunctionDefinition> as3Type;
			writeAS3File(as3PackageFunction, sourceEmitter.emitPackageFunction(as3PackageFunction));
			externsOutput += externsEmitter.emitPackageFunction(as3PackageFunction);
		}
		else
		{
			let as3PackageVariable = <as3.PackageVariableDefinition> as3Type;
			writeAS3File(as3PackageVariable, sourceEmitter.emitPackageVariable(as3PackageVariable));
			externsOutput += externsEmitter.emitPackageVariable(as3PackageVariable);
		}
	});
});
if(swcOutputPath !== null)
{
	let swcName = path.basename(swcOutputPath, ".swc");
	let externsName = swcName + ".js";
	//if we're creating a SWC, the externs must have the same file name
	externsOutputPath = path.join(outputDirectory, externsName);
}
else
{
	//otherwise, just use a generic name
	externsOutputPath = path.join(outputDirectory, "externs.js");
}
fs.writeFileSync(externsOutputPath, externsOutput);
if(this.debugLevel >= TS2ASParser.DebugLevel.WARN)
{
	console.info("Created JavaScript externs file: " + externsOutputPath);
}

let compilerError = false;
if(swcOutputPath !== null)
{
	let swcName = path.basename(swcOutputPath, ".swc");
	let externsName = swcName + ".js";
	let compcPath = flexjsUtils.findBinCompc(flexHome);
	if(compcPath === null)
	{
		console.error("Could not find bin/compc in Apache FlexJS directory.");
		process.exit(1);
	}
	let compcArgs =
	[
		"--external-library-path",
		path.join(flexHome, "js", "libs", "js.swc"),
		"--output",
		swcOutputPath,
		"--include-file",
		path.join("externs", externsName),
		externsOutputPath
	];
	for(let sourcePath of sourcePaths)
	{
		sourcePath = path.join(outputDirectory, sourcePath);
		compcArgs.push("--source-path", sourcePath,
			"--include-sources", sourcePath);
	}
	var result = child_process.spawnSync(compcPath, compcArgs,
	{
		encoding: "utf8"
	});
	if(result.status === 0)
	{
		if(this.debugLevel >= TS2ASParser.DebugLevel.INFO)
		{
			console.info("Created SWC file: " + swcOutputPath);
		}
	}
	else
	{
		compilerError = true;
		console.error(result.stderr);
		console.error("Could not create SWC file. The generated ActionScript contains compile-time errors.")
	}
}

if(sourceOutputPathIsTemp)
{
	//only --outSWC was specified, so delete the source files
	rimraf.sync(outputDirectory);
}

if(compilerError)
{
	process.exit(1);
}

function getAS3FilePath(symbol: as3.PackageLevelDefinition): string
{
	let packageParts = symbol.packageName.split(".");
	packageParts.push(symbol.name + ".as");
	let pathToClass = path.join.apply(null, packageParts);
	for(let i = 0, count = sourcePaths.length; i < count; i++)
	{
		let sourcePath = sourcePaths[i];
		let as3OutputPath = path.join(outputDirectory, sourcePath, pathToClass);
		//we're trying to avoid name conflicts because file systems aren't case
		//sensitive, but the ActionScript language is case sensitive and each
		//package-level symbol needs to be in a different file.
		//as a workaround, we create multiple directories when a conflict is found.
		if(!fs.existsSync(as3OutputPath))
		{
			return as3OutputPath;
		}
	}
	let newSourcePath = "src";
	let sourcePathCount = sourcePaths.length + 1;
	if(sourcePathCount > 1)
	{
		newSourcePath += sourcePathCount;
	}
	sourcePaths.push(newSourcePath);
	let directoryPath = path.join(outputDirectory, newSourcePath);
	//avoid conflicts with files that already exist in the new src* directory
	rimraf.sync(directoryPath);
	return path.join(directoryPath, pathToClass);
}

function deleteAS3File(symbol: as3.PackageLevelDefinition)
{
	let outputFilePath = getAS3FilePath(symbol);
	if(fs.existsSync(outputFilePath))
	{
		fs.unlinkSync(outputFilePath);
	}
}
	
function writeAS3File(symbol: as3.PackageLevelDefinition, code: string)
{
	let outputFilePath = getAS3FilePath(symbol);
	let outputDirPath = path.dirname(outputFilePath);
	mkdirp.sync(outputDirPath);
	fs.writeFileSync(outputFilePath, code);
	if(this.debugLevel >= TS2ASParser.DebugLevel.WARN)
	{
		console.info("Created ActionScript file: " + outputFilePath);
	}
}

function printVersion()
{
	let packageJSONString = fs.readFileSync(path.join(__dirname, "..", "package.json"), "utf8");
	let packageJSON = JSON.parse(packageJSONString);
	console.info("Version: " + packageJSON.version);
}

function printUsage()
{
	console.info("Syntax:   dts2as [options] [file ...]");
	console.info();
	console.info("Examples: dts2as hello.d.ts");
	console.info("          dts2as file1.d.ts file2.d.ts");
	console.info("          dts2as --outSWC hello.swc hello.d.ts");
	console.info("          dts2as --outDir ./as3_generated file.d.ts");
	console.info("          dts2as --exclude com.example.SomeType file.d.ts");
	console.info();
	console.info("Options:");
	console.info(" --outSWC FILE                      Generate a compiled SWC file. Requires either FLEX_HOME environment variable or --flexHome option.");
	console.info(" --outDir DIRECTORY                 Generate ActionScript and externs files in a specific output directory.");
	console.info(" --flexHome DIRECTORY               Specify the directory where Apache FlexJS is located. Defaults to FLEX_HOME environment variable, if available.");
	console.info(" -e SYMBOL, --exclude SYMBOL        Specify the fully-qualified name of a symbol to exclude when emitting ActionScript.");
	console.info(" -i SYMBOL, --include SYMBOL        Specify the fully-qualified name of a symbol to include when emitting ActionScript. Excludes all other symbols.");
	console.info(" -t VERSION, --target VERSION       Specify ECMAScript target version for the TypeScript standard library: 'ES3', 'ES5' (default), or 'ES6'");
	console.info(" -v, --version                      Print the version of dts2as.");
}