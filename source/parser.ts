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
/// <reference path="./as3.ts" />
/// <reference path="../typings/tsd.d.ts" />

import path = require("path");
import fs = require("fs");
import as3 = require("./as3");
import ts = require("typescript");

class StaticSideClassDefinition extends as3.ClassDefinition
{
	constructor(name: string, packageName: string, accessLevel: string, sourceFile: string, require: string)
	{
		super(name, packageName, accessLevel, sourceFile, require, true);
	}
}

class ParserPropertyDefinition extends as3.PropertyDefinition
{
	forceStatic: boolean = false;
} 

class ParserMethodDefinition extends as3.MethodDefinition
{
	forceStatic: boolean = false;
} 

enum TypeScriptBuiltIns
{
	any,
	number,
	boolean,
	string,
	void
}

//the following top level classes are marked as dynamic in AS3
const DYNAMIC_CLASSES =
[
	"ArgumentError",
	"Array",
	"Date",
	"Error",
	"EvalError",
	"Object",
	"RangeError",
	"ReferenceError",
	"RegExp",
	"SyntaxError",
	"TypeError",
	"URIError"
];

let TS_TO_AS3_TYPE_MAP = {};
TS_TO_AS3_TYPE_MAP[TypeScriptBuiltIns[TypeScriptBuiltIns.number]] = as3.BuiltIns[as3.BuiltIns.Number];
TS_TO_AS3_TYPE_MAP[TypeScriptBuiltIns[TypeScriptBuiltIns.boolean]] = as3.BuiltIns[as3.BuiltIns.Boolean];
TS_TO_AS3_TYPE_MAP[TypeScriptBuiltIns[TypeScriptBuiltIns.string]] =  as3.BuiltIns[as3.BuiltIns.String];
TS_TO_AS3_TYPE_MAP[TypeScriptBuiltIns[TypeScriptBuiltIns.any]] =  as3.BuiltIns[as3.BuiltIns.Object];
TS_TO_AS3_TYPE_MAP[TypeScriptBuiltIns[TypeScriptBuiltIns.void]] =  as3.BuiltIns[as3.BuiltIns.void];

class TS2ASParser
{
	constructor(scriptTarget: ts.ScriptTarget = ts.ScriptTarget.ES5)
	{
		this._scriptTarget = scriptTarget;
	}
	
	private _sourceFiles: ts.SourceFile[];
	private _definitions: as3.PackageLevelDefinition[];
	private _functionAliases: string[];
	private _typeAliasMap: any;
	private _typeParameterMap: any;
	private _importModuleMap: any;
	private _currentSourceFile: ts.SourceFile;
	private _currentFileIsExternal: boolean;
	private _moduleStack: string[];
	private _currentModuleRequire: string;
	private _variableStatementHasDeclareKeyword: boolean = false;
	private _variableStatementHasExport: boolean = false;
	private _scriptTarget: ts.ScriptTarget;
	private _promoted: { [key: string]: as3.ClassDefinition[] };
	debugLevel: TS2ASParser.DebugLevel = TS2ASParser.DebugLevel.NONE;
	
	parse(fileNames: string[]): TS2ASParser.ParserResult
	{
		this._functionAliases = [];
		this._typeAliasMap = {};
		this._typeParameterMap = {};
		this._importModuleMap = {};
		this._sourceFiles = [];
		this._promoted = {};
		fileNames.forEach((fileName: string) =>
		{
			this.findSourceFiles(fileName);
		});
		let referencedFileIsStandardLib = this._sourceFiles.some((sourceFile) =>
		{
			return sourceFile.hasNoDefaultLib;
		});
		if(referencedFileIsStandardLib)
		{
			if(this.debugLevel >= TS2ASParser.DebugLevel.INFO)
			{
				console.info("Referenced files contain a standard library.");
			}
			this._definitions = [];
		}
		else
		{
			if(this.debugLevel >= TS2ASParser.DebugLevel.INFO)
			{
				console.info("Using default standard library for script target.");
			}
			this.readStandardLibrary();
		}
		this._sourceFiles.forEach((sourceFile, index) =>
		{
			this._currentFileIsExternal = !fileNames.some((fileName) =>
			{
				fileName = path.resolve(fileName); 
				return fileName === sourceFile.fileName;
			});
			this.readSourceFile(sourceFile);
		});
		this._sourceFiles.forEach((sourceFile, index) =>
		{
			this._currentFileIsExternal = index !== (this._sourceFiles.length - 1);
			this.populatePackageLevelDefinitions(sourceFile);
			this.promoteInterfaces();
			this.cleanupStaticSideDefinitions();
			this.cleanupMembersWithForceStaticFlag();
		});
		this.cleanupBuiltInTypes();
		return { definitions: this._definitions, hasNoDefaultLib: referencedFileIsStandardLib };
	}
	
	private findStandardLibrary()
	{
		let standardLibFileName: string;
		switch(this._scriptTarget)
		{
			case ts.ScriptTarget.ES3:
			case ts.ScriptTarget.ES5:
			{
				standardLibFileName = "lib.d.ts";
				break;
			}
			case ts.ScriptTarget.ES6:
			{
				standardLibFileName = "lib.es6.d.ts";
				break;
			}
			default:
			{
				throw new Error("Unknown ts.ScriptTarget: " + this._scriptTarget);
			}
		}
		let standardLibPath = require.resolve("typescript");
		standardLibPath = path.dirname(standardLibPath);
		standardLibPath = path.resolve(standardLibPath, standardLibFileName);
		return standardLibPath;
	}
	
	private readStandardLibrary()
	{
		let standardLibPath = this.findStandardLibrary();
		if(!fs.existsSync(standardLibPath))
		{
			throw new Error("Cannot find standard library with path " + standardLibPath);
		}
		let sourceText = fs.readFileSync(standardLibPath, "utf8");
		let sourceFile = ts.createSourceFile(standardLibPath, sourceText, this._scriptTarget);
		this._definitions = [];
		this._currentFileIsExternal = true;
		this.readSourceFile(sourceFile);
		this.populatePackageLevelDefinitions(sourceFile);
		this.promoteInterfaces();
	}
	
	private sourceFileExists(fileName: string)
	{
		return this._sourceFiles.some((otherSourceFile) =>
		{
			return otherSourceFile.fileName === fileName;
		});
	}
	
	private findSourceFiles(fileName: string)
	{
		fileName = path.resolve(fileName);
		let sourceText = fs.readFileSync(fileName, "utf8");
		let sourceFile = ts.createSourceFile(fileName, sourceText, this._scriptTarget);
		if(this.sourceFileExists(fileName))
		{
			return;
		}
		//add referenced files first, and everything will end up in the
		//correct order
		sourceFile.referencedFiles.forEach((fileReference) =>
		{
			let fileName = path.resolve(path.dirname(sourceFile.fileName), fileReference.fileName);
			if(this.sourceFileExists(fileName))
			{
				return;
			}
			this.findSourceFiles(fileName);
		});
		this._sourceFiles.push(sourceFile);
	}
	
	private readSourceFile(sourceFile: ts.SourceFile)
	{
		this._moduleStack = [];
		if(sourceFile.hasNoDefaultLib)
		{
			//void is a special type that is defined by the language, and it
			//doesn't appear in the standard library. we need to add it
			//manually.
			this._definitions.push(new as3.InterfaceDefinition("void", null, null, null, null, true));
		}
		this.readPackageLevelDefinitions(sourceFile);
		if(sourceFile.hasNoDefaultLib)
		{
			this.addDynamicFlagToStandardLibraryClasses();
		}
	}
	
	private addDynamicFlagToStandardLibraryClasses()
	{
		for(let fullyQualifiedName of DYNAMIC_CLASSES)
		{
			let classToMakeDynamic = <as3.ClassDefinition> as3.getDefinitionByName(fullyQualifiedName, this._definitions);
			if(classToMakeDynamic)
			{
				classToMakeDynamic.dynamic = true;
			}
		}
	}

	private isNameInPackage(name: string, packageName: string)
	{
		let fullyQualifiedName = name;
		if(packageName.length > 0)
		{
			fullyQualifiedName = packageName + "." + name;
		}
		if(this._functionAliases.indexOf(fullyQualifiedName) >= 0)
		{
			return true;
		}
		return as3.getDefinitionByName(fullyQualifiedName, this._definitions) !== null;
	}
	
