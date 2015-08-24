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
    constructor()
    {
        this._functionAliases = [];
        this._typeAliasMap = {};
        this._typeParameterMap = {};
        this._standardLibDefinitions = [];
    }
    
    private _definitions: as3.PackageLevelDefinition[];
    private _standardLibDefinitions: as3.PackageLevelDefinition[];
    private _functionAliases: string[];
    private _typeAliasMap: any;
    private _typeParameterMap:any;
    private _currentSourceFile: ts.SourceFile;
    private _currentFileIsExternal: boolean;
    private _moduleStack: string[];
    private _currentModuleNeedsRequire: boolean;
    private _namesInCurrentModule: string[];
    private _variableStatementHasDeclareKeyword: boolean = false;
    private _variableStatementHasExport: boolean = false;
    debugLevel: TS2ASParser.DebugLevel = TS2ASParser.DebugLevel.NONE;
    
    setStandardLib(fileName: string, sourceText: string)
    {
        this._currentFileIsExternal = true;
        this._currentSourceFile = this.addFileInternal(fileName, sourceText);
        this.populatePackageLevelDefinitions(this._currentSourceFile);
        this._standardLibDefinitions = this._definitions.slice();
    }
    
    parse(fileName: string, sourceText: string): as3.PackageLevelDefinition[]
    {
        this._currentFileIsExternal = false;
        this._currentSourceFile = this.addFileInternal(fileName, sourceText);
        this.populatePackageLevelDefinitions(this._currentSourceFile);
        return this._definitions;
    }
    
    private addFileInternal(fileName: string, sourceText: string): ts.SourceFile
    {
        this._namesInCurrentModule = [];
        this._moduleStack = [];
        this._currentSourceFile = ts.createSourceFile(fileName, sourceText, ts.ScriptTarget.ES5);
        if(this._currentSourceFile.hasNoDefaultLib)
        {
            this._definitions = [];
        }
        else
        {
            this._definitions = this._standardLibDefinitions.slice();
        }
        this.readPackageLevelDefinitions(this._currentSourceFile);
        if(this._currentSourceFile.hasNoDefaultLib)
        {
            this.addDynamicFlagToStandardLibraryClasses();
        
            //void is a special type that is defined by the language, and it
            //doesn't appear in the standard library. we need to add it
            //manually.
            this._definitions.push(new as3.InterfaceDefinition("void", null, null, null, false, true));
        }
        return this._currentSourceFile;
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
                    this._definitions.push(as3Interface);
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
            case ts.SyntaxKind.TypeAliasDeclaration:
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
           
        let index = this._definitions.indexOf(interfaceDefinition);
        this._definitions[index] = as3Class;
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
        
        let as3Class = <as3.ClassDefinition> as3.getDefinitionByName(fullyQualifiedClassName, this._definitions);
        if(!as3Class)
        {
            throw "Class not found: " + fullyQualifiedClassName;
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
                        let superClassAS3Type = this.getAS3TypeFromTSTypeNode(superClassTSType);
                        let superClass = <as3.ClassDefinition> superClassAS3Type;
                        if(!superClass)
                        {
                            throw "Super class not found: " + this.getAS3FullyQualifiedNameFromTSTypeNode(superClassTSType);
                        }
                        as3Class.superClass = superClass;
                        break;
                    }
                    case ts.SyntaxKind.ImplementsKeyword:
                    {
                        heritageClause.types.forEach((type: ts.TypeNode) =>
                        {
                            let interfaceAS3Type = this.getAS3TypeFromTSTypeNode(type);
                            let as3Interface = <as3.InterfaceDefinition> interfaceAS3Type;
                            if(!as3Interface)
                            {
                                throw "Interface to implement not found: " + this.getAS3FullyQualifiedNameFromTSTypeNode(type);
                            }
                            as3Class.interfaces.push(as3Interface);
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
        
        //an interface may have been converted into a class,
        //so that's why the superclass of InterfaceDefinition
        //and ClassDefinition is used here.
        let existingInterface = <as3.TypeDefinition> as3.getDefinitionByName(fullyQualifiedInterfaceName, this._definitions);
        if(!existingInterface)
        {
            throw "Interface not found: " + fullyQualifiedInterfaceName;
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
                                let interfaceAS3Type = this.getAS3TypeFromTSTypeNode(type);
                                let otherInterface = <as3.InterfaceDefinition> interfaceAS3Type;
                                if(!otherInterface)
                                {
                                    throw "Interface to extend not found: " + this.getAS3FullyQualifiedNameFromTSTypeNode(type);
                                }
                                existingInterface.interfaces.push(otherInterface);
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
        if(existingFunction)
        {
            //this function already exists, so this is an overload and we can
            //ignore it, for now.
            return null;
        }
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
        
        let as3PackageFunction = <as3.PackageFunctionDefinition> as3.getDefinitionByName(fullyQualifiedPackageFunctionName, this._definitions);
        if(!as3PackageFunction)
        {
            throw "Package-level function not found: " + fullyQualifiedPackageFunctionName;
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
        let existingDefinition = as3.getDefinitionByName(fullyQualifiedName, this._definitions);
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
        
        let as3PackageLevelDefinition = <as3.PackageLevelDefinition> as3.getDefinitionByName(fullyQualifiedPackageVariableName, this._definitions);
        if(!as3PackageLevelDefinition)
        {
            throw "Package-level variable not found: " + fullyQualifiedPackageVariableName;
        }
        
        let variableType = this.getAS3TypeFromTSTypeNode(variableDeclaration.type);
        if(as3PackageLevelDefinition instanceof as3.PackageVariableDefinition)
        {
            let as3PackageVariable = <as3.PackageVariableDefinition> as3PackageLevelDefinition;
            as3PackageVariable.type = variableType;
        }
        else if(as3PackageLevelDefinition instanceof as3.ClassDefinition)
        {
            //if there's an interface and a var with the same name, it gets turned into a class
            if(variableType === as3PackageLevelDefinition)
            {
                //if the variable is typed as its own name, then everything
                //already defined on the class should be made static.
                for(let property of as3PackageLevelDefinition.properties)
                {
                    property.isStatic = true;
                }
                for(let method of as3PackageLevelDefinition.methods)
                {
                    method.isStatic = true;
                }
            }
            else
            {
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
            }
        }
        else //something went terribly wrong
        {
            if(this.debugLevel >= TS2ASParser.DebugLevel.WARN)
            {
                console.error("Cannot populate package variable named " + fullyQualifiedPackageVariableName + ".");
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
        let propertyType = this.getAS3TypeFromTSTypeNode(propertyDeclaration.type);
        if(!propertyType)
        {
            // TODO : remove this!
            {
                propertyType = <as3.TypeDefinition> as3.getDefinitionByName(as3.BuiltIns[as3.BuiltIns.Object], this._definitions);
            }
        }
        let isStatic = (propertyDeclaration.flags & ts.NodeFlags.Static) === ts.NodeFlags.Static;
        return new as3.PropertyDefinition(propertyName, as3.AccessModifiers[as3.AccessModifiers.public], propertyType, isStatic);
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
        let typeParameters = this.populateTypeParameters(functionDeclaration);
        
        let methodName = this.declarationNameToString(functionDeclaration.name);
        let methodType = this.getAS3TypeFromTSTypeNode(functionDeclaration.type);
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
        INFO = 1,
        WARN = 2
    }
}

export = TS2ASParser;