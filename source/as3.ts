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
	internal,
	AS3
}

export interface PackageLevelDefinition
{
	name: string;
	packageName: string
	sourceFile: string;
	moduleName: string;
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
	constructor(name: string, packageName: string, accessLevel: string, sourceFile: string, moduleName: string, external: boolean)
	{
		super(name);
		this.packageName = packageName;
		this.accessLevel = accessLevel;
		this.sourceFile = sourceFile;
		this.moduleName = moduleName;
		this.external = external;
	}
	
	packageName: string;
	accessLevel: string;
	sourceFile: string;
	moduleName: string;
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
	constructor(name: string, accessLevel: string, type: TypeDefinition = null, isStatic: boolean = false, isConstant: boolean = false)
	{
		this.name = name;
		this.accessLevel = accessLevel;
		this.type = type;
		this.isStatic = isStatic;
		this.isConstant = isConstant;
	}
	
	name: string;
	type: TypeDefinition;
	accessLevel: string;
	isStatic: boolean;
	isConstant: boolean;
}

export class NamespaceDefinition implements PackageLevelDefinition
{
	constructor(name: string, packageName: string, accessLevel: string, uri: string, sourceFile: string, moduleName: string, external: boolean)
	{
		this.name = name;
		this.packageName = packageName;
		this.accessLevel = accessLevel;
		this.uri = uri;
		this.sourceFile = sourceFile;	
		this.moduleName = moduleName;
		this.external = external;
	}
	
	name: string;
	packageName: string;
	accessLevel: string;
	uri: string;
	sourceFile: string;
	moduleName: string;
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

export class PackageVariableDefinition extends PropertyDefinition implements PackageLevelDefinition
{
	constructor(name: string, packageName: string, accessLevel: string, sourceFile: string, moduleName: string, external: boolean)
	{
		super(name, accessLevel);
		this.packageName = packageName;
		this.sourceFile = sourceFile;
		this.moduleName = moduleName;
		this.external = external;
	}
	
	packageName: string;
	sourceFile: string;
	moduleName: string;
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
	constructor(name: string, packageName: string, accessLevel: string, sourceFile: string, moduleName: string, external: boolean)
	{
		this.name = name;
		this.packageName = packageName;
		this.accessLevel = accessLevel;
		this.sourceFile = sourceFile;
		this.moduleName = moduleName;
		this.external = external;
		this.properties = [];
		this.methods = [];
	}
	
	name: string;
	packageName: string;
	accessLevel: string;
	sourceFile: string;
	moduleName: string;
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
	constructor(name: string, packageName: string, accessLevel: string, sourceFile: string, moduleName: string, external: boolean)
	{
		super(name, packageName, accessLevel, sourceFile, moduleName, external);
		this.interfaces = [];
	}
	
	interfaces: InterfaceDefinition[];
}

export class ClassDefinition extends TypeDefinition
{
	constructor(name: string, packageName: string, accessLevel: string, sourceFile: string, moduleName: string, external: boolean)
	{
		super(name, packageName, accessLevel, sourceFile, moduleName, external);
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

export function requiresImport(target:PackageLevelDefinition, scope:PackageLevelDefinition): boolean
{
	if(!target)
	{
		return false;
	}
	let packageName = target.packageName;
	if(!packageName)
	{
		return false;
	}
	let name = target.name;
	if(packageName === scope.packageName)
	{
		return false;
	}
	return true;
}

export function requiresInterfaceOverride(target:MethodDefinition | PropertyDefinition, scope:InterfaceDefinition): boolean
{
	let memberName = target.name;
	let interfaces = scope.interfaces;
	let needsOverride = false;
	if(target instanceof MethodDefinition)
	{
		needsOverride = scope.methods.some((method) =>
		{
			return method.name === memberName;
		});
	}
	else if(target instanceof PropertyDefinition)
	{
		needsOverride = scope.properties.some((property) =>
		{
			return property.name === memberName;
		});
	}
	if(needsOverride)
	{
		return true;
	}
	let interfaceCount = interfaces.length;
	for(let i = 0; i < interfaceCount; i++)
	{
		let as3Interface = interfaces[i];
		needsOverride = requiresInterfaceOverride(target, as3Interface);
		if(needsOverride)
		{
			return true;
		}
	}
	return false;
}

export function requiresClassOverride(target:MethodDefinition | PropertyDefinition, scope:ClassDefinition): boolean
{
	let memberName = target.name;
	let superClass = scope.superClass;
	let needsOverride = false;
	while(needsOverride === false && superClass !== null)
	{
		if(target instanceof MethodDefinition)
		{
			needsOverride = superClass.methods.some((method) =>
			{
				return method.name === memberName;
			});
		}
		else if(target instanceof PropertyDefinition)
		{
			needsOverride = superClass.properties.some((property) =>
			{
				return property.name === memberName;
			});
		}
		superClass = superClass.superClass;
	}
	return needsOverride;
}

export function getCommonBaseClass(class1: ClassDefinition, class2: ClassDefinition): ClassDefinition
{
	let savedClass2 = class2;
	do
	{
		let class1Name = class1.getFullyQualifiedName();
		do
		{
			let class2Name = class2.getFullyQualifiedName();
			if(class1Name === class2Name)
			{
				return class1;
			}
			class2 = class2.superClass;
		}
		while(class2)
		class2 = savedClass2;
		class1 = class1.superClass;
	}
	while(class1)
	//no common base class, so it's best to default to Object
	return null;
}