	private mergeFunctionParameters(parametersToKeep: as3.ParameterDefinition[], parametersToMerge: as3.ParameterDefinition[])
	{
		let methodToKeepParamsCount = parametersToKeep.length;
		for(let j = 0, paramCount = parametersToMerge.length; j < paramCount; j++)
		{
			let paramToMerge = parametersToMerge[j];
			if(methodToKeepParamsCount <= j)
			{
				parametersToKeep[j] = paramToMerge;
			}
			let paramToKeep = parametersToKeep[j];
			if(paramToKeep.isRest)
			{
				//we already have a ...rest argument, and that must be the last
				//one so, we can ignore the rest of the parameters to merge
				break;
			}
			if(paramToMerge.isRest)
			{
				//the parameters to merge have a ...rest argument earlier than
				//what we have already, so we need to remove any remaining
				//arguments so that the ...rest is the last argument
				
				//we don't know if the name is relevant, so let's go generic
				paramToMerge.name = "rest";
				parametersToKeep.length = j;
				parametersToKeep[j] = paramToMerge;
			}
			paramToKeep.type = this.mergeTypes(paramToKeep.type, paramToMerge.type);
		}
	}
	
	private mergeTypes(type1: as3.TypeDefinition, type2: as3.TypeDefinition): as3.TypeDefinition
	{
		if(type1 === type2)
		{
			return type1;
		}
		//the overload has a different type, so generalize to a common
		//super class, if possible
		let commonType: as3.TypeDefinition;
		if(type1 instanceof as3.ClassDefinition &&
			type2 instanceof as3.ClassDefinition)
		{
			commonType = as3.getCommonBaseClass(type1, type2);
		}
		if(!commonType)
		{
			//fall back to Object if there is no common base class
			commonType = <as3.TypeDefinition> as3.getDefinitionByName(as3.BuiltIns[as3.BuiltIns.Object], this._definitions);
		}
		return commonType;
	}
	
	//checks the kind property of the TypeNode to see if a type can be
	//determined without parsing the raw text.
	private getAS3TypeFromTypeNodeKind(type: ts.TypeNode): as3.TypeDefinition
	{
		let fullyQualifiedName: string = null;
		if(type)
		{
			switch(type.kind)
			{
				case ts.SyntaxKind.FunctionType:
				{
					fullyQualifiedName = as3.BuiltIns[as3.BuiltIns.Function];
					break;
				}
				case ts.SyntaxKind.ConstructorType:
				{
					fullyQualifiedName = as3.BuiltIns[as3.BuiltIns.Function];
					break;
				}
				case ts.SyntaxKind.UnionType:
				{
					let unionType = <ts.UnionTypeNode> type;
					let commonBaseClass = this.getCommonBaseClassFromUnionOrIntersectionType(unionType);
					if(commonBaseClass)
					{
						return commonBaseClass;
					}
					fullyQualifiedName = as3.BuiltIns[as3.BuiltIns.Object];
					break;
				}
				case ts.SyntaxKind.TypeLiteral:
				{
					fullyQualifiedName = as3.BuiltIns[as3.BuiltIns.Object];
					break;
				}
				case ts.SyntaxKind.StringLiteral:
				{
					fullyQualifiedName = as3.BuiltIns[as3.BuiltIns.String];
					break;
				}
				case ts.SyntaxKind.ArrayType:
				{
					fullyQualifiedName = as3.BuiltIns[as3.BuiltIns.Array];
					break;
				}
				case ts.SyntaxKind.TupleType:
				{
					fullyQualifiedName = as3.BuiltIns[as3.BuiltIns.Array];
					break;
				}
				case ts.SyntaxKind.TypeQuery:
				{
					fullyQualifiedName = as3.BuiltIns[as3.BuiltIns.Function];
					break;
				}
				case ts.SyntaxKind.TypePredicate:
				{
					fullyQualifiedName = as3.BuiltIns[as3.BuiltIns.Boolean];
					break;
				}
			}
		}
		else
		{
			fullyQualifiedName = as3.BuiltIns[as3.BuiltIns.void];
		}
		if(fullyQualifiedName)
		{
			return <as3.TypeDefinition> as3.getDefinitionByName(fullyQualifiedName, this._definitions);
		}
		return null;
	}
	
	private simplifyTypeNode(type: ts.TypeNode): string
	{
		let typeInSource = this._currentSourceFile.text.substring(ts["skipTrivia"](this._currentSourceFile.text, type.pos), type.end);
		typeInSource = typeInSource.trim();
		//strip <T> section of generics
		let startGenericIndex = typeInSource.indexOf("<");
		if(startGenericIndex >= 0)
		{
			typeInSource = typeInSource.substr(0, startGenericIndex);
		}
		//strip [] section of array
		let endArrayIndex = typeInSource.lastIndexOf("]");
		if(endArrayIndex === typeInSource.length - 1)
		{ 
			if(typeInSource.indexOf("[") === 0)
			{
				typeInSource = typeInSource.substr(1, endArrayIndex - 1);
			}
			else
			{
				typeInSource = typeInSource.substr(0, endArrayIndex - 1);
			}
		}
		return typeInSource;
	}
	
	private getAS3FullyQualifiedNameFromTSTypeNode(type: ts.TypeNode): string
	{
		let result = this.getAS3TypeFromTypeNodeKind(type);
		if(result)
		{
			return result.getFullyQualifiedName();
		}
		
		let typeInSource = this.simplifyTypeNode(type);
		if(typeInSource in this._typeParameterMap)
		{
			typeInSource = this._typeParameterMap[typeInSource];
		}
		if(typeInSource in this._typeAliasMap)
		{
			typeInSource = this._typeAliasMap[typeInSource];
		}
		for(let moduleAlias in this._importModuleMap)
		{
			if(typeInSource.indexOf(moduleAlias) === 0)
			{
				let alias = this._importModuleMap[moduleAlias];
				typeInSource = alias + typeInSource.substr(moduleAlias.length);
			}
		}
		var moduleStack = this._moduleStack.slice();
		while(moduleStack.length > 0)
		{
			let packageName = moduleStack.join(".");
			if(this.isNameInPackage(typeInSource, packageName))
			{
				typeInSource = packageName + "." + typeInSource;
				break;
			}
			moduleStack.pop();
		}
		if(this._functionAliases.indexOf(typeInSource) >= 0)
		{
			return as3.BuiltIns[as3.BuiltIns.Function];
		}
		if(TS_TO_AS3_TYPE_MAP.hasOwnProperty(typeInSource))
		{
			return TS_TO_AS3_TYPE_MAP[typeInSource];
		}
		return typeInSource;
	}
	
	private getAS3TypeFromTSTypeNode(type: ts.TypeNode): as3.TypeDefinition
	{
		let typeName = this.getAS3FullyQualifiedNameFromTSTypeNode(type);
		return <as3.TypeDefinition> as3.getDefinitionByName(typeName, this._definitions);
	}
	
	private getCommonBaseClassFromUnionOrIntersectionType(unionType: ts.UnionOrIntersectionTypeNode): as3.TypeDefinition
	{
		let types = unionType.types;
		let baseClass = this.getAS3TypeFromTSTypeNode(types[0]);
		let unionTypeText = this._currentSourceFile.text.substring(ts["skipTrivia"](this._currentSourceFile.text, unionType.pos), unionType.end);
		if(!(baseClass instanceof as3.ClassDefinition))
		{
			return <as3.ClassDefinition> as3.getDefinitionByName(as3.BuiltIns[as3.BuiltIns.Object], this._definitions);
		}
		for(let i = 1, count = types.length; i < count; i++)
		{
			let otherClass = this.getAS3TypeFromTSTypeNode(types[i]);
			if(!(otherClass instanceof as3.ClassDefinition))
			{
				return <as3.ClassDefinition> as3.getDefinitionByName(as3.BuiltIns[as3.BuiltIns.Object], this._definitions);
			}
			baseClass = as3.getCommonBaseClass(<as3.ClassDefinition> baseClass, <as3.ClassDefinition> otherClass);
			if(!baseClass)
			{
				return <as3.ClassDefinition> as3.getDefinitionByName(as3.BuiltIns[as3.BuiltIns.Object], this._definitions);
			}
		}
		return baseClass;
	}
	
