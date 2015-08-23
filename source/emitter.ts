/// <reference path="./as3.ts" />

import as3 = require("./as3");

let KEYWORD_NULL = "null";

let NEW_LINE = "\n";

let AS3_RETURN_VALUE_MAP = {};
AS3_RETURN_VALUE_MAP[as3.BuiltIns[as3.BuiltIns.Number]] = "0";
AS3_RETURN_VALUE_MAP[as3.BuiltIns[as3.BuiltIns.Boolean]] = "false";

function as3TypeToDefaultReturnValue(type: string): string
{
    if(AS3_RETURN_VALUE_MAP.hasOwnProperty(type))
    {
        return AS3_RETURN_VALUE_MAP[type];
    }
    return KEYWORD_NULL;
}

function arrayValues(array: Array<any>): Array<any>
{
    let values: string[] = [];
    array.forEach((item) =>
    {
        if(values.indexOf(item) < 0)
        {
            values.push(item);
        }
    });
    return values;
}

class ASEmitter
{
    constructor(types: as3.PackageLevelDefinition[])
    {
        this._types = types;
    }
    
    private _types: as3.PackageLevelDefinition[];
    
    emitClass(as3Class: as3.ClassDefinition): string
    {
        let className = as3Class.name;
        let superClass = as3Class.superClass;
        let interfaces = as3Class.interfaces;
        let classOutput = this.emitStartPackage(as3Class.packageName);
        let imports: string[] = [];
        
        if(superClass && this.requiresImport(superClass, as3Class))
        {
            imports.push(superClass.getFullyQualifiedName());
        }
        if(interfaces.length > 0)
        {
            interfaces.forEach((as3Interface) =>
            {
                if(!this.requiresImport(as3Interface, as3Class))
                {
                    return;
                }
                imports.push(as3Interface.getFullyQualifiedName());
            });
        }
        
        for(let as3Import of arrayValues(imports))
        {
            classOutput += "import " + as3Import + ";";
            classOutput += NEW_LINE;
        }
        
        classOutput += this.emitRequireMetadata(as3Class);
        classOutput += as3Class.accessLevel;
        if(as3Class.dynamic)
        {
            classOutput += " dynamic";
        }
        classOutput += " class ";
        classOutput += className;
        if(superClass)
        {
            classOutput += " extends ";
            classOutput += this.getNameToEmit(superClass, as3Class);
        }
        if(interfaces.length > 0)
        {
            classOutput += " implements ";
            interfaces.forEach((as3Interface, index: number) =>
            {
                if(index > 0)
                {
                    classOutput += ", ";
                }
                classOutput += this.getNameToEmit(as3Interface, as3Class);
            });
        }
        classOutput += NEW_LINE;
        classOutput += "{" + NEW_LINE;
        
        //static properties and methods first
        let needsExtraNewLine: boolean = false;
        as3Class.properties.forEach((property: as3.PropertyDefinition) =>
        {
            if(!property.isStatic)
            {
                return;
            }
            classOutput += this.emitProperty(property);
            classOutput += NEW_LINE;
            needsExtraNewLine = true;
        });
        if(needsExtraNewLine)
        {
            classOutput += NEW_LINE;
        }
        
        needsExtraNewLine = false;
        as3Class.methods.forEach((method: as3.MethodDefinition) =>
        {
            if(!method.isStatic)
            {
                return;
            }
            classOutput += this.emitMethod(method);
            classOutput += NEW_LINE;
            needsExtraNewLine = true;
        });
        if(needsExtraNewLine)
        {
            classOutput += NEW_LINE;
        }
        
        classOutput += "public function ";
        classOutput += className;
        if(as3Class.constructorMethod)
        {
            classOutput += this.emitParameters(as3Class.constructorMethod);
            if(superClass)
            {
                classOutput += " {";
                let constructorMethod = superClass.constructorMethod;
                if(constructorMethod)
                {
                    classOutput += " super(";
                    let params = constructorMethod.parameters;
                    for(let i = 0, paramCount = params.length; i < paramCount; i++)
                    {
                        let param = params[i];
                        if(i > 0)
                        {
                            classOutput += ", ";
                        }
                        classOutput += as3TypeToDefaultReturnValue(<string> param.type);
                    }
                    classOutput += "); ";
                }
                classOutput += "}";
            }
            else
            {
                classOutput += "{}"
            }
            classOutput += NEW_LINE;
        }
        else
        {
            classOutput += "() {}";
        }
        classOutput += NEW_LINE;
        
        needsExtraNewLine = false;
        as3Class.properties.forEach((property: as3.PropertyDefinition) =>
        {
            if(property.isStatic)
            {
                return;
            }
            classOutput += this.emitProperty(property);
            classOutput += NEW_LINE;
            needsExtraNewLine = true;
        });
        if(needsExtraNewLine)
        {
            classOutput += NEW_LINE;
        }
        
        needsExtraNewLine = false;
        as3Class.methods.forEach((method: as3.MethodDefinition) =>
        {
            if(method.isStatic)
            {
                return;
            }
            classOutput += this.emitMethod(method);
            classOutput += NEW_LINE;
        });
        
        //end class
        classOutput += "}" + NEW_LINE;
    
        classOutput += this.emitEndPackage();
        return classOutput;
    }
    
