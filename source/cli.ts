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
let verbose: boolean = false;

let params = minimist(process.argv.slice(2),
{
	boolean: ["verbose"],
	alias:
	{
		v: ["verbose"]
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
		case "verbose":
		{
			verbose = params[key];
			break;
		}
		case "outDir":
		{
			outputPath = params[key];
			break;
		}
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
parser.verbose = verbose;

let libFileName = "./node_modules/typescript/bin/lib.d.ts";
let libSourceText = fs.readFileSync(libFileName, "utf8");
parser.addExternalFile(libFileName, libSourceText);

fileNames.forEach(fileName =>
{
	let sourceText = fs.readFileSync(fileName, "utf8");
	parser.addFile(fileName, sourceText);
});

let result = parser.parse();

let emitter = new AS3Emitter(result.types);
result.types.forEach(function(as3Type:as3.PackageLevelDefinition)
{
	if(as3Type.external)
	{
		//skip this one
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
		
function writeAS3File(packageName: string, name: string, code: string)
{
	let packageParts = packageName.split(".");
	packageParts.unshift(outputPath);
	let outputDirPath = packageParts.join(path.sep);
	let outputFilePath = outputDirPath + path.sep + name + ".as"; 
	mkdirp.sync(outputDirPath);
	fs.writeFile(outputFilePath, code);
}

function printUsage()
{
	console.info("Syntax:   dts2as [options] [file ...]");
	console.info();
	console.info("Examples: dts2as hello.d.ts");
	console.info("          dts2as file1.d.ts file2.d.ts");
	console.info("          dts2as --outDir ./as3-files file.d.ts");
	console.info();
	console.info("Options:");
	console.info(" --outDir DIRECTORY                 Generate ActionScript files in a specific output directory.");
	console.info(" --verbose, -v                      Display verbose output.");
}