	private declarationNameToString(name: ts.DeclarationName): string
	{
		let result = this._currentSourceFile.text.substring(ts["skipTrivia"](this._currentSourceFile.text, name.pos), name.end);
		if(result.indexOf("\"") === 0 || result.indexOf("'") === 0)
		{
			//modules may be named as a string that needs to be required
			result = result.substr(1, result.length - 2);
		}
		return result.trim();
	}
	
	private getAccessLevel(node: ts.Node): string
	{
		if(this._variableStatementHasDeclareKeyword || this._variableStatementHasExport)
		{
			return as3.AccessModifiers[as3.AccessModifiers.public];
		}
		if((node.flags & ts.NodeFlags.Export) === ts.NodeFlags.Export)
		{
			return as3.AccessModifiers[as3.AccessModifiers.public];
		}
		var declareKeyword: boolean = false;
		ts.forEachChild(node, (node) =>
		{
		   if(node.kind === ts.SyntaxKind.DeclareKeyword)
		   {
			   declareKeyword = true;
		   }
		});
		if(declareKeyword)
		{
			return as3.AccessModifiers[as3.AccessModifiers.public];
		}
		return as3.AccessModifiers[as3.AccessModifiers.internal];
	}
		
	private addConstructorMethodToAS3Class(as3Class: as3.ClassDefinition, constructorMethodToAdd: as3.ConstructorDefinition)
	{
		if(as3Class.constructorMethod)
		{
			this.mergeFunctionParameters(as3Class.constructorMethod.parameters,
				constructorMethodToAdd.parameters);
		}
		else
		{
			as3Class.constructorMethod = constructorMethodToAdd;
		}
	}
		
	private addMethodToAS3Type(as3Type: as3.TypeDefinition, methodToAdd: as3.MethodDefinition)
	{
		//first, we need to check if this is an overload
		for(let i = 0, methodCount = as3Type.methods.length; i < methodCount; i++)
		{
			let existingMethod = as3Type.methods[i];
			if(existingMethod.name !== methodToAdd.name ||
				existingMethod.isStatic !== methodToAdd.isStatic)
			{
				continue;
			}
			//we'll ignore overloads for now
			return;
		}
		//otherwise, add the new method
		as3Type.methods.push(methodToAdd);
	}
	
	private readPackageLevelDefinitions(node: ts.Node)
	{
		switch(node.kind)
		{
			case ts.SyntaxKind.SourceFile:
			{
				this._currentSourceFile = <ts.SourceFile> node;
				ts.forEachChild(node, (node) =>
				{
					if(node.kind === ts.SyntaxKind.EndOfFileToken)
					{
						//safe to ignore end of file
						return;
					}
					this.readPackageLevelDefinitions(node);
				});
				break;
			}
			case ts.SyntaxKind.ModuleBlock:
			{
				ts.forEachChild(node, (node) =>
				{
					if(node.kind === ts.SyntaxKind.ImportDeclaration)
					{
						//safe to ignore import declarations until later
						return;
					}
					if(node.kind === ts.SyntaxKind.ExportAssignment)
					{
						//safe to ignore export assignments until later
						return;
					}
					this.readPackageLevelDefinitions(node);
				});
				break;
			}
			case ts.SyntaxKind.ModuleDeclaration:
			{
				let moduleDeclaration = <ts.ModuleDeclaration> node;
				let moduleName = moduleDeclaration.name;
				this._moduleStack.push(this.declarationNameToString(moduleName));
				if(moduleName.kind === ts.SyntaxKind.StringLiteral)
				{
					this._currentModuleRequire = this.declarationNameToString(moduleName);
				}
				ts.forEachChild(node, (node) =>
				{
					if(node.kind === ts.SyntaxKind.Identifier ||
						node.kind === ts.SyntaxKind.StringLiteral)
					{
						//safe to skip name of module
						return;
					}
					if(node.kind === ts.SyntaxKind.DeclareKeyword)
					{
						//safe to skip declare keyword
						return;
					}
					if(node.kind === ts.SyntaxKind.ExportKeyword)
					{
						//safe to skip export keyword
						return;
					}
					this.readPackageLevelDefinitions(node);
				});
				this._currentModuleRequire = null;
				this._moduleStack.pop();
				break;
			}
			case ts.SyntaxKind.FunctionDeclaration:
			{
				let as3PackageFunction = this.readPackageFunction(<ts.FunctionDeclaration> node);
				//if the function already exists, readPackageFunction() will return null
				if(as3PackageFunction)
				{
					if(this.debugLevel >= TS2ASParser.DebugLevel.INFO && !as3PackageFunction.external)
					{
						console.info("Package Function: " + as3PackageFunction.getFullyQualifiedName());
					}
					this._definitions.push(as3PackageFunction);
				}
				break;
			}
			case ts.SyntaxKind.VariableStatement:
			{
				ts.forEachChild(node, (node) =>
				{
					if(node.kind === ts.SyntaxKind.DeclareKeyword)
					{
						this._variableStatementHasDeclareKeyword = true;
					}
					else if(node.kind === ts.SyntaxKind.ExportKeyword)
					{
						this._variableStatementHasExport = true;
					}
					else
					{
						this.readPackageLevelDefinitions(node);
					}
				});
				this._variableStatementHasDeclareKeyword = false;
				this._variableStatementHasExport = false;
				break;
			}
			case ts.SyntaxKind.VariableDeclarationList:
			{
				ts.forEachChild(node, this.readPackageLevelDefinitions.bind(this));
				break;
			}
			case ts.SyntaxKind.VariableDeclaration:
			{
				let as3PackageVariable = this.readPackageVariable(<ts.VariableDeclaration> node);
				//if it's a decomposed class, readPackageVariable() will return null
				if(as3PackageVariable)
				{
					if(this.debugLevel >= TS2ASParser.DebugLevel.INFO && !as3PackageVariable.external)
					{
						console.info("Package Variable: " + as3PackageVariable.getFullyQualifiedName());
					}
					this._definitions.push(as3PackageVariable);
				}
				else 
				{
					let nodeName = (<ts.VariableDeclaration> node).name;
					let className = this.declarationNameToString(nodeName);
					let packageName = this._moduleStack.join(".");
					if(packageName)
					{
						className = packageName + "." + className;
					}
					let as3Class = as3.getDefinitionByName(className, this._definitions);
					if(this.debugLevel >= TS2ASParser.DebugLevel.INFO && !as3Class.external)
					{
						console.info("Replace Interface/Variable with Class: " + as3Class.getFullyQualifiedName());
					}
				}
				break;
			}
			case ts.SyntaxKind.InterfaceDeclaration:
			{
				let as3Interface = this.readInterface(<ts.InterfaceDeclaration> node);
				if(as3Interface instanceof StaticSideClassDefinition)
				{
					if(this.debugLevel >= TS2ASParser.DebugLevel.INFO && !as3Interface.external)
					{
						console.info("Replace Interface with Static-side Class: " + as3Interface.getFullyQualifiedName());
					}
					this._definitions.push(as3Interface);
				}
				else if(as3Interface instanceof as3.InterfaceDefinition)
				{
					if(this.debugLevel >= TS2ASParser.DebugLevel.INFO && !as3Interface.external)
					{
						console.info("Interface: " + as3Interface.getFullyQualifiedName());
					}
					this._definitions.push(as3Interface);
				}
				//if it's a function alias, readInterface() will return null
				break;
			}
			case ts.SyntaxKind.ClassDeclaration:
			{
				let as3Class = this.readClass(<ts.ClassDeclaration> node);
				if(this.debugLevel >= TS2ASParser.DebugLevel.INFO && !as3Class.external)
				{
					console.info("Class: " + as3Class.getFullyQualifiedName());
				}
				this._definitions.push(as3Class);
				break;
			}
			case ts.SyntaxKind.TypeAliasDeclaration:
			{
				let typeAliasDeclaration = <ts.TypeAliasDeclaration> node;
				let aliasName = this.declarationNameToString(typeAliasDeclaration.name);
				let aliasType = this.getAS3TypeFromTSTypeNode(typeAliasDeclaration.type);
				this._typeAliasMap[aliasName] = aliasType.getFullyQualifiedName();
				if(this.debugLevel >= TS2ASParser.DebugLevel.INFO && !this._currentFileIsExternal)
				{
					console.info("Creating type alias from " + aliasName + " to " + aliasType.getFullyQualifiedName() + ".");
				}
				break;
			}
			default:
			{
				if(this.debugLevel >= TS2ASParser.DebugLevel.WARN && !this._currentFileIsExternal)
				{
					console.warn("Unknown SyntaxKind: " + node.kind.toString());
					console.warn(this._currentSourceFile.text.substring(node.pos, node.end));
				}
				break;
			}
		}
	}
	
