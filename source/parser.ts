/// <reference path="./as3.ts" />
/// <reference path="../typings/tsd.d.ts" />
/// <reference path="../node_modules/typescript/bin/typescript.d.ts" />

import path = require("path");
import as3 = require("./as3");
import ts = require("typescript");

enum TypeScriptBuiltIns
{
    any,
    number,
    boolean,
    string
}

let TS_TO_AS3_TYPE_MAP = {};
TS_TO_AS3_TYPE_MAP[TypeScriptBuiltIns[TypeScriptBuiltIns.number]] = as3.BuiltIns[as3.BuiltIns.Number];
TS_TO_AS3_TYPE_MAP[TypeScriptBuiltIns[TypeScriptBuiltIns.boolean]] = as3.BuiltIns[as3.BuiltIns.Boolean];
TS_TO_AS3_TYPE_MAP[TypeScriptBuiltIns[TypeScriptBuiltIns.string]] =  as3.BuiltIns[as3.BuiltIns.String];
TS_TO_AS3_TYPE_MAP[TypeScriptBuiltIns[TypeScriptBuiltIns.any]] =  as3.BuiltIns[as3.BuiltIns.Object];

class TS2ASParserResult
{
    types: as3.PackageLevelDefinition[] = [];
}
    
function mergeFunctions(methodToKeep: as3.FunctionDefinition, methodToMerge: as3.FunctionDefinition)
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
            paramToKeep.type = as3.BuiltIns[as3.BuiltIns.Object];
        }
    }
}

class TS2ASParser
{
    constructor()
    {
        this._sourceFiles = [];
        this._functionAliases = [];
        this._currentResult = new TS2ASParserResult();
    }
    
    private _functionAliases: string[]
    private _sourceFiles: ts.SourceFile[];
    private _currentSourceFile: ts.SourceFile;
    private _currentFileIsExternal: boolean;
    private _currentResult: TS2ASParserResult;
    private _moduleStack: string[];
    private _currentModuleNeedsRequire: boolean;
    private _namesInCurrentModule: string[];
    private _variableStatementHasDeclareKeyword: boolean = false;
    private _variableStatementHasExport: boolean = false;
    debugLevel: TS2ASParser.DebugLevel = TS2ASParser.DebugLevel.NONE;
    
    addExternalFile(fileName: string, sourceText: string)
    {
        this._currentFileIsExternal = true;
        this.addFileInternal(fileName, sourceText);
    }
    
    addFile(fileName: string, sourceText: string)
    {
        this._currentFileIsExternal = false;
        this.addFileInternal(fileName, sourceText);
    }
    
    parse(): TS2ASParserResult
    {
        for(let sourceFile of this._sourceFiles)
        {
            this._currentSourceFile = sourceFile;
            this.populatePackageLevelDefinitions(sourceFile);
        }
        return this._currentResult;
    }
    
    private addFileInternal(fileName: string, sourceText: string)
    {
        this._namesInCurrentModule = [];
        this._moduleStack = [];
        this._currentSourceFile = ts.createSourceFile(fileName, sourceText, ts.ScriptTarget.ES5);
        if(!this._currentFileIsExternal)
        {
            this._sourceFiles.push(this._currentSourceFile);
        }
        this.readPackageLevelDefinitions(this._currentSourceFile);
    }

    private isNameInCurrentModule(name: string)
    {
        if(this._moduleStack.length === 0)
        {
            return false;
        }
        return this._namesInCurrentModule.indexOf(name) >= 0;
    }
    
    private getFullyQualifiedName(typeName: string): string
    {
        if(this._moduleStack.length > 0)
        {
            return this._moduleStack.join(".") + "." + typeName;
        }
        return typeName;
    }
    
