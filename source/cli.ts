/// <reference path="../typings/tsd.d.ts" />
/// <reference path="./parser.ts" />
/// <reference path="./emitter.ts" />
/// <reference path="./as3.ts" />

import fs = require("fs");
import path = require("path");
import minimist = require("minimist");
import TS2ASParser = require("./parser");
import AS3Emitter = require("./emitter");
import as3 = require("./as3");
let mkdirp = require("../node_modules/mkdirp");

let outputPath = "./generated";
let fileNames: string[];
let debugLevel: TS2ASParser.DebugLevel;
let excludedSymbols: string[];

let params = minimist(process.argv.slice(2),
{
	number: ["debug"],
	alias:
	{
		e: ["excludeSymbol"],
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
			outputPath = params[key];
			break;
		}
		case "excludeSymbol":
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
		case "e":
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

let parser = new TS2ASParser();
parser.debugLevel = debugLevel;

let libFileName = "./node_modules/typescript/bin/lib.d.ts";
let libSourceText = fs.readFileSync(libFileName, "utf8");
parser.setStandardLib(libFileName, libSourceText);

fileNames.forEach(fileName =>
{
	let sourceText = fs.readFileSync(fileName, "utf8");
	let result = parser.parse(fileName, sourceText);
	let emitter = new AS3Emitter(result);
	result.forEach(function(as3Type:as3.PackageLevelDefinition)
	{
		if(as3Type.external)
		{
			//skip this one
			return;
		}
		if(excludedSymbols && excludedSymbols.indexOf(as3Type.getFullyQualifiedName()) >= 0)
		{
			return;
		}
		if("superClass" in as3Type)
		{
			let as3Class = <as3.ClassDefinition> as3Type;
			writeAS3File(as3Class.packageName, as3Class.name, emitter.emitClass(as3Class));
		}
		else if("interfaces" in as3Type)
		{
			let as3Interface = <as3.InterfaceDefinition> as3Type;
			writeAS3File(as3Interface.packageName, as3Interface.name, emitter.emitInterface(as3Interface));
		}
		else if("parameters" in as3Type)
		{
			let as3PackageFunction = <as3.PackageFunctionDefinition> as3Type;
			writeAS3File(as3PackageFunction.packageName, as3PackageFunction.name, emitter.emitPackageFunction(as3PackageFunction));
		}
		else
		{
			let as3PackageVariable = <as3.PackageVariableDefinition> as3Type;
			writeAS3File(as3PackageVariable.packageName, as3PackageVariable.name, emitter.emitPackageVariable(as3PackageVariable));
		}
	});
});
	
function writeAS3File(packageName: string, name: string, code: string)
{
	let packageParts = packageName.split(".");
	packageParts.unshift(outputPath);
	let outputDirPath = packageParts.join(path.sep);
	let outputFilePath = outputDirPath + path.sep + name + ".as"; 
	mkdirp.sync(outputDirPath);
	fs.writeFileSync(outputFilePath, code);
}

function printVersion()
{
	
	let packageJSONString = fs.readFileSync(__dirname + path.sep + ".." + path.sep + "package.json", "utf8");
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
	console.info("          dts2as --excludeSymbol com.example.SomeType file.d.ts");
	console.info();
	console.info("Options:");
	console.info(" --outDir DIRECTORY                 Generate ActionScript files in a specific output directory.");
	console.info(" -e SYMBOL, --excludeSymbol SYMBOL  Specify the fully-qualified of a symbol to exclude when emitting ActionScript.");
	console.info(" --debug LEVEL                      Specify the level of debug output, in the range from 0 to 2. 0 means none, and 2 is most verbose.");
	console.info(" -v, --version                      Print the version.");
}