	private copyMembers(fromType: as3.TypeDefinition, toType: as3.TypeDefinition, makeStatic: boolean)
	{
		for(let property of fromType.properties)
		{
			let accessLevel = property.accessLevel;
			if(makeStatic)
			{
				accessLevel = as3.AccessModifiers[as3.AccessModifiers.public];
			}
			let newProperty = new ParserPropertyDefinition(property.name, accessLevel, property.type, property.isStatic, property.isConstant);
			newProperty.forceStatic = makeStatic;
			toType.properties.push(newProperty);
		}
		for(let method of fromType.methods)
		{
			let accessLevel = method.accessLevel;
			if(makeStatic)
			{
				accessLevel = as3.AccessModifiers[as3.AccessModifiers.public];
			}
			let newMethod = new ParserMethodDefinition(method.name, method.type, method.parameters.slice(), accessLevel, method.isStatic);
			newMethod.forceStatic = makeStatic;
			toType.methods.push(newMethod);
		}
	}
	
	private extendsClass(interfaceDeclaration: ts.InterfaceDeclaration)
	{
		if(!interfaceDeclaration.heritageClauses)
		{
			return;
		}
		return interfaceDeclaration.heritageClauses.some((heritageClause: ts.HeritageClause) =>	
		{
			if(heritageClause.token !== ts.SyntaxKind.ExtendsKeyword)
			{
				return false;
			}
			return heritageClause.types.some((type: ts.TypeNode) =>
			{
				let otherInterface = this.getAS3TypeFromTSTypeNode(type);
				return otherInterface instanceof as3.ClassDefinition;
			});
		});
	}
	
	private assignExport(exportAssignment: ts.ExportAssignment)
	{
		let assignedIdentifier = null;
		ts.forEachChild(exportAssignment, (node) =>
		{
			if(node.kind === ts.SyntaxKind.Identifier)
			{
				assignedIdentifier = this.declarationNameToString(<ts.Identifier> node);
			}
		});
		if(!assignedIdentifier)
		{
			return;
		}
		let exportedDefinition = as3.getDefinitionByName(assignedIdentifier, this._definitions);
		if(exportedDefinition)
		{
			exportedDefinition.require = this._currentModuleRequire;
		}
		else
		{
			let currentStack = this._moduleStack.join(".")
			let innerModule = assignedIdentifier;
			if(currentStack.length > 0)
			{
				innerModule = currentStack + "." + innerModule; 
			}
			this._definitions.forEach((definition) =>
			{
				let packageName = definition.packageName;
				if(packageName !== null &&
					packageName.indexOf(innerModule) === 0)
				{
					definition.packageName = packageName.replace(innerModule, currentStack);
				}
			});
		}
	}
	
	private populateImport(importDeclaration: ts.ImportDeclaration)
	{
		if(!importDeclaration.importClause)
		{
			return;
		}
		let moduleSpecifier = importDeclaration.moduleSpecifier;
		let moduleName = this.declarationNameToString(<ts.LiteralExpression> moduleSpecifier);
		let namedBindings = importDeclaration.importClause.namedBindings;
		if("name" in namedBindings)
		{
			let nsImport = <ts.NamespaceImport> namedBindings
			let moduleAlias = this.declarationNameToString(nsImport.name);
			this._importModuleMap[moduleAlias] = moduleName;
		}
		else if(this.debugLevel >= TS2ASParser.DebugLevel.WARN)
		{
			console.warn("Warning: Unable to parse import declaration.");
			console.warn(this._currentSourceFile.text.substring(importDeclaration.pos, importDeclaration.end));
		}
	}
	
	private populatePackageLevelDefinitions(node: ts.Node)
	{
		switch(node.kind)
		{
			case ts.SyntaxKind.SourceFile:
			{
				this._currentSourceFile = <ts.SourceFile> node;
				ts.forEachChild(node, (node) =>
				{
					if(node.kind === ts.SyntaxKind.EndOfFileToken)
					{
						//safe to ignore end of file token in source file
						return;
					}
					if(node.kind === ts.SyntaxKind.TypeAliasDeclaration)
					{
						//we took care of type aliases in the first pass
						return;
					}
					this.populatePackageLevelDefinitions(node);
				});
				break;
			}
			case ts.SyntaxKind.ModuleBlock:
			{
				ts.forEachChild(node, (node) =>
				{
					if(node.kind === ts.SyntaxKind.ImportDeclaration)
					{
						let importDeclaration = <ts.ImportDeclaration> node;
						this.populateImport(importDeclaration);
						return;
					}
					if(node.kind === ts.SyntaxKind.ExportAssignment)
					{
						let exportAssignment = <ts.ExportAssignment> node;
						this.assignExport(exportAssignment);
						return;
					}
					this.populatePackageLevelDefinitions(node);
				});
				//clear imported modules after we're done with this module
				this._importModuleMap = {};
				break;
			}
			case ts.SyntaxKind.ModuleDeclaration:
			{
				let moduleDeclaration = <ts.ModuleDeclaration> node;
				let moduleName = moduleDeclaration.name;
				this._moduleStack.push(this.declarationNameToString(moduleName));
				if(moduleName.kind === ts.SyntaxKind.StringLiteral)
				{
					this._currentModuleRequire = this._moduleStack[this._moduleStack.length - 1];
				}
				ts.forEachChild(node, (node) =>
				{
					if(node.kind === ts.SyntaxKind.Identifier ||
						node.kind === ts.SyntaxKind.StringLiteral)
					{
						//safe to ignore name of module
						return;
					}
					if(node.kind === ts.SyntaxKind.DeclareKeyword)
					{
						//we already took care of the declare keyword
						return;
					}
					if(node.kind === ts.SyntaxKind.ExportKeyword)
					{
						//we already took care of the export keyword
						return;
					}
					this.populatePackageLevelDefinitions(node);
				});
				this._moduleStack.pop();
				if(this._moduleStack.length > 0)
				{
					this._currentModuleRequire = this._moduleStack[this._moduleStack.length - 1];
				}
				else
				{
					this._currentModuleRequire = null;
				}
				break;
			}
			case ts.SyntaxKind.FunctionDeclaration:
			{
				this.populatePackageFunction(<ts.FunctionDeclaration> node);
				break;
			}
			case ts.SyntaxKind.VariableStatement:
			case ts.SyntaxKind.VariableDeclarationList:
			{
				ts.forEachChild(node, (node) =>
				{
					if(node.kind === ts.SyntaxKind.DeclareKeyword ||
						node.kind === ts.SyntaxKind.ExportKeyword)
					{
						//we already took care of the declare or export keyword
						return;
					}
					this.populatePackageLevelDefinitions(node);
				});
				break;
			}
			case ts.SyntaxKind.VariableDeclaration:
			{
				this.populatePackageVariable(<ts.VariableDeclaration> node);
				break;
			}
			case ts.SyntaxKind.InterfaceDeclaration:
			{
				this.populateInterface(<ts.InterfaceDeclaration> node);
				break;
			}
			case ts.SyntaxKind.ClassDeclaration:
			{
				this.populateClass(<ts.ClassDeclaration> node);
				break;
			}
			default:
			{
				if(this.debugLevel >= TS2ASParser.DebugLevel.WARN && !this._currentFileIsExternal)
				{
					console.warn("Unknown SyntaxKind: " + node.kind.toString());
					console.warn(this._currentSourceFile.text.substring(node.pos, node.end));
				}
				break;
			}
		}
	}
	
	private readMembers(typeDefinition: as3.TypeDefinition, declaration: ts.ClassDeclaration|ts.InterfaceDeclaration|ts.TypeLiteralNode)
	{
		declaration.members.forEach((member: ts.Declaration) =>
		{
			this.readMember(member, typeDefinition);
		});
	}
	
	private populateMembers(typeDefinition: as3.TypeDefinition, declaration: ts.ClassDeclaration|ts.InterfaceDeclaration|ts.TypeLiteralNode)
	{
		declaration.members.forEach((member: ts.Declaration) =>
		{
			this.populateMember(member, typeDefinition);
		});
	}
	
