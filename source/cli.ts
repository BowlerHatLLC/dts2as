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
/// <reference path="./parser.ts" />
/// <reference path="./as-stub-emitter.ts" />
/// <reference path="./as3.ts" />
/// <reference path="../node_modules/typescript/lib/typescript.d.ts" />

import fs = require("fs");
import path = require("path");
import minimist = require("minimist");
import TS2ASParser = require("./parser");
import ASStubEmitter = require("./as-stub-emitter");
import JSExternsEmitter = require("./js-externs-emitter");
import as3 = require("./as3");
import ts = require("typescript");
import mkdirp = require("mkdirp");

let sourceOutputPath: string;
let fileNames: string[];
let debugLevel: TS2ASParser.DebugLevel;
let excludedSymbols: string[];
let includedSymbols: string[];
let scriptTarget: ts.ScriptTarget = ts.ScriptTarget.ES5;

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
					process.exit();
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
			process.exit();
		}
		case "outDir":
		{
			sourceOutputPath = path.join(params[key]);
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
	process.exit();
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
	let packageLevelSymbols = parser.parse(fileName);
	let externsEmitter = new JSExternsEmitter(packageLevelSymbols);
	if(externsOutput.length === 0)
	{
		externsOutput += externsEmitter.emitFileHeader();
	}
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
let externsOutputPath = sourceOutputPath;
if(!externsOutputPath)
{
	externsOutputPath = path.dirname(fileNames[0]);
}
fs.writeFileSync(path.join(sourceOutputPath, "externs.js"), externsOutput);

function getAS3FilePath(symbol: as3.PackageLevelDefinition): string
{
	let as3OutputPath = sourceOutputPath;
	if(!as3OutputPath)
	{
		as3OutputPath = path.dirname(symbol.sourceFile);
	}
	let packageParts = symbol.packageName.split(".");
	packageParts.unshift(as3OutputPath);
	packageParts.push(symbol.name + ".as");
	return path.join.apply(null, packageParts);
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
	if(fs.existsSync(outputFilePath))
	{
		console.warn("Warning: Multiple ActionScript symbols share the same output file path. Skipping symbol: " + symbol.getFullyQualifiedName());
		return;
	}
	let outputDirPath = path.dirname(outputFilePath);
	mkdirp.sync(outputDirPath);
	fs.writeFileSync(outputFilePath, code);
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
	console.info("          dts2as --outDir ./as3-files file.d.ts");
	console.info("          dts2as --exclude com.example.SomeType file.d.ts");
	console.info();
	console.info("Options:");
	console.info(" --outDir DIRECTORY                 Generate ActionScript and externs files in a specific output directory.");
	console.info(" -e SYMBOL, --exclude SYMBOL        Specify the fully-qualified name of a symbol to exclude when emitting ActionScript.");
	console.info(" -i SYMBOL, --include SYMBOL        Specify the fully-qualified name of a symbol to include when emitting ActionScript. Excludes all other symbols.");
	console.info(" -t VERSION, --target VERSION       Specify ECMAScript target version for the TypeScript standard library: 'ES3', 'ES5' (default), or 'ES6'");
	console.info(" -v, --version                      Print the version of dts2as.");
}