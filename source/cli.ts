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

import * as fs from "fs";
import * as path from "path";
import * as child_process from "child_process";
import * as minimist from "minimist";
import * as ts from "typescript";
import * as mkdirp from "mkdirp";
import * as rimraf from "rimraf";
import TS2ASParser from "./parser";
import {DebugLevel} from "./parser";
import ASStubEmitter from "./as-stub-emitter";
import JSExternsEmitter from "./js-externs-emitter";
import {findBinCompc, findFlexHome, isValidApacheFlexJSPath} from "./flexjs-utils";
import as3 = require("./as3");

let sourceOutputPathIsTemp = false;
let outputDirectory: string = null;
let swcOutputPath: string = null;
let depsSWCOutputPath: string = null;
let externsOutputPath: string = null;
let flexHome: string = null;
let fileNames: string[];
let debugLevel: DebugLevel = DebugLevel.NONE;
let excludedSymbols: string[];
let includedSymbols: string[];
let scriptTarget: ts.ScriptTarget = ts.ScriptTarget.Latest;
let moduleMetadata = false;

let params = minimist(process.argv.slice(2),
{
	boolean: ["moduleMetadata"], 
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
			if(!path.isAbsolute(swcOutputPath))
			{
				//due to a node issue where it can't run child processes on
				//windows where the process path has spaces and arguments do
				//too, we need to run compc with a weird working directory.
				//an absolute path is needed for that workaround.
				swcOutputPath = path.resolve(process.cwd(), swcOutputPath);
			}
			break;
		}
		case "outDir":
		{
			outputDirectory = path.join(params[key]);
			if(!path.isAbsolute(outputDirectory))
			{
				//see note above on outSWC argument
				outputDirectory = path.resolve(process.cwd(), outputDirectory);
			}
			break;
		}
		case "flexHome":
		{
			let path = params[key];
			if(isValidApacheFlexJSPath(path))
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
				case "ES2015":
				{
					scriptTarget = ts.ScriptTarget.ES2015;
					break;
				}
				case "ES2016":
				{
					scriptTarget = ts.ScriptTarget.ES2016;
					break;
				}
				case "ES2017":
				{
					scriptTarget = ts.ScriptTarget.ES2017;
					break;
				}
				case "Latest":
				{
					scriptTarget = ts.ScriptTarget.Latest;
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
		case "moduleMetadata":
		{
			moduleMetadata = params[key];
			break;
		}
		case "exclude":
		{
			let value = params[key];
			if(typeof value === "string")
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
			if(typeof value === "string")
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
	flexHome = findFlexHome();
}
if(outputDirectory === null)
{
	if(swcOutputPath !== null)
	{
		sourceOutputPathIsTemp = true;
	}
	outputDirectory = path.join(process.cwd(), "dts2as_generated");
}
if(swcOutputPath !== null)
{
	depsSWCOutputPath = path.join(outputDirectory, "deps.swc");
	if(flexHome === null)
	{
		console.error("--outSWC option requires Apache FlexJS. Please specify the --flexHome option or set the FLEX_HOME environment variable.");
		process.exit(1);
	}
	else
	{
		if(debugLevel >= DebugLevel.INFO)
		{
			console.info("Apache FlexJS: " + flexHome);
		}
	}
}

let parser = new TS2ASParser(scriptTarget);
parser.debugLevel = debugLevel;

function canEmit(symbol: as3.PackageLevelDefinition): boolean
{
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

let outputSourcePaths: string[] = [];
let dependencySourcePaths: string[] = [];
let externsOutput = "";
let result = parser.parse(fileNames);
let packageLevelSymbols = result.definitions;
let externsEmitter = new JSExternsEmitter(packageLevelSymbols);
if(externsOutput.length === 0)
{
	externsOutput += externsEmitter.emitFileHeader();
}
externsOutput += externsEmitter.emitPackages();
let sourceEmitter = new ASStubEmitter(packageLevelSymbols);
sourceEmitter.moduleMetadata = moduleMetadata;
packageLevelSymbols.forEach((as3Type:as3.PackageLevelDefinition) =>
{
	if(!canEmit(as3Type))
	{
		return;
	}
	let sourcePaths = outputSourcePaths;
	let directoryPrefix = "src";
	let outputExterns = true; 
	if(as3Type.external)
	{
		if(swcOutputPath === null)
		{
			//if we're not creating a SWC file, we don't need to emit 
			//the dependencies
			return;
		}
		//dependencies are kept separate so that they can be deleted later
		sourcePaths = dependencySourcePaths;
		directoryPrefix = "deps_src";
		//dependencies don't need externs
		outputExterns = false;
	}
	if("superClass" in as3Type)
	{
		let as3Class = <as3.ClassDefinition> as3Type;
		writeAS3File(as3Class, sourcePaths, directoryPrefix, sourceEmitter.emitClass(as3Class));
		if(outputExterns)
		{
			externsOutput += externsEmitter.emitClass(as3Class);
		}
	}
	else if("interfaces" in as3Type)
	{
		let as3Interface = <as3.InterfaceDefinition> as3Type;
		writeAS3File(as3Interface, sourcePaths, directoryPrefix, sourceEmitter.emitInterface(as3Interface));
		if(outputExterns)
		{
			externsOutput += externsEmitter.emitInterface(as3Interface);
		}
	}
	else if("parameters" in as3Type)
	{
		let as3PackageFunction = <as3.PackageFunctionDefinition> as3Type;
		writeAS3File(as3PackageFunction, sourcePaths, directoryPrefix, sourceEmitter.emitPackageFunction(as3PackageFunction));
		if(outputExterns)
		{
			externsOutput += externsEmitter.emitPackageFunction(as3PackageFunction);
		}
	}
	else if("uri" in as3Type)
	{
		let as3Namespace = <as3.NamespaceDefinition> as3Type;
		writeAS3File(as3Namespace, sourcePaths, directoryPrefix, sourceEmitter.emitNamespace(as3Namespace));
	}
	else
	{
		let as3PackageVariable = <as3.PackageVariableDefinition> as3Type;
		writeAS3File(as3PackageVariable, sourcePaths, directoryPrefix, sourceEmitter.emitPackageVariable(as3PackageVariable));
		if(outputExterns)
		{
			externsOutput += externsEmitter.emitPackageVariable(as3PackageVariable);
		}
	}
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
if(debugLevel >= DebugLevel.INFO)
{
	console.info("Created JavaScript externs file: " + externsOutputPath);
}

let compilerError = null;
if(swcOutputPath !== null)
{
	//if the SWC files already exist, delete them to avoid confusion
	if(fs.existsSync(swcOutputPath))
	{
		fs.unlinkSync(swcOutputPath);
	}
	if(fs.existsSync(depsSWCOutputPath))
	{
		fs.unlinkSync(depsSWCOutputPath);
	}
	if(dependencySourcePaths.length > 0)
	{
		let result = compileSWC(dependencySourcePaths, null, depsSWCOutputPath);
		if(result.status !== 0)
		{
			compilerError = result.stderr;
		}
		else
		{
			if(debugLevel >= DebugLevel.INFO)
			{
				console.info("Created SWC file for dependencies: " + depsSWCOutputPath);
			}
			let result = compileSWC(outputSourcePaths, externsOutputPath, swcOutputPath);
			if(result.status !== 0)
			{
				compilerError = result.stderr;
			}
		}
	}
	else
	{
		//no dependencies to compile, so set to null
		depsSWCOutputPath = null;
		
		let result = compileSWC(outputSourcePaths, externsOutputPath, swcOutputPath);
		if(result.status !== 0)
		{
			compilerError = result.stderr;
		}
	}
	if(compilerError)
	{
		console.error(compilerError);
		console.error("Could not create SWC file. The generated ActionScript contains compile-time errors.");
	}
	else if(debugLevel >= DebugLevel.INFO)
	{
		console.info("Created SWC file: " + swcOutputPath);
	}
}

if(sourceOutputPathIsTemp)
{
	//only --outSWC was specified, so delete the source files
	rimraf.sync(outputDirectory);
}
else
{
	//dependencies are temporary and should be deleted
	if(depsSWCOutputPath !== null && fs.existsSync(depsSWCOutputPath))
	{
		fs.unlinkSync(depsSWCOutputPath);
	}
	dependencySourcePaths.forEach((sourcePath: string) =>
	{
		sourcePath = path.join(outputDirectory, sourcePath);
		rimraf.sync(sourcePath);
	});
}

if(compilerError)
{
	process.exit(1);
}

function compileSWC(sourcePaths: string[], externsPath: string, swcPath: string)
{
	let swcName = path.basename(swcPath, ".swc");
	let externsName = swcName + ".js";
	let compcPath = findBinCompc(flexHome);
	if(compcPath === null)
	{
		console.error("Could not find bin/compc in Apache FlexJS directory.");
		process.exit(1);
	}
	let compcArgs =
	[
		"--load-config=" + path.join(__dirname, "custom-flex-config.xml"),
		"--output",
		swcPath
	];
	if(depsSWCOutputPath !== null && swcPath !== depsSWCOutputPath)
	{
		compcArgs.splice(1, 0, "--external-library-path=" + depsSWCOutputPath);
	}
	if(externsPath !== null)
	{
		compcArgs.push("--include-file");
		compcArgs.push(path.join("externs", externsName));
		compcArgs.push(externsPath);
	}
	for(let sourcePath of sourcePaths)
	{
		sourcePath = path.join(outputDirectory, sourcePath);
		compcArgs.push("--source-path", sourcePath,
			"--include-sources", sourcePath);
	}
	//we need to use ./compc to avoid launching a different version of compc
	//that might be added to the PATH environment variable.
	let compcCommand = "." + path.sep + path.basename(compcPath);
	if(debugLevel >= DebugLevel.INFO)
	{
		console.info("Running: " + compcCommand + " " + compcArgs.join(" "));
	}
	let result = child_process.spawnSync(compcCommand, compcArgs,
	{
		//node on windows can't seem to run executables with spaces in the path
		//and also accept arguments with spaces. changing the working directory
		//is a workaround to avoid spaces in the executable path.
		cwd: path.dirname(compcPath),
		encoding: "utf8"
	});
	return result;
}

function checkAS3FilePath(outputSourcePath: string, packageParts: string[]): string
{
	let currentPath = outputSourcePath;
	let partsCount = packageParts.length;
	let index = 0;
	do
	{
		let next = packageParts[index];
		index++;
		let nextLowerCase = next.toLowerCase();
		let files = fs.readdirSync(currentPath);
		for(let i = 0, count = files.length; i < count; i++)
		{
			let file = files[i];
			if(file.toLowerCase() === nextLowerCase &&
				file !== next)
			{
				//we cannot add this file to the source path because it already contains
				//a package or file with the same name in a different case
				return null;
			}
		}
		currentPath = path.join(currentPath, next);
		if(!fs.existsSync(currentPath))
		{
			//if the path does not exist, then there can't be a conflict
			let packagePath = path.join.apply(null, packageParts);
			return path.join(outputSourcePath, packagePath);
		}
	}
	while(index < partsCount)
	return currentPath;
}

function getAS3FilePath(symbol: as3.PackageLevelDefinition, sourcePaths: string[], directoryPrefix: string): string
{
	let packageParts = symbol.packageName.split(".");
	packageParts.push(symbol.name + ".as");
	for(let i = 0, count = sourcePaths.length; i < count; i++)
	{
		let sourcePath = sourcePaths[i];
		let outputSourcePath = path.join(outputDirectory, sourcePath);
		//we're trying to avoid name conflicts because file systems aren't case
		//sensitive, but the ActionScript language is case sensitive and each
		//package-level symbol needs to be in a different file. that's why we
		//can't simply call fs.existsSync() here.
		//as a workaround, we create multiple directories when a conflict is found.
		let as3FilePath = checkAS3FilePath(outputSourcePath, packageParts);
		if(as3FilePath !== null)
		{
			return as3FilePath;
		}
	}
	let newSourcePath = directoryPrefix;
	let sourcePathCount = sourcePaths.length + 1;
	if(sourcePathCount > 1)
	{
		newSourcePath += sourcePathCount;
	}
	sourcePaths.push(newSourcePath);
	let directoryPath = path.join(outputDirectory, newSourcePath);
	//avoid conflicts with files that already exist in the new src* directory
	rimraf.sync(directoryPath);
	let pathToClass = path.join.apply(null, packageParts);
	return path.join(directoryPath, pathToClass);
}
	
function writeAS3File(symbol: as3.PackageLevelDefinition, sourcePaths: string[], directoryPrefix: string, code: string)
{
	let outputFilePath = getAS3FilePath(symbol, sourcePaths, directoryPrefix);
	let outputDirPath = path.dirname(outputFilePath);
	mkdirp.sync(outputDirPath);
	fs.writeFileSync(outputFilePath, code);
	if(debugLevel >= DebugLevel.INFO)
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
	console.info("        dts2as file1.d.ts file2.d.ts");
	console.info("        dts2as --outSWC hello.swc hello.d.ts");
	console.info("        dts2as --outDir ./as3_generated file.d.ts");
	console.info("        dts2as --exclude com.example.SomeType file.d.ts");
	console.info();
	console.info("Options:");
	console.info(" --outSWC FILE                     Generate a compiled SWC file. Requires either FLEX_HOME environment variable or --flexHome option.");
	console.info(" --outDir DIRECTORY                Generate ActionScript and externs files in a specific output directory. Defaults to './dts2as_generated'.");
	console.info(" --flexHome DIRECTORY              Specify the directory where Apache FlexJS is located. Defaults to FLEX_HOME environment variable, if available.");
	console.info(" --moduleMetadata                  Include [JSModule] metadata for external modules.")
	console.info(" -e SYMBOL, --exclude SYMBOL       Specify the fully-qualified name of a symbol to exclude when emitting ActionScript.");
	console.info(" -i SYMBOL, --include SYMBOL       Specify the fully-qualified name of a symbol to include when emitting ActionScript. Excludes all other symbols.");
	console.info(" -t VERSION, --target VERSION      Specify ECMAScript target version for the TypeScript standard library: 'ES3', 'ES5', 'ES2015', 'ES2016', 'ES2017', or 'Latest' (default)");
	console.info(" -v, --version                     Print the version of dts2as.");
}