	private mergeInterfaceAndVariable(interfaceDefinition: as3.InterfaceDefinition, variableDefinition: as3.PackageVariableDefinition)
	{
		let as3Class = new as3.ClassDefinition(interfaceDefinition.name,
			interfaceDefinition.packageName, variableDefinition.accessLevel,
			interfaceDefinition.sourceFile, interfaceDefinition.require,
			this._currentFileIsExternal);
		this.copyMembers(interfaceDefinition, as3Class, false);
		
		let index = this._definitions.indexOf(interfaceDefinition);
		if(index >= 0)
		{
			this._definitions[index] = as3Class;
			return;
		}
		index = this._definitions.indexOf(variableDefinition);
		if(index >= 0)
		{
			this._definitions[index] = as3Class;
			return;
		}
		throw new Error("Cannot find existing definition to replace, with name " + as3Class.getFullyQualifiedName());
	}
	
	private populateTypeParameters(declaration: ts.Declaration): string[]
	{
		let typeParameters: string[] = [];
		
		ts.forEachChild(declaration, (node) =>
		{
			if(node.kind === ts.SyntaxKind.TypeParameter)
			{
				let typeParameterDeclaration = <ts.TypeParameterDeclaration> node;
				let typeParameterName = this.declarationNameToString(typeParameterDeclaration.name);
				
				let as3TypeName: string = null;
				if(typeParameterDeclaration.constraint)
				{
					let constraint = <ts.TypeNode> typeParameterDeclaration.constraint;
					let tsConstraintName = this.simplifyTypeNode(constraint);
					let as3Constraint = this.getAS3TypeFromTypeNodeKind(constraint);
					if(as3Constraint)
					{
						as3TypeName = as3Constraint.getFullyQualifiedName();
					}
				}
				if(!as3TypeName)
				{
					//fall back to object if there is no constraint
					as3TypeName = as3.BuiltIns[as3.BuiltIns.Object]
				}
				if(this.debugLevel >= TS2ASParser.DebugLevel.INFO && !this._currentFileIsExternal)
				{
					console.info("Mapping type parameter " + typeParameterName + " to " + as3TypeName + " in " + this.declarationNameToString(declaration.name) + ".");
				}
				this._typeParameterMap[typeParameterName] = as3TypeName;
				typeParameters.push(typeParameterName);
				
			}
		});
		
		return typeParameters;
	}
	
	private cleanupTypeParameters(typeParameters: string[])
	{
		for(let param of typeParameters)
		{
			delete this._typeParameterMap[param];
		}
	}
	
	private readClass(classDeclaration: ts.ClassDeclaration): as3.ClassDefinition
	{
		let className = this.declarationNameToString(classDeclaration.name);
		let packageName = this._moduleStack.join(".");
		let fullyQualifiedClassName = className;
		if(packageName.length > 0)
		{
			fullyQualifiedClassName = packageName + "." + className;
		}
		
		let existingDefinition = as3.getDefinitionByName(fullyQualifiedClassName, this._definitions);
		if(existingDefinition !== null)
		{
			throw new Error("Definition with name " + fullyQualifiedClassName + " already exists. Cannot create class.");
		}
		let as3Class = new as3.ClassDefinition(className, packageName, this.getAccessLevel(classDeclaration), this._currentSourceFile.fileName, this._currentModuleRequire, this._currentFileIsExternal);
		this.readMembers(as3Class, classDeclaration);
		return as3Class;
	}
	
	private populateClass(classDeclaration: ts.ClassDeclaration)
	{
		let className = this.declarationNameToString(classDeclaration.name);
		let packageName = this._moduleStack.join(".");
		let fullyQualifiedClassName = className;
		if(packageName.length > 0)
		{
			fullyQualifiedClassName = packageName + "." + className;
		}
		
		let as3Class = <as3.ClassDefinition> as3.getDefinitionByName(fullyQualifiedClassName, this._definitions);
		if(!as3Class)
		{
			throw new Error("Class not found: " + fullyQualifiedClassName);
		}
		
		let typeParameters = this.populateTypeParameters(classDeclaration);
		
		if(classDeclaration.heritageClauses)
		{
			classDeclaration.heritageClauses.forEach((heritageClause: ts.HeritageClause) =>	
			{
				switch(heritageClause.token)
				{
					case ts.SyntaxKind.ExtendsKeyword:
					{
						let superClassTSType = heritageClause.types[0];
						let superClass = this.getAS3TypeFromTSTypeNode(superClassTSType);
						if(superClass instanceof as3.ClassDefinition)
						{
							as3Class.superClass = superClass;
						}
						else if(superClass !== null)
						{
							if(this.debugLevel >= TS2ASParser.DebugLevel.WARN && !superClass.external)
							{
								console.warn("Warning: Class " + fullyQualifiedClassName + " extends non-class " + superClass.getFullyQualifiedName() + ", but this is not allowed in ActionScript.");
							}
						}
						else
						{
							throw new Error("Super class " + this.getAS3FullyQualifiedNameFromTSTypeNode(superClassTSType) + " not found for " + fullyQualifiedClassName + " to extend.");
						}
						break;
					}
					case ts.SyntaxKind.ImplementsKeyword:
					{
						heritageClause.types.forEach((type: ts.TypeNode) =>
						{
							let as3Interface = this.getAS3TypeFromTSTypeNode(type);
							if(as3Interface instanceof as3.InterfaceDefinition)
							{
								as3Class.interfaces.push(as3Interface);
							}
							else if(as3Interface !== null)
							{
								if(this.debugLevel >= TS2ASParser.DebugLevel.WARN && !as3Interface.external)
								{
									console.warn("Warning: Class " + fullyQualifiedClassName + " implements non-interface " + as3Interface.getFullyQualifiedName() + ", but this is not allowed in ActionScript.");
								}
							}
							else
							{
								throw new Error("Interface " + this.getAS3FullyQualifiedNameFromTSTypeNode(type) + " not found for " + fullyQualifiedClassName + " to implement.");
							}
						});
						break;
					}
				}
			});
		}
	
		this.populateMembers(as3Class, classDeclaration);
		
		this.cleanupTypeParameters(typeParameters);
	}
	
	private readInterface(interfaceDeclaration: ts.InterfaceDeclaration): as3.InterfaceDefinition
	{
		let interfaceName = this.declarationNameToString(interfaceDeclaration.name);
		let packageName = this._moduleStack.join(".");
		let fullyQualifiedInterfaceName = interfaceName;
		if(packageName.length > 0)
		{
			fullyQualifiedInterfaceName = packageName + "." + interfaceName;
		}
		
		let hasConstructSignature = interfaceDeclaration.members.some((member) =>
		{
			return member.kind === ts.SyntaxKind.ConstructSignature;
		});
		let hasCallSignature = interfaceDeclaration.members.some((member) =>
		{
			return member.kind === ts.SyntaxKind.CallSignature;
		});
		let hasMembers = interfaceDeclaration.members.some((member) =>
		{
			return member.kind !== ts.SyntaxKind.ConstructSignature &&
				member.kind !== ts.SyntaxKind.CallSignature;
		});
		if(hasCallSignature && !hasMembers)
		{
			this._functionAliases.push(fullyQualifiedInterfaceName);
			if(this.debugLevel >= TS2ASParser.DebugLevel.INFO && !this._currentFileIsExternal)
			{
				console.info("Creating function alias from " + fullyQualifiedInterfaceName + ".");
			}
			return null;
		}
		if(hasConstructSignature)
		{
			//if the interface defines a constructor, it is the static side of a
			//decomposed class
			let staticSideClass = new StaticSideClassDefinition(interfaceName, packageName, this.getAccessLevel(interfaceDeclaration), this._currentSourceFile.fileName, this._currentModuleRequire);
			this.readMembers(staticSideClass, interfaceDeclaration);
			return staticSideClass;
		}
		
		let existingDefinition = as3.getDefinitionByName(fullyQualifiedInterfaceName, this._definitions);
		if(existingDefinition instanceof as3.InterfaceDefinition)
		{
			//this interface already exists!
			//TypeScript merges duplicates, though, so we should too.
			this.readMembers(existingDefinition, interfaceDeclaration);
			return null;
		}
		else if(existingDefinition instanceof as3.ClassDefinition)
		{
			//we've already combined a package variable and interface
			//this is a duplicate interface that needs to be merged.
			this.readMembers(existingDefinition, interfaceDeclaration);
			return null;
		}
		
		let as3Interface = new as3.InterfaceDefinition(interfaceName, packageName, this.getAccessLevel(interfaceDeclaration), this._currentSourceFile.fileName, this._currentModuleRequire, this._currentFileIsExternal);
		this.readMembers(as3Interface, interfaceDeclaration);
		if(existingDefinition instanceof as3.PackageVariableDefinition)
		{
			//this is a decomposed class where the variable name and the
			//instance side have the same name
			this.mergeInterfaceAndVariable(as3Interface, existingDefinition);
			return null;
		}
		else if(existingDefinition !== null)
		{
			throw new Error("Definition with name " + fullyQualifiedInterfaceName + " already exists. Cannot create interface.");
		}
		return as3Interface;
	}
	