    emitInterface(as3Interface: as3.InterfaceDefinition): string
    {
        let interfaceName = as3Interface.name;
        let interfaces = as3Interface.interfaces;
        
        let interfaceOutput = this.emitStartPackage(as3Interface.packageName);
        
        let imports: string[] = [];
        if(interfaces.length > 0)
        {
            interfaces.forEach((otherInterface) =>
            {
                if(!this.requiresImport(otherInterface, as3Interface))
                {
                    return;
                }
                imports.push(otherInterface.getFullyQualifiedName());
            });
        }
        
        for(let as3Import of arrayValues(imports))
        {
            interfaceOutput += "import " + as3Import + ";";
            interfaceOutput += NEW_LINE;
        }
        
        interfaceOutput += this.emitRequireMetadata(as3Interface);
        interfaceOutput += as3Interface.accessLevel;
        interfaceOutput += " interface ";
        interfaceOutput += interfaceName;
        if(interfaces.length > 0)
        {
            interfaceOutput += " extends ";
            interfaces.forEach((otherInterface, index) =>
            {
                if(index > 0)
                {
                    interfaceOutput += ", ";
                }
                interfaceOutput += this.getNameToEmit(otherInterface, as3Interface);
            });
        }
        interfaceOutput += NEW_LINE;
        interfaceOutput += "{" + NEW_LINE;
        
        as3Interface.properties.forEach((property: as3.PropertyDefinition) =>
        {
            interfaceOutput += this.emitProperty(property);
            interfaceOutput += NEW_LINE;
        });
        
        as3Interface.methods.forEach((method: as3.MethodDefinition) =>
        {
            interfaceOutput += this.emitMethod(method);
            interfaceOutput += NEW_LINE;
        });
        
        //end class
        interfaceOutput += "}" + NEW_LINE;
    
        interfaceOutput += this.emitEndPackage();
        return interfaceOutput;
    }
    
    emitPackageFunction(as3PackageFunction: as3.PackageFunctionDefinition): string
    {
        let packageFunctionOutput = this.emitStartPackage(as3PackageFunction.packageName);
        packageFunctionOutput += this.emitRequireMetadata(as3PackageFunction);
        packageFunctionOutput += this.emitMethod(as3PackageFunction);
        packageFunctionOutput += NEW_LINE;
        packageFunctionOutput += this.emitEndPackage();
        return packageFunctionOutput;
    }
    
    emitPackageVariable(as3PackageVariable: as3.PackageVariableDefinition): string
    {
        let packageVariableOutput = this.emitStartPackage(as3PackageVariable.packageName);
        packageVariableOutput += this.emitRequireMetadata(as3PackageVariable);
        packageVariableOutput += this.emitVariable(as3PackageVariable);
        packageVariableOutput += NEW_LINE;
        packageVariableOutput += this.emitEndPackage();
        return packageVariableOutput;
    }
    