    private addNameToCurrentModule(node: ts.Node)
    {
        switch(node.kind)
        {
            case ts.SyntaxKind.FunctionDeclaration:
            {
                let functionDeclaration = <ts.FunctionDeclaration> node;
                let functionName = this.declarationNameToString(functionDeclaration.name);
                this._namesInCurrentModule.push(functionName);
                break;
            }
            case ts.SyntaxKind.InterfaceDeclaration:
            {
                let interfaceDeclaration = <ts.InterfaceDeclaration> node;
                let interfaceName = this.declarationNameToString(interfaceDeclaration.name);
                this._namesInCurrentModule.push(interfaceName);
                break;
            }
            case ts.SyntaxKind.ClassDeclaration:
            {
                let classDeclaration = <ts.ClassDeclaration> node;
                let className = this.declarationNameToString(classDeclaration.name);
                this._namesInCurrentModule.push(className);
                break;
            }
        }
    }
    
    private typeNodeToAS3Type(type: ts.TypeNode): string
    {
        if(!type)
        {
            return as3.BuiltIns[as3.BuiltIns.void];
        }
        let typeInSource = this._currentSourceFile.text.substring(ts["skipTrivia"](this._currentSourceFile.text, type.pos), type.end);
        typeInSource = typeInSource.trim();
        if(typeInSource.indexOf("|") >= 0)
        {
            //multiple possible return types mean that we need to generalize
            return as3.BuiltIns[as3.BuiltIns.Object];
        }
        let openCurlyBraceIndex = typeInSource.indexOf("{");
        if(openCurlyBraceIndex === 0)
        {
            return as3.BuiltIns[as3.BuiltIns.Object];
        }
        let startGenericIndex = typeInSource.indexOf("<");
        //strip <T> section of generics
        if(startGenericIndex >= 0)
        {
            typeInSource = typeInSource.substr(0, startGenericIndex);
        }
        if(typeInSource.indexOf("[]") >= 0)
        {
            //this is a typed array
            return as3.BuiltIns[as3.BuiltIns.Array];
        }
        if(this.isNameInCurrentModule(typeInSource))
        {
            typeInSource = this.getFullyQualifiedName(typeInSource);
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
            mergeFunctions(as3Class.constructorMethod, constructorMethodToAdd);
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
            if(existingMethod.name !== methodToAdd.name)
            {
                continue;
            }
            mergeFunctions(existingMethod, methodToAdd);
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
                ts.forEachChild(node, this.readPackageLevelDefinitions.bind(this));
                break;
            }
            case ts.SyntaxKind.ModuleBlock:
            {
                ts.forEachChild(node, this.readPackageLevelDefinitions.bind(this));
                break;
            }
            case ts.SyntaxKind.ModuleDeclaration:
            {
                let moduleDeclaration = <ts.ModuleDeclaration> node;
                let moduleName = moduleDeclaration.name;
                this._moduleStack.push(this.declarationNameToString(moduleName));
                this._currentModuleNeedsRequire = moduleName.kind === ts.SyntaxKind.StringLiteral;
                ts.forEachChild(node, this.readPackageLevelDefinitions.bind(this));
                this._moduleStack.pop();
                break;
            }
            case ts.SyntaxKind.FunctionDeclaration:
            {
                let as3PackageFunction = this.readPackageFunction(<ts.FunctionDeclaration> node);
                if(this.debugLevel >= TS2ASParser.DebugLevel.INFO && !as3PackageFunction.external)
                {
                    console.info("Package Function: " + as3PackageFunction.getFullyQualifiedName());
                }
                this._currentResult.types.push(as3PackageFunction);
                break;
            }
            case ts.SyntaxKind.VariableStatement:
            {
                this._variableStatementHasExport = (node.flags & ts.NodeFlags.Export) === ts.NodeFlags.Export;
                ts.forEachChild(node, (node) =>
                {
                    if(node.kind === ts.SyntaxKind.DeclareKeyword)
                    {
                        this._variableStatementHasDeclareKeyword = true;
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
                //if it's a function alias, readPackageVariable() will return null
                if(as3PackageVariable)
                {
                    if(this.debugLevel >= TS2ASParser.DebugLevel.INFO && !as3PackageVariable.external)
                    {
                        console.info("Package Variable: " + as3PackageVariable.getFullyQualifiedName());
                    }
                    this._currentResult.types.push(as3PackageVariable);
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
                    let as3Class = as3.getDefinitionByName(className, this._currentResult.types);
                    if(this.debugLevel >= TS2ASParser.DebugLevel.INFO && !as3Class.external)
                    {
                        console.info("Replace Interface with Class: " + as3Class.getFullyQualifiedName());
                    }
                }
                break;
            }
            case ts.SyntaxKind.InterfaceDeclaration:
            {
                let as3Interface = this.readInterface(<ts.InterfaceDeclaration> node);
                //if it's a function alias, readInterface() will return null
                if(as3Interface)
                {
                    if(this.debugLevel >= TS2ASParser.DebugLevel.INFO && !as3Interface.external)
                    {
                        console.info("Interface: " + as3Interface.getFullyQualifiedName());
                    }
                    this._currentResult.types.push(as3Interface);
                }
                break;
            }
            case ts.SyntaxKind.ClassDeclaration:
            {
                let as3Class = this.readClass(<ts.ClassDeclaration> node);
                if(this.debugLevel >= TS2ASParser.DebugLevel.INFO && !as3Class.external)
                {
                    console.info("Class: " + as3Class.getFullyQualifiedName());
                }
                this._currentResult.types.push(as3Class);
                break;
            }
            case ts.SyntaxKind.DeclareKeyword:
            case ts.SyntaxKind.EndOfFileToken:
            {
                //this is safe to ignore
                break;
            }
            default:
            {
                if(this.debugLevel >= TS2ASParser.DebugLevel.WARN)
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
                ts.forEachChild(node, this.populatePackageLevelDefinitions.bind(this));
                break;
            }
            case ts.SyntaxKind.ModuleBlock:
            {
                this._namesInCurrentModule = [];
                ts.forEachChild(node, this.addNameToCurrentModule.bind(this));
                ts.forEachChild(node, this.populatePackageLevelDefinitions.bind(this));
                break;
            }
            case ts.SyntaxKind.ModuleDeclaration:
            {
                let moduleDeclaration = <ts.ModuleDeclaration> node;
                let moduleName = moduleDeclaration.name;
                this._moduleStack.push(this.declarationNameToString(moduleName));
                ts.forEachChild(node, this.populatePackageLevelDefinitions.bind(this));
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
                ts.forEachChild(node, this.populatePackageLevelDefinitions.bind(this));
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
            case ts.SyntaxKind.DeclareKeyword:
            case ts.SyntaxKind.EndOfFileToken:
            {
                //this is safe to ignore
                break;
            }
            default:
            {
                if(this.debugLevel >= TS2ASParser.DebugLevel.WARN)
                {
                    console.warn("Unknown SyntaxKind: " + node.kind.toString());
                    console.warn(this._currentSourceFile.text.substring(node.pos, node.end));
                }
                break;
            }
        }
    }
    
    private populateMembers(typeDefinition: as3.TypeDefinition, declaration: ts.ClassLikeDeclaration|ts.InterfaceDeclaration)
    {
        declaration.members.forEach((member: ts.Declaration) =>
        {
            this.populateMember(member, typeDefinition);
        });
    }
    
    private mergeInterfaceAndVariable(interfaceDefinition: as3.InterfaceDefinition, variableDeclaration: ts.VariableDeclaration)
    {
        let variableAccessLevel = this.getAccessLevel(variableDeclaration);
        let as3Class = new as3.ClassDefinition(interfaceDefinition.name,
            interfaceDefinition.packageName, variableAccessLevel,
            interfaceDefinition.sourceFile, interfaceDefinition.require,
            this._currentFileIsExternal);
            
        let index = this._currentResult.types.indexOf(interfaceDefinition);
        this._currentResult.types[index] = as3Class;
    }
    
    private readClass(classDeclaration: ts.ClassDeclaration): as3.ClassDefinition
    {
        let className = this.declarationNameToString(classDeclaration.name);
        let packageName = this._moduleStack.join(".");
        return new as3.ClassDefinition(className, packageName, this.getAccessLevel(classDeclaration), this._currentSourceFile.fileName, this._currentModuleNeedsRequire, this._currentFileIsExternal);
    }
    
    private populateClass(classDeclaration: ts.ClassDeclaration)
    {
        let className = this.declarationNameToString(classDeclaration.name);
        this._namesInCurrentModule.push(className);
        let packageName = this._moduleStack.join(".");
        let fullyQualifiedClassName = className;
        if(packageName.length > 0)
        {
            fullyQualifiedClassName = packageName + "." + className;
        }
        
        let as3Class = <as3.ClassDefinition> as3.getDefinitionByName(fullyQualifiedClassName, this._currentResult.types);
        if(!as3Class)
        {
            throw "Class not found: " + fullyQualifiedClassName;
        }
        
        if(classDeclaration.heritageClauses)
        {
            classDeclaration.heritageClauses.forEach((heritageClause: ts.HeritageClause) =>    
            {
                switch(heritageClause.token)
                {
                    case ts.SyntaxKind.ExtendsKeyword:
                    {
                        let superClassType = heritageClause.types[0];
                        let superClassName = this.typeNodeToAS3Type(superClassType);
                        let superClass = <as3.ClassDefinition> as3.getDefinitionByName(superClassName, this._currentResult.types);
                        if(!superClass)
                        {
                            throw "Super class not found: " + superClassName;
                        }
                        as3Class.superClass = superClass;
                        break;
                    }
                    case ts.SyntaxKind.ImplementsKeyword:
                    {
                        heritageClause.types.forEach((type: ts.TypeNode) =>
                        {
                            let interfaceName = this.typeNodeToAS3Type(type);
                            let as3Interface = <as3.InterfaceDefinition> as3.getDefinitionByName(interfaceName, this._currentResult.types);
                            if(!as3Interface)
                            {
                                throw "Interface not found: " + interfaceName;
                            }
                            as3Class.interfaces.push(as3Interface);
                        });
                        break;
                    }
                }
            });
        }
    
        this.populateMembers(as3Class, classDeclaration);
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
        if(interfaceDeclaration.members.length === 1)
        {
            let member = interfaceDeclaration.members[0];
            if(member.kind === ts.SyntaxKind.CallSignature)
            {
                this._functionAliases.push(fullyQualifiedInterfaceName);
                return null;
            }
        }
        return new as3.InterfaceDefinition(interfaceName, packageName, this.getAccessLevel(interfaceDeclaration), this._currentSourceFile.fileName, this._currentModuleNeedsRequire, this._currentFileIsExternal);
    }
    
    private populateInterface(interfaceDeclaration: ts.InterfaceDeclaration)
    {
        let interfaceName = this.declarationNameToString(interfaceDeclaration.name);
        this._namesInCurrentModule.push(interfaceName);
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
        
        let existingInterface = <as3.TypeDefinition> as3.getDefinitionByName(fullyQualifiedInterfaceName, this._currentResult.types);
        if(!existingInterface)
        {
            throw "Interface not found: " + fullyQualifiedInterfaceName;
        }
        
        //if there's an interface and a var with the same name, it gets turned into a class
        if(existingInterface instanceof as3.InterfaceDefinition)
        {
            let as3Interface = <as3.InterfaceDefinition> existingInterface;
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
                                let interfaceName = this.typeNodeToAS3Type(type);
                                let as3Interface = <as3.InterfaceDefinition> as3.getDefinitionByName(interfaceName, this._currentResult.types);
                                if(!as3Interface)
                                {
                                    throw "Interface not found: " + interfaceName;
                                }
                                as3Interface.interfaces.push(as3Interface);
                            });
                            break;
                        }
                    }
                });
            }
        }
        this.populateMembers(existingInterface, interfaceDeclaration);
    }
    
    private readPackageFunction(functionDeclaration: ts.FunctionDeclaration): as3.PackageFunctionDefinition
    {
        let functionName = this.declarationNameToString(functionDeclaration.name);
        let packageName = this._moduleStack.join(".");
        return new as3.PackageFunctionDefinition(functionName, packageName, this.getAccessLevel(functionDeclaration), this._currentSourceFile.fileName, this._currentModuleNeedsRequire, this._currentFileIsExternal);
    }
    
    private populatePackageFunction(functionDeclaration: ts.FunctionDeclaration)
    {
        let functionName = this.declarationNameToString(functionDeclaration.name);
        this._namesInCurrentModule.push(functionName);
        let packageName = this._moduleStack.join(".");
        let fullyQualifiedPackageFunctionName = functionName;
        if(packageName.length > 0)
        {
            fullyQualifiedPackageFunctionName = packageName + "." + functionName;
        }
        
        let as3PackageFunction = <as3.PackageFunctionDefinition> as3.getDefinitionByName(fullyQualifiedPackageFunctionName, this._currentResult.types);
        if(!as3PackageFunction)
        {
            throw "Package-level function not found: " + fullyQualifiedPackageFunctionName;
        }
        
        let functionType = this.typeNodeToAS3Type(functionDeclaration.type);
        let functionParameters = this.populateParameters(functionDeclaration);
        as3PackageFunction.type = functionType;
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
        let existingDefinition = as3.getDefinitionByName(fullyQualifiedName, this._currentResult.types);
        if(existingDefinition instanceof as3.InterfaceDefinition)
        {
            this.mergeInterfaceAndVariable(existingDefinition, variableDeclaration);
            return null;
        }
        return new as3.PackageVariableDefinition(variableName, packageName, this.getAccessLevel(variableDeclaration), this._currentSourceFile.fileName, this._currentModuleNeedsRequire, this._currentFileIsExternal);
    }
    
    private populatePackageVariable(variableDeclaration: ts.VariableDeclaration)
    {
        let variableName = this.declarationNameToString(variableDeclaration.name);
        this._namesInCurrentModule.push(variableName);
        let packageName = this._moduleStack.join(".");
        let fullyQualifiedPackageVariableName = variableName;
        if(packageName.length > 0)
        {
            fullyQualifiedPackageVariableName = packageName + "." + variableName;
        }
        
        let as3PackageLevelDefinition = <as3.PackageLevelDefinition> as3.getDefinitionByName(fullyQualifiedPackageVariableName, this._currentResult.types);
        if(!as3PackageLevelDefinition)
        {
            throw "Package-level variable not found: " + fullyQualifiedPackageVariableName;
        }
        
        //if there's an interface and a var with the same name, it gets turned into a class
        if(as3PackageLevelDefinition instanceof as3.PackageVariableDefinition)
        {
            let as3PackageVariable = <as3.PackageVariableDefinition> as3PackageLevelDefinition;
            let variableType = this.typeNodeToAS3Type(variableDeclaration.type);
            as3PackageVariable.type = variableType;
        }
        else
        {
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
                as3Type.properties.push(as3Property);
                break;
            }
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
            case ts.SyntaxKind.IndexSignature:
            {
                //this is safe to ignore
                break;
            }
            default:
            {
                if(this.debugLevel >= TS2ASParser.DebugLevel.WARN)
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
        let propertyType = this.typeNodeToAS3Type(propertyDeclaration.type);
        return new as3.PropertyDefinition(propertyName, as3.AccessModifiers[as3.AccessModifiers.public], propertyType);
    }
    
    private populateParameters(functionLikeDeclaration: ts.FunctionLikeDeclaration): as3.ParameterDefinition[]
    {
        let parameters = functionLikeDeclaration.parameters;
        let as3Parameters: as3.ParameterDefinition[] = [];
        for(let i = 0, count = parameters.length; i < count; i++)
        {
            let value = parameters[i];
            let parameterName = this.declarationNameToString(value.name);
            let parameterType = this.typeNodeToAS3Type(value.type);
            //TODO: get value
            let parameterValue = null;//value.initializer;
            as3Parameters.push(new as3.ParameterDefinition(parameterName, parameterType, parameterValue));
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
        let methodName = this.declarationNameToString(functionDeclaration.name);
        let methodType = this.typeNodeToAS3Type(functionDeclaration.type);
        let methodParameters = this.populateParameters(functionDeclaration);
        let accessLevel = as3Type.constructor === as3.ClassDefinition ? as3.AccessModifiers[as3.AccessModifiers.public] : null;
        let method = new as3.MethodDefinition(methodName);
        method.type = methodType;
        method.parameters = methodParameters;
        method.accessLevel = accessLevel;
        return method;
    }
    
}

module TS2ASParser
{
    export enum DebugLevel
    {
        NONE = 0,
        INFO = 1,
        WARN = 2
    }
}

export = TS2ASParser;