	private populateInterface(interfaceDeclaration: ts.InterfaceDeclaration)
	{
		let interfaceName = this.declarationNameToString(interfaceDeclaration.name);
		let packageName = this._moduleStack.join(".");
		let fullyQualifiedInterfaceName = interfaceName;
		if(packageName.length > 0)
		{
			fullyQualifiedInterfaceName = packageName + "." + interfaceName;
		}
		if(this._functionAliases.indexOf(fullyQualifiedInterfaceName) >= 0)
		{
			//this is a function alias
			return;
		}
		
		//an interface may have been converted into a class,
		//so that's why the superclass of InterfaceDefinition
		//and ClassDefinition is used here.
		let existingInterface = <as3.TypeDefinition> as3.getDefinitionByName(fullyQualifiedInterfaceName, this._definitions);
		if(!existingInterface)
		{
			throw new Error("Interface not found: " + fullyQualifiedInterfaceName);
		}
		
		let typeParameters = this.populateTypeParameters(interfaceDeclaration);
		
		if(existingInterface instanceof as3.InterfaceDefinition)
		{
			if(interfaceDeclaration.heritageClauses)
			{
				interfaceDeclaration.heritageClauses.forEach((heritageClause: ts.HeritageClause) =>	
				{
					if(heritageClause.token !== ts.SyntaxKind.ExtendsKeyword)
					{
						return;
					}
					heritageClause.types.forEach((type: ts.TypeNode) =>
					{
						let otherInterface = this.getAS3TypeFromTSTypeNode(type);
						if(otherInterface instanceof as3.InterfaceDefinition)
						{
							existingInterface.interfaces.push(otherInterface);
						}
						else if(otherInterface.getFullyQualifiedName() === as3.BuiltIns[as3.BuiltIns.Object])
						{
							//ignore when an interface extends Object because
							//everything is an Object already
						}
						else if(otherInterface instanceof as3.ClassDefinition)
						{
							this._promoted[fullyQualifiedInterfaceName] = [otherInterface];
						}
						else if(otherInterface !== null)
						{
							if(this.debugLevel >= TS2ASParser.DebugLevel.WARN && !existingInterface.external)
							{
								console.warn("Warning: Interface " + fullyQualifiedInterfaceName + " extends non-interface " + otherInterface.getFullyQualifiedName() + ", but this is not allowed in ActionScript.");
							}
						}
						else
						{
							throw new Error("Interface " + this.getAS3FullyQualifiedNameFromTSTypeNode(type) + " not found for " + fullyQualifiedInterfaceName + " to extend.");
						}
					});
				});
			}
		}
		this.populateMembers(existingInterface, interfaceDeclaration);
		
		this.cleanupTypeParameters(typeParameters);
	}
	
	private readPackageFunction(functionDeclaration: ts.FunctionDeclaration): as3.PackageFunctionDefinition
	{
		let functionName = this.declarationNameToString(functionDeclaration.name);
		let packageName = this._moduleStack.join(".");
		let fullyQualifiedName = functionName;
		if(packageName)
		{
			fullyQualifiedName = packageName + "." + fullyQualifiedName;
		}
		let existingFunction = as3.getDefinitionByName(fullyQualifiedName, this._definitions);
		if(existingFunction instanceof as3.PackageFunctionDefinition)
		{
			//this function already exists, so this is an overload and we can
			//ignore it, for now.
			return null;
		}
		else if(existingFunction !== null)
		{
			throw new Error("Definition with name " + fullyQualifiedName + " already exists. Cannot create package function.");
		}
		return new as3.PackageFunctionDefinition(functionName, packageName, this.getAccessLevel(functionDeclaration), this._currentSourceFile.fileName, this._currentModuleRequire, this._currentFileIsExternal);
	}
	
	private populatePackageFunction(functionDeclaration: ts.FunctionDeclaration)
	{
		let functionName = this.declarationNameToString(functionDeclaration.name);
		let packageName = this._moduleStack.join(".");
		let fullyQualifiedPackageFunctionName = functionName;
		if(packageName.length > 0)
		{
			fullyQualifiedPackageFunctionName = packageName + "." + functionName;
		}
		
		let as3PackageFunction = <as3.PackageFunctionDefinition> as3.getDefinitionByName(fullyQualifiedPackageFunctionName, this._definitions);
		if(!as3PackageFunction)
		{
			throw new Error("Package-level function not found: " + fullyQualifiedPackageFunctionName);
		}
		
		let functionParameters = this.populateParameters(functionDeclaration);
		let returnType = this.getAS3TypeFromTSTypeNode(functionDeclaration.type);
		let existingReturnType = as3PackageFunction.type;
		if(existingReturnType !== null)
		{
			//this is an overload, so find the common base type
			as3PackageFunction.type = this.mergeTypes(existingReturnType, returnType);
		} 
		else
		{
			as3PackageFunction.type = returnType;
		}
		this.mergeFunctionParameters(as3PackageFunction.parameters, functionParameters);
		as3PackageFunction.accessLevel = as3.AccessModifiers[as3.AccessModifiers.public];
	}
	
	private readPackageVariable(variableDeclaration: ts.VariableDeclaration): as3.PackageVariableDefinition
	{
		let variableName = this.declarationNameToString(variableDeclaration.name);
		let packageName = this._moduleStack.join(".");
		let fullyQualifiedName = variableName;
		if(packageName)
		{
			fullyQualifiedName = packageName + "." + variableName; 
		}
		let accessLevel = this.getAccessLevel(variableDeclaration);
		let existingDefinition = as3.getDefinitionByName(fullyQualifiedName, this._definitions);
		if(existingDefinition instanceof StaticSideClassDefinition)
		{
			//this is a decomposed class where the variable name and the static
			//side have the same name
			existingDefinition.accessLevel = accessLevel;
			return null;
		}
		let as3Variable = new as3.PackageVariableDefinition(variableName, packageName, accessLevel, this._currentSourceFile.fileName, this._currentModuleRequire, this._currentFileIsExternal);
		if(existingDefinition instanceof as3.InterfaceDefinition)
		{
			//this is a decomposed class where the variable name and the
			//instance side have the same name
			this.mergeInterfaceAndVariable(existingDefinition, as3Variable);
			return null;
		}
		else if(existingDefinition instanceof as3.ClassDefinition)
		{
			//this is a decomposed class. we've already combined the package
			//variable and interface.
			//this is just a duplicate variable that we can ignore.
			return null;
		}
		else if(existingDefinition !== null)
		{
			throw new Error("Definition with name " + fullyQualifiedName + " already exists. Cannot create package variable.");
		}
		return as3Variable;
	}
	