    private getNameToEmit(target:as3.PackageLevelDefinition, scope:as3.PackageLevelDefinition): string
    {
        let name = target.name;
        let packageName = target.packageName;
        if(!packageName)
        {
            return name;
        }
        //if it's in the same package as the scope, it can be shortened.
        //however, there's one exception. if there's a top level definition
        //with the same name, we need to be specific.
        if(packageName === scope.packageName && as3.getDefinitionByName(name, this._types) === null)
        {
            return name;
        }
        return target.getFullyQualifiedName();
    }
    
    private requiresImport(target:as3.PackageLevelDefinition, scope:as3.PackageLevelDefinition): boolean
    {
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
    
    private emitMethod(as3Method: as3.MethodDefinition): string
    {
        let methodName = as3Method.name;
        let methodType = as3Method.type;
        let accessLevel = as3Method.accessLevel;
        let isStatic = as3Method.isStatic;
        
        let methodOutput = "function ";
        if(isStatic)
        {
            methodOutput = "static " + methodOutput;
        }
        if(accessLevel !== null)
        {
            methodOutput = accessLevel + " " + methodOutput;
        }
        methodOutput += methodName;
        methodOutput += this.emitParameters(as3Method);
        if(methodType !== as3.BuiltIns[as3.BuiltIns.void])
        {
            methodOutput += ":";
            methodOutput += methodType;
            methodOutput += " { return ";
            methodOutput += as3TypeToDefaultReturnValue(<string> methodType);
            methodOutput += "; }";
        }
        else //void
        {
            methodOutput += ":" + methodType + " {}";
        }
        return methodOutput;
    }
    
    private emitProperty(as3Property: as3.PropertyDefinition): string
    {
        let propertyName = as3Property.name;
        let propertyType = as3Property.type;
        let accessLevel = as3Property.accessLevel;
        let isStatic = as3Property.isStatic;
        
        let propertyOutput = accessLevel;
        if(isStatic)
        {
            propertyOutput += " static";
        }
        propertyOutput += " function get ";
        propertyOutput += propertyName;
        propertyOutput += "():";
        propertyOutput += propertyType;
        propertyOutput += " { return ";
        propertyOutput += as3TypeToDefaultReturnValue(<string> propertyType);
        propertyOutput += "; }";
        propertyOutput += NEW_LINE;
        
        propertyOutput += accessLevel;
        if(isStatic)
        {
            propertyOutput += " static";
        }
        propertyOutput += " function set ";
        propertyOutput += propertyName;
        propertyOutput += "(value:";
        propertyOutput += propertyType;
        propertyOutput += "):" + as3.BuiltIns[as3.BuiltIns.void] + " {}";
        return propertyOutput;
    }
    
    private emitVariable(as3Property: as3.PropertyDefinition): string
    {
        let propertyName = as3Property.name;
        let propertyType = as3Property.type;
        let accessLevel = as3Property.accessLevel;
        
        let propertyOutput = accessLevel;
        propertyOutput += " var ";
        propertyOutput += propertyName;
        propertyOutput += ":";
        propertyOutput += propertyType;
        propertyOutput += ";";
        propertyOutput += NEW_LINE;
        
        return propertyOutput;
    }
    
    private emitStartPackage(packageName: string): string
    {
        return "package " + packageName + NEW_LINE + "{" + NEW_LINE;
    }
    
    private emitRequireMetadata(as3Type: as3.PackageLevelDefinition): string
    {
        if(as3Type.require)
        {
            return "[Require(\"" + as3Type.packageName + "\")]" + NEW_LINE;
        }
        return ""
    }
    
    private emitEndPackage(): string
    {
        return "}";
    }
    
    private emitParameters(as3Function: as3.FunctionDefinition): string
    {   
        let parameters = as3Function.parameters;
        
        let signatureOutput = "(";
        if(parameters)
        {
            for(let i = 0, count = parameters.length; i < count; i++)
            {
                if(i > 0)
                {
                    signatureOutput += ", ";
                }
                let parameter = parameters[i];
                signatureOutput += parameter.name;
                if(parameter.type)
                {
                    signatureOutput += ":" + parameter.type;
                } 
            }
        }
        signatureOutput += ")";
        return signatureOutput;
    }
}

export = ASEmitter;