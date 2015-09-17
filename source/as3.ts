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
export enum BuiltIns
{
    Object,
    Array,
    Number,
    Boolean,
    String,
    Function,
    Class,
    int,
    uint,
    void
}
export enum AccessModifiers
{
    public,
    protected,
    private,
    internal
}

export interface PackageLevelDefinition
{
    name: string;
    packageName: string
    sourceFile: string;
    require: boolean;
    external: boolean;
    accessLevel: string;
    
    getFullyQualifiedName(): string;
}

export class ParameterDefinition
{
    constructor(name: string, type: TypeDefinition, value: string, isRest: boolean)
    {
        this.name = name;
        this.type = type;
        this.value = value;
        this.isRest = isRest;
    }
    
    name: string;
    type: TypeDefinition;
    value: string;
    isRest: boolean;
}

export class FunctionDefinition
{
    constructor(name: string, type: TypeDefinition = null, parameters: ParameterDefinition[] = null)
    {
        this.name = name;
        this.type = type;
        this.parameters = parameters || [];
    }
    
    name: string;
    type: TypeDefinition;
    parameters: ParameterDefinition[];
}

export class ConstructorDefinition extends FunctionDefinition
{
    constructor(name: string, type: TypeDefinition = null, parameters: ParameterDefinition[] = null)
    {
        super(name, type, parameters);
    }
}

export class MethodDefinition extends FunctionDefinition
{
    constructor(name: string, type: TypeDefinition = null, parameters: ParameterDefinition[] = null, accessLevel: string = null, isStatic: boolean = false)
    {
        super(name, type, parameters)
        this.accessLevel = accessLevel;
        this.isStatic = isStatic;
    }
    
    accessLevel: string;
    isStatic: boolean;
}

export class PackageFunctionDefinition extends MethodDefinition implements PackageLevelDefinition
{
    constructor(name: string, packageName: string, accessLevel: string, sourceFile: string, require: boolean, external: boolean)
    {
        super(name);
        this.packageName = packageName;
        this.accessLevel = accessLevel;
        this.sourceFile = sourceFile;
        this.require = require;
        this.external = external;
    }
    
    packageName: string;
    accessLevel: string;
    sourceFile: string;
    require: boolean;
    external: boolean;
    
    getFullyQualifiedName(): string
    {
        if(this.packageName)
        {
            return this.packageName + "." + this.name;
        }
        return this.name;
    }
}

export class PropertyDefinition
{
    constructor(name: string, accessLevel: string, type: TypeDefinition = null, isStatic: boolean = false)
    {
        this.name = name;
        this.accessLevel = accessLevel;
        this.type = type;
        this.isStatic = isStatic;
    }
    
    name: string;
    type: TypeDefinition;
    accessLevel: string;
    isStatic: boolean;
}

export class PackageVariableDefinition extends PropertyDefinition implements PackageLevelDefinition
{
    constructor(name: string, packageName: string, accessLevel: string, sourceFile: string, require: boolean, external: boolean)
    {
        super(name, accessLevel);
        this.packageName = packageName;
        this.sourceFile = sourceFile;
        this.require = require;
        this.external = external;
    }
    
    packageName: string;
    sourceFile: string;
    require: boolean;
    external: boolean;
    
    getFullyQualifiedName(): string
    {
        if(this.packageName)
        {
            return this.packageName + "." + this.name;
        }
        return this.name;
    }
}

export class TypeDefinition implements PackageLevelDefinition
{
    constructor(name: string, packageName: string, accessLevel: string, sourceFile: string, require: boolean, external: boolean)
    {
        this.name = name;
        this.packageName = packageName;
        this.accessLevel = accessLevel;
        this.sourceFile = sourceFile;
        this.require = require;
        this.external = external;
        this.properties = [];
        this.methods = [];
    }
    
    name: string;
    packageName: string;
    accessLevel: string;
    sourceFile: string;
    require: boolean;
    external: boolean;
    properties:PropertyDefinition[];
    methods:MethodDefinition[];
    
    getFullyQualifiedName(): string
    {
        if(this.packageName)
        {
            return this.packageName + "." + this.name;
        }
        return this.name;
    }
}

export class InterfaceDefinition extends TypeDefinition
{
    constructor(name: string, packageName: string, accessLevel: string, sourceFile: string, require: boolean, external: boolean)
    {
        super(name, packageName, accessLevel, sourceFile, require, external);
        this.interfaces = [];
    }
    
    interfaces: InterfaceDefinition[];
}

export class ClassDefinition extends TypeDefinition
{
    constructor(name: string, packageName: string, accessLevel: string, sourceFile: string, require: boolean, external: boolean)
    {
        super(name, packageName, accessLevel, sourceFile, require, external);
        this.superClass = null;
        this.interfaces = [];
        this.constructorMethod = null;
        this.dynamic = false;
    }
    
    superClass: ClassDefinition;
    interfaces: InterfaceDefinition[];
    constructorMethod: ConstructorDefinition;
    dynamic: boolean;
}

export class StaticSideClassDefinition extends ClassDefinition {}

export function getDefinitionByName(name: string, types: PackageLevelDefinition[]): PackageLevelDefinition
{
    for(let as3Type of types)
    {
        if(as3Type.getFullyQualifiedName() === name)
        {
            return as3Type;
        }
    }
    return null;
}

let KEYWORD_NULL = "null";
let AS3_RETURN_VALUE_MAP = {};
AS3_RETURN_VALUE_MAP[BuiltIns[BuiltIns.Number]] = "0";
AS3_RETURN_VALUE_MAP[BuiltIns[BuiltIns.Boolean]] = "false";

export function getDefaultReturnValueForType(type: TypeDefinition): string
{
    let fullyQualifiedName = type.getFullyQualifiedName();
    if(AS3_RETURN_VALUE_MAP.hasOwnProperty(fullyQualifiedName))
    {
        return AS3_RETURN_VALUE_MAP[fullyQualifiedName];
    }
    return KEYWORD_NULL;
}