	private populatePackageVariable(variableDeclaration: ts.VariableDeclaration)
	{
		let variableName = this.declarationNameToString(variableDeclaration.name);
		let packageName = this._moduleStack.join(".");
		let fullyQualifiedPackageVariableName = variableName;
		if(packageName.length > 0)
		{
			fullyQualifiedPackageVariableName = packageName + "." + variableName;
		}
		
		let as3PackageLevelDefinition = <as3.PackageLevelDefinition> as3.getDefinitionByName(fullyQualifiedPackageVariableName, this._definitions);
		if(!as3PackageLevelDefinition)
		{
			throw new Error("Package-level variable not found: " + fullyQualifiedPackageVariableName);
		}
		
		let variableType = this.getAS3TypeFromTSTypeNode(variableDeclaration.type);
		if(as3PackageLevelDefinition instanceof as3.PackageVariableDefinition)
		{
			let as3PackageVariable = <as3.PackageVariableDefinition> as3PackageLevelDefinition;
			as3PackageVariable.type = variableType;
			return;
		}
		if(as3PackageLevelDefinition instanceof StaticSideClassDefinition)
		{
			//this is a decomposed class where the variable name and the static
			//side have the same name. we need to make everything static;
			for(let property of as3PackageLevelDefinition.properties)
			{
				(<ParserPropertyDefinition> property).forceStatic = true;
			}
			for(let method of as3PackageLevelDefinition.methods)
			{
				(<ParserMethodDefinition> method).forceStatic = true;
			}
			return;
		}
		if(as3PackageLevelDefinition instanceof as3.ClassDefinition)
		{
			//this is a decomposed class where the variable name and the
			//instance side have the same name
			if(variableType === as3PackageLevelDefinition)
			{
				for(let property of as3PackageLevelDefinition.properties)
				{
					(<ParserPropertyDefinition> property).forceStatic = true;
				}
				for(let method of as3PackageLevelDefinition.methods)
				{
					(<ParserMethodDefinition> method).forceStatic = true;
				}
				return;
			}
			if(variableDeclaration.type.kind === ts.SyntaxKind.TypeLiteral)
			{
				//the static side of this decomposed class is a type literal
				//so we haven't created the AS3 class for it yet. we need to
				//do it on the fly.
				let tempStaticSideClass = new StaticSideClassDefinition(null, null, as3.AccessModifiers[as3.AccessModifiers.internal], this._currentSourceFile.fileName, this._currentModuleRequire);
				let typeLiteral = <ts.TypeLiteralNode> variableDeclaration.type;
				this.readMembers(tempStaticSideClass, typeLiteral);
				this.populateMembers(tempStaticSideClass, typeLiteral);
				variableType = tempStaticSideClass;
			}
			if(variableType instanceof StaticSideClassDefinition)
			{
				//the static side of this decomposed class is a different
				//interface than the instance side. we need to copy over
				//all the members from the static side to the instance side
				//and make them static
				this.copyMembers(variableType, as3PackageLevelDefinition, true);
				as3PackageLevelDefinition.constructorMethod = variableType.constructorMethod;
				return;
			}
			
			//something went wrong. it's a class, but we couldn't find the static side.
			if(this.debugLevel >= TS2ASParser.DebugLevel.WARN && !this._currentFileIsExternal)
			{
				console.error("Cannot populate class from package variable named " + fullyQualifiedPackageVariableName + ".");
			}
			return;
		}
		//something went terribly wrong. it's not a variable or a class.
		if(this.debugLevel >= TS2ASParser.DebugLevel.WARN && !this._currentFileIsExternal)
		{
			console.error("Cannot populate package variable named " + fullyQualifiedPackageVariableName + ".");
		}
	}
	
	private readMember(member: ts.Declaration, as3Type: as3.TypeDefinition)
	{
		switch(member.kind)
		{
			case ts.SyntaxKind.PropertyDeclaration:
			case ts.SyntaxKind.PropertySignature:
			{
				let propertyDeclaration = <ts.PropertyDeclaration> member;
				let as3Property = this.readProperty(propertyDeclaration);
				as3Type.properties.push(as3Property);
				break;
			}
			case ts.SyntaxKind.ConstructSignature:
			case ts.SyntaxKind.Constructor:
			{
				let constructorDeclaration = <ts.ConstructorDeclaration> member;
				let as3Constructor = this.readConstructor(constructorDeclaration, <as3.ClassDefinition> as3Type);
				this.addConstructorMethodToAS3Class(<as3.ClassDefinition> as3Type, as3Constructor);
				break;
			}
			case ts.SyntaxKind.MethodDeclaration:
			case ts.SyntaxKind.MethodSignature:
			{
				let functionDeclaration = <ts.FunctionDeclaration> member;
				let as3Method = this.readMethod(functionDeclaration, as3Type);
				this.addMethodToAS3Type(as3Type, as3Method);
				break;
			}
			case ts.SyntaxKind.CallSignature:
			case ts.SyntaxKind.IndexSignature:
			{
				//this is safe to ignore
				break;
			}
			default:
			{
				if(this.debugLevel >= TS2ASParser.DebugLevel.WARN && !this._currentFileIsExternal)
				{
					console.warn("Unknown SyntaxKind in member: " + member.kind.toString());
					console.warn(this._currentSourceFile.text.substring(member.pos, member.end));
				}
				break;
			}
		}
	}
	
	private populateMember(member: ts.Declaration, as3Type: as3.TypeDefinition)
	{
		switch(member.kind)
		{
			case ts.SyntaxKind.PropertyDeclaration:
			case ts.SyntaxKind.PropertySignature:
			{
				let propertyDeclaration = <ts.PropertyDeclaration> member;
				this.populateProperty(propertyDeclaration, as3Type);
				break;
			}
			case ts.SyntaxKind.ConstructSignature:
			case ts.SyntaxKind.Constructor:
			{
				let constructorDeclaration = <ts.ConstructorDeclaration> member;
				this.populateConstructor(constructorDeclaration, <as3.ClassDefinition> as3Type);;
				break;
			}
			case ts.SyntaxKind.MethodDeclaration:
			case ts.SyntaxKind.MethodSignature:
			{
				let functionDeclaration = <ts.FunctionDeclaration> member;
				this.populateMethod(functionDeclaration, as3Type);
				break;
			}
			case ts.SyntaxKind.CallSignature:
			case ts.SyntaxKind.IndexSignature:
			{
				//this is safe to ignore
				break;
			}
			default:
			{
				if(this.debugLevel >= TS2ASParser.DebugLevel.WARN && !this._currentFileIsExternal)
				{
					console.warn("Unknown SyntaxKind in member: " + member.kind.toString());
					console.warn(this._currentSourceFile.text.substring(member.pos, member.end));
				}
				break;
			}
		}
	}
	
	private readProperty(propertyDeclaration: ts.PropertyDeclaration): as3.PropertyDefinition
	{
		let propertyName = this.declarationNameToString(propertyDeclaration.name);
		let isStatic = (propertyDeclaration.flags & ts.NodeFlags.Static) === ts.NodeFlags.Static;
		return new ParserPropertyDefinition(propertyName, null, null, isStatic);
	}
	
	private populateProperty(propertyDeclaration: ts.PropertyDeclaration, as3Type: as3.TypeDefinition)
	{
		let propertyName = this.declarationNameToString(propertyDeclaration.name);
		let isStatic = (propertyDeclaration.flags & ts.NodeFlags.Static) === ts.NodeFlags.Static;
		let as3Property: as3.PropertyDefinition = null;
		as3Type.properties.some((otherProperty) =>
		{
			if(otherProperty.name === propertyName &&
				otherProperty.isStatic === isStatic)
			{
				as3Property = otherProperty;
				return true;
			}
			return false; 
		});
		if(!as3Property)
		{
			throw new Error("Property " + propertyName + " not found on type " + as3Type.getFullyQualifiedName() + ".");
		}
		let propertyType = this.getAS3TypeFromTSTypeNode(propertyDeclaration.type);
		if(!propertyType)
		{
			throw new Error("Type " + this.getAS3FullyQualifiedNameFromTSTypeNode(propertyDeclaration.type) + " not found for property " + propertyName + " on type " + as3Type.getFullyQualifiedName() + ".");
		}
		as3Property.type = propertyType;
		if("superClass" in as3Type)
		{
			//members of interfaces don't have an access level, but we should
			//use public for classes
			as3Property.accessLevel = as3.AccessModifiers[as3.AccessModifiers.public];
		}
	}
	
