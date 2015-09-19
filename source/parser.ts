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
/// <reference path="../node_modules/typescript/lib/typescript.d.ts" />

import path = require("path");
import fs = require("fs");
import as3 = require("./as3");
import ts = require("typescript");

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
        this._functionAliases = [];
        this._typeAliasMap = {};
        this._typeParameterMap = {};
        this._importModuleMap = {};
        this._sourceFiles = [];
    }
    
    private _hasNoDefaultLib: boolean;
    private _sourceFiles: ts.SourceFile[];
    private _definitions: as3.PackageLevelDefinition[];
    private _functionAliases: string[];
    private _typeAliasMap: any;
    private _typeParameterMap: any;
    private _importModuleMap: any;
    private _currentSourceFile: ts.SourceFile;
    private _currentFileIsExternal: boolean;
    private _moduleStack: string[];
    private _currentModuleNeedsRequire: boolean;
    private _variableStatementHasDeclareKeyword: boolean = false;
    private _variableStatementHasExport: boolean = false;
    private _scriptTarget: ts.ScriptTarget;
    debugLevel: TS2ASParser.DebugLevel = TS2ASParser.DebugLevel.NONE;
    
    parse(fileName: string): as3.PackageLevelDefinition[]
    {
        this.findSourceFiles(fileName);
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
            this._currentFileIsExternal = index !== (this._sourceFiles.length - 1);
            this.readSourceFile(sourceFile);
        });
        this._sourceFiles.forEach((sourceFile, index) =>
        {
            this._currentFileIsExternal = index !== (this._sourceFiles.length - 1);
            this.populatePackageLevelDefinitions(sourceFile);
        });
        return this._definitions;
    }
    
    private readStandardLibrary()
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
        let standardLibPath = path.join("node_modules", "typescript", "lib", standardLibFileName);
        let sourceText = fs.readFileSync(standardLibPath, "utf8");
        let sourceFile = ts.createSourceFile(standardLibPath, sourceText, this._scriptTarget);
        this._definitions = [];
        this._currentFileIsExternal = true;
        this.readSourceFile(sourceFile);
        this.populatePackageLevelDefinitions(sourceFile);
    }
    
    private findSourceFiles(fileName: string)
    {
        let sourceText = fs.readFileSync(fileName, "utf8");
        let sourceFile = ts.createSourceFile(fileName, sourceText, this._scriptTarget);
        sourceFile.referencedFiles.forEach((fileReference) =>
        {
            var fileName = path.resolve(path.dirname(sourceFile.fileName), fileReference.fileName);
            let sourceFileExists = this._sourceFiles.some((sourceFile) =>
            {
                return sourceFile.fileName === fileName;
            });
            if(sourceFileExists)
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
        this.readPackageLevelDefinitions(sourceFile);
        if(sourceFile.hasNoDefaultLib)
        {
            this.addDynamicFlagToStandardLibraryClasses();
        
            //void is a special type that is defined by the language, and it
            //doesn't appear in the standard library. we need to add it
            //manually.
            this._definitions.push(new as3.InterfaceDefinition("void", null, null, null, false, true));
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
    
    private mergeFunctions(methodToKeep: as3.FunctionDefinition, methodToMerge: as3.FunctionDefinition)
    {
        let methodToMergeParams = methodToMerge.parameters;
        let methodToKeepParams = methodToKeep.parameters;
        let methodToKeepParamsCount = methodToKeepParams.length;
        for(let j = 0, paramCount = methodToMergeParams.length; j < paramCount; j++)
        {
            let paramToMerge = methodToMergeParams[j];
            if(methodToKeepParamsCount <= j)
            {
                methodToKeepParams[j] = paramToMerge;
            }
            let paramToKeep = methodToKeepParams[j];
            if(paramToMerge.type !== paramToKeep.type)
            {
                //the overload has a different type, so generalize to Object
                paramToKeep.type = <as3.TypeDefinition> as3.getDefinitionByName(as3.BuiltIns[as3.BuiltIns.Object], this._definitions);
            }
        }
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
                    //TODO: find common base class
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
            typeInSource = typeInSource.substr(0, endArrayIndex - 1);
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
    
    private declarationNameToString(name: ts.DeclarationName): string
    {
        let result = this._currentSourceFile.text.substring(ts["skipTrivia"](this._currentSourceFile.text, name.pos), name.end);
        if(result.indexOf("\"") === 0)
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
            this.mergeFunctions(as3Class.constructorMethod, constructorMethodToAdd);
        }
        else
        {
            as3Class.constructorMethod = constructorMethodToAdd;
        }
    }
        
    private addMethodToAS3Type(as3Type: as3.TypeDefinition, methodToAdd: as3.MethodDefinition)
    {
        if(as3Type.getFullyQualifiedName() === as3.BuiltIns[as3.BuiltIns.Object])
        {
            //methods of the Object class use the AS3 namespace
            //subclasses can re-implement them without the override keyword
            methodToAdd.accessLevel = as3.AccessModifiers[as3.AccessModifiers.AS3];
        }
        //first, we need to check if this is an overload
        for(let i = 0, methodCount = as3Type.methods.length; i < methodCount; i++)
        {
            let existingMethod = as3Type.methods[i];
            if(existingMethod.name !== methodToAdd.name)
            {
                continue;
            }
            this.mergeFunctions(existingMethod, methodToAdd);
            return;
        }
        //otherwise, add the new method
        as3Type.methods.push(methodToAdd);
    }
    
    private readPackageLevelDefinitions(node: ts.Node)
    {
        let output = "";
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
                    this.readPackageLevelDefinitions(node);
                });
                break;
            }
            case ts.SyntaxKind.ModuleDeclaration:
            {
                let moduleDeclaration = <ts.ModuleDeclaration> node;
                let moduleName = moduleDeclaration.name;
                this._moduleStack.push(this.declarationNameToString(moduleName));
                this._currentModuleNeedsRequire = moduleName.kind === ts.SyntaxKind.StringLiteral;
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
                this._currentModuleNeedsRequire = false;
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
                if(as3Interface instanceof as3.StaticSideClassDefinition)
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
    
    private populatePackageLevelDefinitions(node: ts.Node)
    {
        let output = "";
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
                        if(importDeclaration.importClause)
                        {
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
                                console.warn(this._currentSourceFile.text.substring(node.pos, node.end));
                            }
                        }
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
    
    private populateMembers(typeDefinition: as3.TypeDefinition, declaration: {members: ts.NodeArray<ts.Node>})
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
        return new as3.ClassDefinition(className, packageName, this.getAccessLevel(classDeclaration), this._currentSourceFile.fileName, this._currentModuleNeedsRequire, this._currentFileIsExternal);
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
        let definesConstructor: boolean = false;
        for(let member of interfaceDeclaration.members)
        {
            if(member.kind === ts.SyntaxKind.ConstructSignature)
            {
                return new as3.StaticSideClassDefinition(interfaceName, packageName, this.getAccessLevel(interfaceDeclaration), this._currentSourceFile.fileName, this._currentModuleNeedsRequire);
            }
        }
        if(interfaceDeclaration.members.length === 1)
        {
            let member = interfaceDeclaration.members[0];
            if(member.kind === ts.SyntaxKind.CallSignature)
            {
                this._functionAliases.push(fullyQualifiedInterfaceName);
                if(this.debugLevel >= TS2ASParser.DebugLevel.INFO && !this._currentFileIsExternal)
                {
                    console.info("Creating function alias from " + fullyQualifiedInterfaceName + ".");
                }
                return null;
            }
        }
        
        let existingDefinition = as3.getDefinitionByName(fullyQualifiedInterfaceName, this._definitions);
        if(existingDefinition instanceof as3.InterfaceDefinition)
        {
            //this interface already exists!
            //TypeScript merges duplicates, though, so we should too.
            return null;
        }
        else if(existingDefinition instanceof as3.ClassDefinition)
        {
            //we've already combined a package variable and interface
            //this is a duplicate interface that needs to be merged later
            return null;
        }
        
        let as3Interface = new as3.InterfaceDefinition(interfaceName, packageName, this.getAccessLevel(interfaceDeclaration), this._currentSourceFile.fileName, this._currentModuleNeedsRequire, this._currentFileIsExternal);
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
        
        //if there's an interface and a var with the same name, it gets turned into a class
        if(existingInterface instanceof as3.InterfaceDefinition)
        {
            if(interfaceDeclaration.heritageClauses)
            {
                interfaceDeclaration.heritageClauses.forEach((heritageClause: ts.HeritageClause) =>    
                {
                    switch(heritageClause.token)
                    {
                        case ts.SyntaxKind.ExtendsKeyword:
                        {
                            heritageClause.types.forEach((type: ts.TypeNode) =>
                            {
                                let otherInterface = this.getAS3TypeFromTSTypeNode(type);
                                if(otherInterface instanceof as3.InterfaceDefinition)
                                {
                                    existingInterface.interfaces.push(otherInterface);
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
                            break;
                        }
                    }
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
        return new as3.PackageFunctionDefinition(functionName, packageName, this.getAccessLevel(functionDeclaration), this._currentSourceFile.fileName, this._currentModuleNeedsRequire, this._currentFileIsExternal);
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
        as3PackageFunction.type = this.getAS3TypeFromTSTypeNode(functionDeclaration.type)
        as3PackageFunction.parameters = functionParameters;
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
        if(existingDefinition instanceof as3.StaticSideClassDefinition)
        {
            //this is a decomposed class where the variable name and the static
            //side have the same name
            existingDefinition.accessLevel = accessLevel;
            return null;
        }
        let as3Variable = new as3.PackageVariableDefinition(variableName, packageName, accessLevel, this._currentSourceFile.fileName, this._currentModuleNeedsRequire, this._currentFileIsExternal);
        if(existingDefinition instanceof as3.InterfaceDefinition)
        {
            //this is a decomposed class where the variable name and the
            //instance side have the same name
            this.mergeInterfaceAndVariable(existingDefinition, as3Variable);
            return null;
        }
        else if(existingDefinition instanceof as3.ClassDefinition)
        {
            //we've already combined a package variable and interface
            //this is a duplicate variable
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
        if(as3PackageLevelDefinition instanceof as3.StaticSideClassDefinition)
        {
            //this is a decomposed class where the variable name and the static
            //side have the same name. we need to make everything static;
            for(let property of as3PackageLevelDefinition.properties)
            {
                property.isStatic = true;
            }
            for(let method of as3PackageLevelDefinition.methods)
            {
                method.isStatic = true;
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
                    property.isStatic = true;
                }
                for(let method of as3PackageLevelDefinition.methods)
                {
                    method.isStatic = true;
                }
                return;
            }
            if(variableDeclaration.type.kind === ts.SyntaxKind.TypeLiteral)
            {
                //the static side of this decomposed class is a type literal
                //so we haven't created the AS3 class for it yet. we need to
                //do it on the fly.
                let tempStaticSideClass = new as3.StaticSideClassDefinition(null, null, as3.AccessModifiers[as3.AccessModifiers.internal], this._currentSourceFile.fileName, this._currentModuleNeedsRequire);
                let typeLiteral = <ts.TypeLiteralNode> variableDeclaration.type;
                this.populateMembers(tempStaticSideClass, typeLiteral);
                variableType = tempStaticSideClass;
            }
            if(variableType instanceof as3.StaticSideClassDefinition)
            {
                //the static side of this decomposed class is a different
                //interface than the instance side. we need to copy over
                //all the members from the static side to the instance side
                //and make them static
                for(let property of variableType.properties)
                {
                    let staticProperty = new as3.PropertyDefinition(property.name, as3.AccessModifiers[as3.AccessModifiers.public], property.type, true);
                    as3PackageLevelDefinition.properties.push(staticProperty);
                }
                for(let method of variableType.methods)
                {
                    let staticMethod = new as3.MethodDefinition(method.name, method.type, method.parameters.slice(), as3.AccessModifiers[as3.AccessModifiers.public], true);
                    as3PackageLevelDefinition.methods.push(staticMethod);
                }
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
    
    private populateMember(member: ts.Declaration, as3Type: as3.TypeDefinition)
    {
        switch(member.kind)
        {
            case ts.SyntaxKind.PropertyDeclaration:
            case ts.SyntaxKind.PropertySignature:
            {
                let propertyDeclaration = <ts.PropertyDeclaration> member;
                let as3Property = this.populateProperty(propertyDeclaration);
                if("superClass" in as3Type)
                {
                    as3Property.accessLevel = as3.AccessModifiers[as3.AccessModifiers.public];
                }
                as3Type.properties.push(as3Property);
                break;
            }
            case ts.SyntaxKind.ConstructSignature:
            case ts.SyntaxKind.Constructor:
            {
                let constructorDeclaration = <ts.ConstructorDeclaration> member;
                let as3Constructor = this.populateConstructor(constructorDeclaration, <as3.ClassDefinition> as3Type);
                this.addConstructorMethodToAS3Class(<as3.ClassDefinition> as3Type, as3Constructor);
                break;
            }
            case ts.SyntaxKind.MethodDeclaration:
            case ts.SyntaxKind.MethodSignature:
            {
                let functionDeclaration = <ts.FunctionDeclaration> member;
                let as3Method = this.populateMethod(functionDeclaration, as3Type);
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
    
    private populateProperty(propertyDeclaration: ts.PropertyDeclaration): as3.PropertyDefinition
    {
        let propertyName = this.declarationNameToString(propertyDeclaration.name);
        let propertyType = this.getAS3TypeFromTSTypeNode(propertyDeclaration.type);
        if(!propertyType)
        {
            throw new Error("Type " + this.getAS3FullyQualifiedNameFromTSTypeNode(propertyDeclaration.type) + " not found for property " + propertyName + ".");
        }
        let isStatic = (propertyDeclaration.flags & ts.NodeFlags.Static) === ts.NodeFlags.Static;
        return new as3.PropertyDefinition(propertyName, null, propertyType, isStatic);
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
            
            as3Parameters.push(new as3.ParameterDefinition(parameterName, parameterType, parameterValue, isRest));
        }
        return as3Parameters;
    }
    
    private populateConstructor(constructorDeclaration: ts.ConstructorDeclaration, as3Class: as3.ClassDefinition): as3.ConstructorDefinition
    {
        let className = as3Class.name;
        let constructorParameters = this.populateParameters(constructorDeclaration);
        let constructor = new as3.ConstructorDefinition(className);
        constructor.parameters = constructorParameters;
        return constructor;
    }
    
    private populateMethod(functionDeclaration: ts.FunctionDeclaration, as3Type: as3.TypeDefinition): as3.MethodDefinition
    {
        let typeParameters = this.populateTypeParameters(functionDeclaration);
        
        let methodName = this.declarationNameToString(functionDeclaration.name);
        let methodType = this.getAS3TypeFromTSTypeNode(functionDeclaration.type);
        if(!methodType)
        {
            throw new Error("Return type " + this.getAS3FullyQualifiedNameFromTSTypeNode(functionDeclaration.type) + " not found for method " + methodName + ".");
        }
        let methodParameters = this.populateParameters(functionDeclaration);
        let accessLevel = as3Type.constructor === as3.ClassDefinition ? as3.AccessModifiers[as3.AccessModifiers.public] : null;
        let isStatic = (functionDeclaration.flags & ts.NodeFlags.Static) === ts.NodeFlags.Static;
        let as3Method = new as3.MethodDefinition(methodName, methodType, methodParameters, accessLevel, isStatic)
        
        this.cleanupTypeParameters(typeParameters);
        
        return as3Method;
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
}

export = TS2ASParser;