	private populateParameters(functionLikeDeclaration: ts.FunctionLikeDeclaration): as3.ParameterDefinition[]
	{
		let parameters = functionLikeDeclaration.parameters;
		let as3Parameters: as3.ParameterDefinition[] = [];
		for(let i = 0, count = parameters.length; i < count; i++)
		{
			let value = parameters[i];
			let parameterName = this.declarationNameToString(value.name);
			let parameterType = this.getAS3TypeFromTSTypeNode(value.type);
			if(!parameterType)
			{
				throw new Error("Type " + this.getAS3FullyQualifiedNameFromTSTypeNode(value.type) + " not found for parameter " + parameterName + ".");
			}
			if(parameterType instanceof as3.InterfaceDefinition)
			{
				//TypeScript interfaces work differently than AS3 interfaces
				//values that may be assigned to them don't need to be of a
				//type that explicitly implements them. any object can be
				//passed in as long as it has the right members. 
				parameterType = <as3.TypeDefinition> as3.getDefinitionByName(as3.BuiltIns[as3.BuiltIns.Object], this._definitions);
			}
			let parameterValue = null;
			
			var isOptional: boolean = false;
			var isRest: boolean = false;
			ts.forEachChild(value, (node) =>
			{
				if(node.kind === ts.SyntaxKind.DotDotDotToken)
				{
					isRest = true;
				}
				else if(node.kind === ts.SyntaxKind.QuestionToken)
				{
					isOptional = true;
				}
			});
			
			if(isOptional)
			{
				//AS3 doesn't have optional parameters. in AS3, this parameter
				//would have a default value instead.
				parameterValue = "undefined";
			}
			else
			{
				let initializer = value.initializer;
				if(initializer)
				{
					let initializerText = this._currentSourceFile.text.substring(initializer.pos, initializer.end);
					initializerText = initializerText.trim();
					parameterValue = initializerText;
				}
			}
			
			if(isRest)
			{
				parameterType = <as3.TypeDefinition> as3.getDefinitionByName(as3.BuiltIns[as3.BuiltIns.Array], this._definitions);
			}
			
			as3Parameters.push(new as3.ParameterDefinition(parameterName, parameterType, parameterValue, isRest));
		}
		return as3Parameters;
	}
	
	private readConstructor(constructorDeclaration: ts.ConstructorDeclaration, as3Class: as3.ClassDefinition): as3.ConstructorDefinition
	{
		let className = as3Class.name;
		return new as3.ConstructorDefinition(className);
	}
	
	private populateConstructor(constructorDeclaration: ts.ConstructorDeclaration, as3Class: as3.ClassDefinition)
	{
		let className = as3Class.name;
		let as3Constructor = as3Class.constructorMethod;
		if(!as3Constructor)
		{
			throw new Error("Constructor not found on class " + as3Class.getFullyQualifiedName() + ".");
		}
		let constructorParameters = this.populateParameters(constructorDeclaration);
		this.mergeFunctionParameters(as3Constructor.parameters, constructorParameters);
	}
	
	private readMethod(functionDeclaration: ts.FunctionDeclaration, as3Type: as3.TypeDefinition): as3.MethodDefinition
	{
		let methodName = this.declarationNameToString(functionDeclaration.name);
		let accessLevel = as3Type.constructor === as3.ClassDefinition ? as3.AccessModifiers[as3.AccessModifiers.public] : null;
		let isStatic = (functionDeclaration.flags & ts.NodeFlags.Static) === ts.NodeFlags.Static;
		return new ParserMethodDefinition(methodName, null, null, accessLevel, isStatic);
	}
	
	private populateMethod(functionDeclaration: ts.FunctionDeclaration, as3Type: as3.TypeDefinition)
	{
		let typeParameters = this.populateTypeParameters(functionDeclaration);
		
		let methodName = this.declarationNameToString(functionDeclaration.name);
		let isStatic = (functionDeclaration.flags & ts.NodeFlags.Static) === ts.NodeFlags.Static;
		let as3Method: as3.MethodDefinition = null;
		as3Type.methods.some((otherMethod) =>
		{
			if(otherMethod.name === methodName &&
				otherMethod.isStatic === isStatic)
			{
				as3Method = otherMethod;
				return true;
			}
			return false; 
		});
		if(!as3Method)
		{
			let staticMessage = isStatic ? "Static" : "Non-static";
			throw new Error(staticMessage + " method " + methodName + "() not found on type " + as3Type.getFullyQualifiedName() + ".");
		}
		
		let methodType = this.getAS3TypeFromTSTypeNode(functionDeclaration.type);
		if(!methodType)
		{
			throw new Error("Return type " + this.getAS3FullyQualifiedNameFromTSTypeNode(functionDeclaration.type) + " not found for method " + methodName + "() on type " + as3Type.getFullyQualifiedName() + ".");
		}
		let methodParameters = this.populateParameters(functionDeclaration);
		this.mergeFunctionParameters(as3Method.parameters, methodParameters);
		let existingReturnType = as3Method.type;
		if(existingReturnType !== null)
		{
			//this is an overload, so find the common base type
			as3Method.type = this.mergeTypes(existingReturnType, methodType);
		} 
		else
		{
			as3Method.type = methodType;
		}
		
		if(as3Type.getFullyQualifiedName() === as3.BuiltIns[as3.BuiltIns.Object])
		{
			//methods of the Object class use the AS3 namespace
			//subclasses can re-implement them without the override keyword
			as3Method.accessLevel = as3.AccessModifiers[as3.AccessModifiers.AS3];
		}
		else if("superClass" in as3Type)
		{
			//members of interfaces don't have an access level, but we should
			//use public for classes
			as3Method.accessLevel = as3.AccessModifiers[as3.AccessModifiers.public];
		}
		
		this.cleanupTypeParameters(typeParameters);
	}
	
	private promoteInterfaces():void
	{
		let currentlyPromoted = this._promoted;
		while(Object.keys(currentlyPromoted).length > 0)
		{
			this._promoted = {}
			this._definitions.forEach((as3Definition, index) =>
			{
				//this interface extended a class that was promoted from another
				//interface, so we need to promote this interface to a class too
				if(as3Definition instanceof as3.InterfaceDefinition)
				{
					let fullyQualifiedInterfaceName = as3Definition.getFullyQualifiedName();
					if(!(fullyQualifiedInterfaceName in currentlyPromoted))
					{
						//if this interface is not being promoted, it may be
						//extending another interface that is, and then it needs to
						//be promoted too.
						let needsPromotion = as3Definition.interfaces.some((otherInterface) =>
						{
							return otherInterface.getFullyQualifiedName() in currentlyPromoted;
						});
						if(needsPromotion)
						{
							this._promoted[fullyQualifiedInterfaceName] = [];
						}
						return;
					}
					let superClasses = <as3.ClassDefinition[]> currentlyPromoted[fullyQualifiedInterfaceName];
					if(superClasses.length > 1)
					{
						throw new Error("Interface with name " + fullyQualifiedInterfaceName + " could not be promoted to a class because it would have more than one super class.");
					}
					if(this.debugLevel >= TS2ASParser.DebugLevel.INFO)
					{
						console.info("Promoting interface " + fullyQualifiedInterfaceName + " to class.");
					}
					let superClass = null;
					if(superClasses.length === 1)
					{
						superClass = superClasses[0];
					}
					let as3Class = new as3.ClassDefinition(as3Definition.name, as3Definition.packageName,
						as3.AccessModifiers[as3.AccessModifiers.public], as3Definition.sourceFile,
						as3Definition.require, as3Definition.external);
					as3Class.superClass = superClass;
					this.copyMembers(as3Definition, as3Class, false);
					as3Class.properties.forEach((as3Property) =>
					{
						as3Property.accessLevel = as3.AccessModifiers[as3.AccessModifiers.public];
					});
					as3Class.methods.forEach((as3Method) =>
					{
						as3Method.accessLevel = as3.AccessModifiers[as3.AccessModifiers.public];
					});
					this._definitions[index] = as3Class;
				}
			});
			currentlyPromoted = this._promoted;
		}
	}
	
	private cleanupBuiltInTypes()
	{
		//built-in types like void should not be emitted
		this._definitions = this._definitions.filter((definition: as3.PackageLevelDefinition) =>
		{
			return definition.sourceFile !== null;
		});
	}
	
	private cleanupStaticSideDefinitions()
	{
		this._definitions = this._definitions.filter((definition: as3.PackageLevelDefinition) =>
		{
			return !(definition instanceof StaticSideClassDefinition);
		});
	}
	
	private cleanupMembersWithForceStaticFlag()
	{
		this._definitions.forEach((definition: as3.PackageLevelDefinition) =>
		{
			 if(definition instanceof as3.ClassDefinition)
			 {
				 definition.properties.forEach((property: ParserPropertyDefinition) =>
				 {
					 if(property.forceStatic)
					 {
						 property.isStatic = true;
					 }
				 });
				 definition.methods.forEach((method: ParserMethodDefinition) =>
				 {
					 if(method.forceStatic)
					 {
						 method.isStatic = true;
					 }
				 })
			 }
		});
	}
	
}

module TS2ASParser
{
	export enum DebugLevel
	{
		NONE = 0,
		WARN = 1,
		INFO = 2
	}
	
	export interface ParserResult
	{
		definitions: as3.PackageLevelDefinition[];
		hasNoDefaultLib: boolean;
	}
}


export = TS2ASParser;