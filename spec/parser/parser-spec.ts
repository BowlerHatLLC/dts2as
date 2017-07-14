/*
Copyright 2015-2017 Bowler Hat LLC

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

import * as path from "path";
import * as ts from "typescript";
import * as as3 from "./as3";
import TS2ASParser, {DebugLevel} from "./parser";

describe("The parser", () =>
{
	let parser: TS2ASParser;
	it("must parse the ES5 standard library", () =>
	{
		parser = new TS2ASParser(ts.ScriptTarget.Latest);
		parser.debugLevel = DebugLevel.WARN;
		let es5Path = require.resolve("typescript");
		es5Path = path.dirname(es5Path);
		es5Path = path.resolve(es5Path, "lib.d.ts");
		let result = parser.parse([es5Path]);
		expect(result).not.toBeNull();
		expect(result).not.toBeUndefined();
		let symbols = result.definitions;
		expect(symbols).not.toBeNull();
		expect(symbols).not.toBeUndefined();
		expect(symbols.length).toBeGreaterThan(0);
	});
	it("must parse the ES2015 standard library", () =>
	{
		parser = new TS2ASParser(ts.ScriptTarget.ES2015);
		parser.debugLevel = DebugLevel.WARN;
		let es2015Path = require.resolve("typescript");
		es2015Path = path.dirname(es2015Path);
		es2015Path = path.resolve(es2015Path, "lib.es2015.d.ts");
		let result = parser.parse([es2015Path]);
		expect(result).not.toBeNull();
		expect(result).not.toBeUndefined();
		let symbols = result.definitions;
		expect(symbols).not.toBeNull();
		expect(symbols).not.toBeUndefined();
		expect(symbols.length).toBeGreaterThan(0);
	});
	it("must parse the ES2016 standard library", () =>
	{
		parser = new TS2ASParser(ts.ScriptTarget.ES2016);
		parser.debugLevel = DebugLevel.WARN;
		let es2016Path = require.resolve("typescript");
		es2016Path = path.dirname(es2016Path);
		es2016Path = path.resolve(es2016Path, "lib.es2016.d.ts");
		let result = parser.parse([es2016Path]);
		expect(result).not.toBeNull();
		expect(result).not.toBeUndefined();
		let symbols = result.definitions;
		expect(symbols).not.toBeNull();
		expect(symbols).not.toBeUndefined();
		expect(symbols.length).toBeGreaterThan(0);
	});
});

describe("A TypeScript definition", () =>
{
	let parser: TS2ASParser;
	beforeAll(() =>
	{
		parser = new TS2ASParser(ts.ScriptTarget.Latest);
		parser.debugLevel = DebugLevel.WARN;
	});
	it("may declare a class", () =>
	{
		let symbols = parser.parse(["spec/fixtures/declare-class.d.ts"]).definitions;
		let as3Class = as3.getDefinitionByName("DeclareClass", symbols);
		expect(as3Class).not.toBeNull();
		expect(as3Class.constructor).toBe(as3.ClassDefinition);
		expect(as3Class.accessLevel).toBe(as3.AccessModifiers[as3.AccessModifiers.public]);
		expect(as3Class.moduleName).toBeNull();
	});
	it("may export a class", () =>
	{
		let symbols = parser.parse(["spec/fixtures/export-class.d.ts"]).definitions;
		let as3Class = as3.getDefinitionByName("ExportClass", symbols);
		expect(as3Class).not.toBeNull();
		expect(as3Class.constructor).toBe(as3.ClassDefinition);
		expect(as3Class.accessLevel).toBe(as3.AccessModifiers[as3.AccessModifiers.public]);
		expect(as3Class.moduleName).toBeNull();
	});
	it("may export a class in a module", () =>
	{
		let symbols = parser.parse(["spec/fixtures/class-in-module.d.ts"]).definitions;
		let as3Class = as3.getDefinitionByName("test.ClassInModule", symbols);
		expect(as3Class).not.toBeNull();
		expect(as3Class.constructor).toBe(as3.ClassDefinition);
		expect(as3Class.accessLevel).toBe(as3.AccessModifiers[as3.AccessModifiers.public]);
		expect(as3Class.moduleName).toBeNull();
	});
	it("may export a class in a module with a dot in the name", () =>
	{
		let symbols = parser.parse(["spec/fixtures/class-in-module-with-dot.d.ts"]).definitions;
		let as3Class = as3.getDefinitionByName("com.example.ClassInNestedModule", symbols);
		expect(as3Class).not.toBeNull();
		expect(as3Class.constructor).toBe(as3.ClassDefinition);
		expect(as3Class.accessLevel).toBe(as3.AccessModifiers[as3.AccessModifiers.public]);
		expect(as3Class.moduleName).toBeNull();
	});
	it("may export a class in a nested module", () =>
	{
		let symbols = parser.parse(["spec/fixtures/class-in-nested-module.d.ts"]).definitions;
		let as3Class = as3.getDefinitionByName("com.example.ClassInNestedModule", symbols);
		expect(as3Class).not.toBeNull();
		expect(as3Class.constructor).toBe(as3.ClassDefinition);
		expect(as3Class.accessLevel).toBe(as3.AccessModifiers[as3.AccessModifiers.public]);
		expect(as3Class.moduleName).toBeNull();
	});
	it("may export a class in a string module", () =>
	{
		let symbols = parser.parse(["spec/fixtures/class-in-string-module.d.ts"]).definitions;
		let as3Class = as3.getDefinitionByName("test.ClassInStringModule", symbols);
		expect(as3Class).not.toBeNull();
		expect(as3Class.constructor).toBe(as3.ClassDefinition);
		expect(as3Class.accessLevel).toBe(as3.AccessModifiers[as3.AccessModifiers.public]);
		expect(as3Class.moduleName).toBe("test");
	});
	it("may declare an interface", () =>
	{
		let symbols = parser.parse(["spec/fixtures/declare-interface.d.ts"]).definitions;
		let as3Interface = as3.getDefinitionByName("DeclareInterface", symbols);
		expect(as3Interface).not.toBeNull();
		expect(as3Interface.constructor).toBe(as3.InterfaceDefinition);
		expect(as3Interface.accessLevel).toBe(as3.AccessModifiers[as3.AccessModifiers.public]);
		expect(as3Interface.moduleName).toBeNull();
	});
	it("may export an interface", () =>
	{
		let symbols = parser.parse(["spec/fixtures/export-interface.d.ts"]).definitions;
		let as3Interface = as3.getDefinitionByName("ExportInterface", symbols);
		expect(as3Interface).not.toBeNull();
		expect(as3Interface.constructor).toBe(as3.InterfaceDefinition);
		expect(as3Interface.accessLevel).toBe(as3.AccessModifiers[as3.AccessModifiers.public]);
		expect(as3Interface.moduleName).toBeNull();
	});
	it("may declare a function", () =>
	{
		let symbols = parser.parse(["spec/fixtures/declare-function.d.ts"]).definitions;
		let as3Function = as3.getDefinitionByName("declareFunction", symbols);
		expect(as3Function).not.toBeNull();
		expect(as3Function.constructor).toBe(as3.PackageFunctionDefinition);
		expect(as3Function.accessLevel).toBe(as3.AccessModifiers[as3.AccessModifiers.public]);
		expect(as3Function.moduleName).toBeNull();
	});
	it("may export a function", () =>
	{
		let symbols = parser.parse(["spec/fixtures/export-function.d.ts"]).definitions;
		let as3Function = as3.getDefinitionByName("exportFunction", symbols);
		expect(as3Function).not.toBeNull();
		expect(as3Function.constructor).toBe(as3.PackageFunctionDefinition);
		expect(as3Function.accessLevel).toBe(as3.AccessModifiers[as3.AccessModifiers.public]);
		expect(as3Function.moduleName).toBeNull();
	});
	it("may declare a variable", () =>
	{
		let symbols = parser.parse(["spec/fixtures/declare-variable.d.ts"]).definitions;
		let as3Variable = as3.getDefinitionByName("declareVariable", symbols);
		expect(as3Variable).not.toBeNull();
		expect(as3Variable.constructor).toBe(as3.PackageVariableDefinition);
		expect(as3Variable.accessLevel).toBe(as3.AccessModifiers[as3.AccessModifiers.public]);
		expect(as3Variable.moduleName).toBeNull();
	});
	it("may export a variable", () =>
	{
		let symbols = parser.parse(["spec/fixtures/export-variable.d.ts"]).definitions;
		let as3Variable = as3.getDefinitionByName("exportVariable", symbols);
		expect(as3Variable).not.toBeNull();
		expect(as3Variable.constructor).toBe(as3.PackageVariableDefinition);
		expect(as3Variable.accessLevel).toBe(as3.AccessModifiers[as3.AccessModifiers.public]);
		expect(as3Variable.moduleName).toBeNull();
	});
	it("may declare an inner class", () =>
	{
		let symbols = parser.parse(["spec/fixtures/inner-class.d.ts"]).definitions;
		let as3OuterClass = as3.getDefinitionByName("OuterClass", symbols);
		expect(as3OuterClass).not.toBeNull();
		expect(as3OuterClass.constructor).toBe(as3.ClassDefinition);
		expect(as3OuterClass.accessLevel).toBe(as3.AccessModifiers[as3.AccessModifiers.public]);
		expect(as3OuterClass.moduleName).toBeNull();
		let as3InnerClass = as3.getDefinitionByName("OuterClass.InnerClass", symbols);
		expect(as3InnerClass).not.toBeNull();
		expect(as3InnerClass.constructor).toBe(as3.ClassDefinition);
		expect(as3InnerClass.accessLevel).toBe(as3.AccessModifiers[as3.AccessModifiers.public]);
		expect(as3InnerClass.moduleName).toBeNull();
	});
	it("may declare an enum", () =>
	{
		let symbols = parser.parse(["spec/fixtures/declare-enum.d.ts"]).definitions;
		let as3Class = as3.getDefinitionByName("DeclareEnum", symbols);
		expect(as3Class).not.toBeNull();
		expect(as3Class.constructor).toBe(as3.ClassDefinition);
		expect(as3Class.accessLevel).toBe(as3.AccessModifiers[as3.AccessModifiers.public]);
		expect(as3Class.moduleName).toBeNull();
	});
	it("may export an enum", () =>
	{
		let symbols = parser.parse(["spec/fixtures/export-enum.d.ts"]).definitions;
		let as3Class = as3.getDefinitionByName("ExportEnum", symbols);
		expect(as3Class).not.toBeNull();
		expect(as3Class.constructor).toBe(as3.ClassDefinition);
		expect(as3Class.accessLevel).toBe(as3.AccessModifiers[as3.AccessModifiers.public]);
		expect(as3Class.moduleName).toBeNull();
	});
});

describe("A class", () =>
{
	let parser: TS2ASParser;
	beforeAll(() =>
	{
		parser = new TS2ASParser(ts.ScriptTarget.Latest);
		parser.debugLevel = DebugLevel.WARN;
	});
	it("must use interface method signature when class overrides parameter type", () =>
	{
		let symbols = parser.parse(["spec/fixtures/class-method-change-interface-parameter-type.d.ts"]).definitions;
		let as3Class = <as3.ClassDefinition> as3.getDefinitionByName("ClassChangeInterfaceParameterType", symbols);
		expect(as3Class).not.toBeNull();
		expect(as3Class.methods.length).toBe(1);
		let method = as3Class.methods[0];
		expect(method).not.toBeNull();
		expect(method.name).toBe("method1");
		expect(method.accessLevel).toBe(as3.AccessModifiers[as3.AccessModifiers.public]);
		expect(method.isStatic).toBe(false);
		expect(method.parameters.length).toBe(1);
		let params = method.parameters;
		let param1 = params[0];
		expect(param1).not.toBeNull();
		let as3ParameterType = <as3.TypeDefinition> as3.getDefinitionByName("Object", symbols);
		expect(param1.type).toBe(as3ParameterType);
	});
	it("may have a member variable", () =>
	{
		let symbols = parser.parse(["spec/fixtures/class-member-variable.d.ts"]).definitions;
		let as3Class = <as3.ClassDefinition> as3.getDefinitionByName("ClassWithVariable", symbols);
		expect(as3Class).not.toBeNull();
		expect(as3Class.properties.length).toBe(1);
		let property = as3Class.properties[0];
		expect(property).not.toBeNull();
		expect(property.name).toBe("variable1");
		expect(property.accessLevel).toBe(as3.AccessModifiers[as3.AccessModifiers.public]);
		expect(property.isStatic).toBe(false);
		let as3PropertyType = <as3.TypeDefinition> as3.getDefinitionByName("String", symbols);
		expect(property.type).toBe(as3PropertyType);
	});
	it("may have a static variable", () =>
	{
		let symbols = parser.parse(["spec/fixtures/class-static-property.d.ts"]).definitions;
		let as3Class = <as3.ClassDefinition> as3.getDefinitionByName("ClassWithStaticProperty", symbols);
		expect(as3Class).not.toBeNull();
		expect(as3Class.properties.length).toBe(1);
		let property = as3Class.properties[0];
		expect(property).not.toBeNull();
		expect(property.name).toBe("property1");
		expect(property.accessLevel).toBe(as3.AccessModifiers[as3.AccessModifiers.public]);
		expect(property.isStatic).toBe(true);
		let as3PropertyType = <as3.TypeDefinition> as3.getDefinitionByName("String", symbols);
		expect(property.type).toBe(as3PropertyType);
	});
	it("may have a member method", () =>
	{
		let symbols = parser.parse(["spec/fixtures/class-member-method.d.ts"]).definitions;
		let as3Class = <as3.ClassDefinition> as3.getDefinitionByName("ClassWithMethod", symbols);
		expect(as3Class).not.toBeNull();
		expect(as3Class.methods.length).toBe(1);
		let method = as3Class.methods[0];
		expect(method).not.toBeNull();
		expect(method.name).toBe("method1");
		expect(method.accessLevel).toBe(as3.AccessModifiers[as3.AccessModifiers.public]);
		expect(method.isStatic).toBe(false);
		let as3MethodType = <as3.TypeDefinition> as3.getDefinitionByName("Number", symbols);
		expect(method.type).toBe(as3MethodType);
	});
	it("may have a static method", () =>
	{
		let symbols = parser.parse(["spec/fixtures/class-static-method.d.ts"]).definitions;
		let as3Class = <as3.ClassDefinition> as3.getDefinitionByName("ClassWithStaticMethod", symbols);
		expect(as3Class).not.toBeNull();
		expect(as3Class.methods.length).toBe(1);
		let method = as3Class.methods[0];
		expect(method).not.toBeNull();
		expect(method.name).toBe("method1");
		expect(method.accessLevel).toBe(as3.AccessModifiers[as3.AccessModifiers.public]);
		expect(method.isStatic).toBe(true);
		let as3MethodType = <as3.TypeDefinition> as3.getDefinitionByName("Number", symbols);
		expect(method.type).toBe(as3MethodType);
	});
	it("may have a static property and a member property with the same name", () =>
	{
		let symbols = parser.parse(["spec/fixtures/class-member-static-property-same-name.d.ts"]).definitions;
		let as3Class = <as3.ClassDefinition> as3.getDefinitionByName("ClassWithStaticAndMemberPropertyWithSameName", symbols);
		expect(as3Class).not.toBeNull();
		expect(as3Class.properties.length).toBe(2);
		
		let as3PropertyType = <as3.TypeDefinition> as3.getDefinitionByName("String", symbols);
		
		let property = as3Class.properties[0];
		expect(property).not.toBeNull();
		expect(property.name).toBe("property1");
		expect(property.accessLevel).toBe(as3.AccessModifiers[as3.AccessModifiers.public]);
		expect(property.isStatic).toBe(false);
		expect(property.type).toBe(as3PropertyType);
		
		property = as3Class.properties[1];
		expect(property).not.toBeNull();
		expect(property.name).toBe("property1");
		expect(property.accessLevel).toBe(as3.AccessModifiers[as3.AccessModifiers.public]);
		expect(property.isStatic).toBe(true);
		expect(property.type).toBe(as3PropertyType);
	});
	it("may not have a property with the same name as the class", () =>
	{
		let symbols = parser.parse(["spec/fixtures/class-and-property-same-name.d.ts"]).definitions;
		let as3Class = <as3.ClassDefinition> as3.getDefinitionByName("ClassAndPropertyWithSameName", symbols);
		expect(as3Class).not.toBeNull();
		//it should be removed
		expect(as3Class.properties.length).toBe(0);
	});
	it("may not have a method with the same name as the class", () =>
	{
		let symbols = parser.parse(["spec/fixtures/class-and-method-same-name.d.ts"]).definitions;
		let as3Class = <as3.ClassDefinition> as3.getDefinitionByName("ClassAndMethodWithSameName", symbols);
		expect(as3Class).not.toBeNull();
		//it should be removed
		expect(as3Class.methods.length).toBe(0);
	});
	it("may have a static method and a member method with the same name", () =>
	{
		let symbols = parser.parse(["spec/fixtures/class-member-static-method-same-name.d.ts"]).definitions;
		let as3Class = <as3.ClassDefinition> as3.getDefinitionByName("ClassWithStaticAndMemberMethodWithSameName", symbols);
		expect(as3Class).not.toBeNull();
		expect(as3Class.methods.length).toBe(2);
		
		let as3MethodType = <as3.TypeDefinition> as3.getDefinitionByName("String", symbols);
		
		let method = as3Class.methods[0];
		expect(method).not.toBeNull();
		expect(method.name).toBe("method1");
		expect(method.accessLevel).toBe(as3.AccessModifiers[as3.AccessModifiers.public]);
		expect(method.isStatic).toBe(false);
		expect(method.type).toBe(as3MethodType);
		
		method = as3Class.methods[1];
		expect(method).not.toBeNull();
		expect(method.name).toBe("method1");
		expect(method.accessLevel).toBe(as3.AccessModifiers[as3.AccessModifiers.public]);
		expect(method.isStatic).toBe(true);
		expect(method.type).toBe(as3MethodType);
	});
	it("must not expose a member variable that starts with a number", () =>
	{
		let symbols = parser.parse(["spec/fixtures/class-member-variable-starts-with-number.d.ts"]).definitions;
		let as3Class = <as3.ClassDefinition> as3.getDefinitionByName("ClassWithVariable", symbols);
		expect(as3Class).not.toBeNull();
		expect(as3Class.properties.length).toBe(0);
	});
	it("must not expose a member variable named public, private, protected, or internal", () =>
	{
		let symbols = parser.parse(["spec/fixtures/class-member-variable-namespaces.d.ts"]).definitions;
		let as3Class = <as3.ClassDefinition> as3.getDefinitionByName("ClassWithVariable", symbols);
		expect(as3Class).not.toBeNull();
		expect(as3Class.properties.length).toBe(0);
	});
});

describe("An enum", () =>
{
	let parser: TS2ASParser;
	beforeAll(() =>
	{
		parser = new TS2ASParser(ts.ScriptTarget.Latest);
		parser.debugLevel = DebugLevel.WARN;
	});
	it("may have a property", () =>
	{
		let symbols = parser.parse(["spec/fixtures/enum-member.d.ts"]).definitions;
		let as3Class = <as3.ClassDefinition> as3.getDefinitionByName("EnumWithMember", symbols);
		expect(as3Class).not.toBeNull();
		expect(as3Class.properties.length).toBe(3);
		
		let property = as3Class.properties[0];
		expect(property).not.toBeNull();
		expect(property.name).toBe("ONE");
		expect(property.accessLevel).toBe(as3.AccessModifiers[as3.AccessModifiers.public]);
		expect(property.isStatic).toBe(true);
		expect(property.isConstant).toBe(true);
		let as3PropertyType = <as3.TypeDefinition> as3.getDefinitionByName("int", symbols);
		expect(property.type).toBe(as3PropertyType);
		
		property = as3Class.properties[1];
		expect(property).not.toBeNull();
		expect(property.name).toBe("TWO");
		expect(property.accessLevel).toBe(as3.AccessModifiers[as3.AccessModifiers.public]);
		expect(property.isStatic).toBe(true);
		expect(property.isConstant).toBe(true);
		as3PropertyType = <as3.TypeDefinition> as3.getDefinitionByName("int", symbols);
		expect(property.type).toBe(as3PropertyType);
		
		property = as3Class.properties[2];
		expect(property).not.toBeNull();
		expect(property.name).toBe("THREE");
		expect(property.accessLevel).toBe(as3.AccessModifiers[as3.AccessModifiers.public]);
		expect(property.isStatic).toBe(true);
		expect(property.isConstant).toBe(true);
		as3PropertyType = <as3.TypeDefinition> as3.getDefinitionByName("int", symbols);
		expect(property.type).toBe(as3PropertyType);
	});
});

describe("An interface", () =>
{
	let parser: TS2ASParser;
	beforeAll(() =>
	{
		parser = new TS2ASParser(ts.ScriptTarget.Latest);
		parser.debugLevel = DebugLevel.WARN;
	});
	it("may have a property", () =>
	{
		let symbols = parser.parse(["spec/fixtures/interface-member-property.d.ts"]).definitions;
		let as3Interface = <as3.InterfaceDefinition> as3.getDefinitionByName("InterfaceWithProperty", symbols);
		expect(as3Interface).not.toBeNull();
		expect(as3Interface.properties.length).toBe(1);
		let property = as3Interface.properties[0];
		expect(property).not.toBeNull();
		expect(property.name).toBe("property1");
		expect(property.accessLevel).toBeNull();
		expect(property.isStatic).toBe(false);
		let as3PropertyType = <as3.TypeDefinition> as3.getDefinitionByName("String", symbols);
		expect(property.type).toBe(as3PropertyType);
	});
	it("may have a method", () =>
	{
		let symbols = parser.parse(["spec/fixtures/interface-member-method.d.ts"]).definitions;
		let as3Interface = <as3.TypeDefinition> as3.getDefinitionByName("InterfaceWithMethod", symbols);
		expect(as3Interface).not.toBeNull();
		expect(as3Interface.methods.length).toBe(1);
		let method = as3Interface.methods[0];
		expect(method).not.toBeNull();
		expect(method.name).toBe("method1");
		expect(method.accessLevel).toBeNull();
		expect(method.isStatic).toBe(false);
		let as3MethodType = <as3.TypeDefinition> as3.getDefinitionByName("Number", symbols);
		expect(method.type).toBe(as3MethodType);
	});
	it("may extend another interface", () =>
	{
		let symbols = parser.parse(["spec/fixtures/interface-extends-interface.d.ts"]).definitions;
		let as3Interface1 = <as3.ClassDefinition> as3.getDefinitionByName("InterfaceOne", symbols);
		expect(as3Interface1).not.toBeNull();
		let as3Interface2 = <as3.ClassDefinition> as3.getDefinitionByName("InterfaceTwo", symbols);
		expect(as3Interface2).not.toBeNull();
		let interfaces = as3Interface2.interfaces;
		expect(interfaces).not.toBeNull();
		expect(interfaces.length).toBe(1);
		let extendsInterface = interfaces[0];
		expect(extendsInterface).toBe(as3Interface1);
	});
	describe("that extends another interface", () =>
	{
		it("may not override methods", () =>
		{
			let symbols = parser.parse(["spec/fixtures/interface-extends-interface-strip-overloads.d.ts"]).definitions;
			let as3Interface1 = <as3.ClassDefinition> as3.getDefinitionByName("InterfaceOne", symbols);
			expect(as3Interface1).not.toBeNull();
			let as3Interface2 = <as3.ClassDefinition> as3.getDefinitionByName("InterfaceTwo", symbols);
			expect(as3Interface2).not.toBeNull();
			let interfaces = as3Interface2.interfaces;
			expect(as3Interface1.methods.length).toBe(1);
			expect(as3Interface2.methods.length).toBe(0);
		});
	});
});

describe("A function", () =>
{
	let parser: TS2ASParser;
	beforeAll(() =>
	{
		parser = new TS2ASParser(ts.ScriptTarget.Latest);
		parser.debugLevel = DebugLevel.WARN;
	});
	it("may have a parameter", () =>
	{
		let symbols = parser.parse(["spec/fixtures/function-parameter.d.ts"]).definitions;
		let as3Function = <as3.PackageFunctionDefinition> as3.getDefinitionByName("functionWithParameter", symbols);
		expect(as3Function).not.toBeNull();
		expect(as3Function.constructor).toBe(as3.PackageFunctionDefinition);
		expect(as3Function.accessLevel).toBe(as3.AccessModifiers[as3.AccessModifiers.public]);
		expect(as3Function.type).not.toBeNull();
		expect(as3Function.type.getFullyQualifiedName()).toBe(as3.BuiltIns[as3.BuiltIns.void]);
		let params = as3Function.parameters;
		expect(params).not.toBeNull();
		expect(params.length).toBe(1);
		let param1 = params[0];
		expect(param1).not.toBeNull();
		expect(param1.name).toBe("param1");
		expect(param1.type).not.toBeNull();
		expect(param1.type.getFullyQualifiedName()).toBe(as3.BuiltIns[as3.BuiltIns.Number]);
		expect(param1.value).toBeNull();
		expect(param1.isRest).toBe(false);
	});
	it("may have a default parameter", () =>
	{
		let symbols = parser.parse(["spec/fixtures/function-parameter-default.d.ts"]).definitions;
		let as3Function = <as3.PackageFunctionDefinition> as3.getDefinitionByName("functionWithDefaultParameter", symbols);
		expect(as3Function).not.toBeNull();
		expect(as3Function.constructor).toBe(as3.PackageFunctionDefinition);
		expect(as3Function.accessLevel).toBe(as3.AccessModifiers[as3.AccessModifiers.public]);
		expect(as3Function.type).not.toBeNull();
		expect(as3Function.type.getFullyQualifiedName()).toBe(as3.BuiltIns[as3.BuiltIns.void]);
		let params = as3Function.parameters;
		expect(params).not.toBeNull();
		expect(params.length).toBe(1);
		let param1 = params[0];
		expect(param1).not.toBeNull();
		expect(param1.name).toBe("param1");
		expect(param1.type).not.toBeNull();
		expect(param1.type.getFullyQualifiedName()).toBe(as3.BuiltIns[as3.BuiltIns.String]);
		expect(param1.value).toBe("\"hello\"");
		expect(param1.isRest).toBe(false);
	});
	it("may have a rest parameter", () =>
	{
		let symbols = parser.parse(["spec/fixtures/function-parameter-rest.d.ts"]).definitions;
		let as3Function = <as3.PackageFunctionDefinition> as3.getDefinitionByName("functionWithRestParameter", symbols);
		expect(as3Function).not.toBeNull();
		expect(as3Function.constructor).toBe(as3.PackageFunctionDefinition);
		expect(as3Function.accessLevel).toBe(as3.AccessModifiers[as3.AccessModifiers.public]);
		expect(as3Function.type).not.toBeNull();
		expect(as3Function.type.getFullyQualifiedName()).toBe(as3.BuiltIns[as3.BuiltIns.void]);
		let params = as3Function.parameters;
		expect(params).not.toBeNull();
		expect(params.length).toBe(1);
		let param1 = params[0];
		expect(param1).not.toBeNull();
		expect(param1.name).toBe("param1");
		expect(param1.type).not.toBeNull();
		expect(param1.type.getFullyQualifiedName()).toBe(as3.BuiltIns[as3.BuiltIns.Array]);
		expect(param1.value).toBeNull();
		expect(param1.isRest).toBe(true);
	});
	it("may have an optional parameter", () =>
	{
		let symbols = parser.parse(["spec/fixtures/function-parameter-optional.d.ts"]).definitions;
		let as3Function = <as3.PackageFunctionDefinition> as3.getDefinitionByName("functionWithOptionalParameter", symbols);
		expect(as3Function).not.toBeNull();
		expect(as3Function.constructor).toBe(as3.PackageFunctionDefinition);
		expect(as3Function.accessLevel).toBe(as3.AccessModifiers[as3.AccessModifiers.public]);
		expect(as3Function.type).not.toBeNull();
		expect(as3Function.type.getFullyQualifiedName()).toBe(as3.BuiltIns[as3.BuiltIns.void]);
		let params = as3Function.parameters;
		expect(params).not.toBeNull();
		expect(params.length).toBe(1);
		let param1 = params[0];
		expect(param1).not.toBeNull();
		expect(param1.name).toBe("param1");
		expect(param1.type).not.toBeNull();
		expect(param1.type.getFullyQualifiedName()).toBe(as3.BuiltIns[as3.BuiltIns.String]);
		expect(param1.value).toBe("undefined");
		expect(param1.isRest).toBe(false);
	});
	describe("that has overloads", () =>
	{
		it("must type a parameter as Object in ActionScript if the types have no common base type", () =>
		{	
			let symbols = parser.parse(["spec/fixtures/function-overload-incompatible-parameter-type.d.ts"]).definitions;
			let as3Function = <as3.PackageFunctionDefinition> as3.getDefinitionByName("functionWithOverload", symbols);
			expect(as3Function).not.toBeNull();
			expect(as3Function.constructor).toBe(as3.PackageFunctionDefinition);
			expect(as3Function.accessLevel).toBe(as3.AccessModifiers[as3.AccessModifiers.public]);
			expect(as3Function.type).not.toBeNull();
			expect(as3Function.type.getFullyQualifiedName()).toBe(as3.BuiltIns[as3.BuiltIns.void]);
			let params = as3Function.parameters;
			expect(params).not.toBeNull();
			expect(params.length).toBe(1);
			let param1 = params[0];
			expect(param1).not.toBeNull();
			expect(param1.name).toBe("param1");
			expect(param1.type).not.toBeNull();
			expect(param1.type.getFullyQualifiedName()).toBe(as3.BuiltIns[as3.BuiltIns.Object]);
			expect(param1.isRest).toBe(false);
		});
		it("must merge parameter names if they do not match to avoid conflicts with the same name appearing in different places", () =>
		{	
			let symbols = parser.parse(["spec/fixtures/function-overload-merge-parameter-names.d.ts"]).definitions;
			let as3Function = <as3.PackageFunctionDefinition> as3.getDefinitionByName("functionWithOverload", symbols);
			expect(as3Function).not.toBeNull();
			expect(as3Function.constructor).toBe(as3.PackageFunctionDefinition);
			expect(as3Function.accessLevel).toBe(as3.AccessModifiers[as3.AccessModifiers.public]);
			expect(as3Function.type).not.toBeNull();
			expect(as3Function.type.getFullyQualifiedName()).toBe(as3.BuiltIns[as3.BuiltIns.void]);
			let params = as3Function.parameters;
			expect(params).not.toBeNull();
			expect(params.length).toBe(1);
			let param1 = params[0];
			expect(param1).not.toBeNull();
			expect(param1.name).toBe("param1OrParam2");
			expect(param1.type).not.toBeNull();
			expect(param1.type.getFullyQualifiedName()).toBe(as3.BuiltIns[as3.BuiltIns.Object]);
			expect(param1.isRest).toBe(false);
		});
		it("must type a return value as Object in ActionScript if the types have no common base type", () =>
		{
			let symbols = parser.parse(["spec/fixtures/function-overload-incompatible-return-type.d.ts"]).definitions;
			let as3Function = <as3.PackageFunctionDefinition> as3.getDefinitionByName("functionWithOverload", symbols);
			expect(as3Function).not.toBeNull();
			expect(as3Function.constructor).toBe(as3.PackageFunctionDefinition);
			expect(as3Function.accessLevel).toBe(as3.AccessModifiers[as3.AccessModifiers.public]);
			let type = as3Function.type;
			expect(type).not.toBeNull();
			expect(type.getFullyQualifiedName()).toBe(as3.BuiltIns[as3.BuiltIns.Object]);
		});
		it("must merge optional parameters", () =>
		{
			let symbols = parser.parse(["spec/fixtures/function-overload-merge-optional-params.d.ts"]).definitions;
			let as3Function = <as3.PackageFunctionDefinition> as3.getDefinitionByName("functionWithOverload", symbols);
			expect(as3Function).not.toBeNull();
			expect(as3Function.constructor).toBe(as3.PackageFunctionDefinition);
			expect(as3Function.accessLevel).toBe(as3.AccessModifiers[as3.AccessModifiers.public]);
			let params = as3Function.parameters;
			expect(params).not.toBeNull();
			expect(params.length).toBe(3);
			let param1 = params[0];
			expect(param1).not.toBeNull();
			expect(param1.name).toBe("param1");
			expect(param1.type).not.toBeNull();
			expect(param1.type.getFullyQualifiedName()).toBe(as3.BuiltIns[as3.BuiltIns.String]);
			expect(param1.isRest).toBe(false);
			expect(param1.value).toBeNull();
			let param2 = params[1];
			expect(param2).not.toBeNull();
			expect(param2.name).toBe("param2");
			expect(param2.type).not.toBeNull();
			expect(param2.type.getFullyQualifiedName()).toBe(as3.BuiltIns[as3.BuiltIns.Number]);
			expect(param2.isRest).toBe(false);
			expect(param2.value).toBe("undefined");
			let param3 = params[2];
			expect(param3).not.toBeNull();
			expect(param3.name).toBe("param3");
			expect(param3.type).not.toBeNull();
			expect(param3.type.getFullyQualifiedName()).toBe(as3.BuiltIns[as3.BuiltIns.Boolean]);
			expect(param3.isRest).toBe(false);
			expect(param3.value).toBe("undefined");
		});
		it("must make non-optional parameters optional when overload has more parameters", () =>
		{
			let symbols = parser.parse(["spec/fixtures/function-overload-make-optional-more-parameters.d.ts"]).definitions;
			let as3Function = <as3.PackageFunctionDefinition> as3.getDefinitionByName("functionWithOverload", symbols);
			expect(as3Function).not.toBeNull();
			expect(as3Function.constructor).toBe(as3.PackageFunctionDefinition);
			expect(as3Function.accessLevel).toBe(as3.AccessModifiers[as3.AccessModifiers.public]);
			let params = as3Function.parameters;
			expect(params).not.toBeNull();
			expect(params.length).toBe(3);
			let param1 = params[0];
			expect(param1).not.toBeNull();
			expect(param1.name).toBe("param1");
			expect(param1.type).not.toBeNull();
			expect(param1.type.getFullyQualifiedName()).toBe(as3.BuiltIns[as3.BuiltIns.String]);
			expect(param1.isRest).toBe(false);
			expect(param1.value).toBeNull();
			let param2 = params[1];
			expect(param2).not.toBeNull();
			expect(param2.name).toBe("param2");
			expect(param2.type).not.toBeNull();
			expect(param2.type.getFullyQualifiedName()).toBe(as3.BuiltIns[as3.BuiltIns.Number]);
			expect(param2.isRest).toBe(false);
			expect(param2.value).toBe("undefined");
			let param3 = params[2];
			expect(param3).not.toBeNull();
			expect(param3.name).toBe("param3");
			expect(param3.type).not.toBeNull();
			expect(param3.type.getFullyQualifiedName()).toBe(as3.BuiltIns[as3.BuiltIns.Boolean]);
			expect(param3.isRest).toBe(false);
			expect(param3.value).toBe("undefined");
		});
		it("must make non-optional parameters optional when overload has fewer parameters", () =>
		{
			let symbols = parser.parse(["spec/fixtures/function-overload-make-optional-fewer-parameters.d.ts"]).definitions;
			let as3Function = <as3.PackageFunctionDefinition> as3.getDefinitionByName("functionWithOverload", symbols);
			expect(as3Function).not.toBeNull();
			expect(as3Function.constructor).toBe(as3.PackageFunctionDefinition);
			expect(as3Function.accessLevel).toBe(as3.AccessModifiers[as3.AccessModifiers.public]);
			let params = as3Function.parameters;
			expect(params).not.toBeNull();
			expect(params.length).toBe(3);
			let param1 = params[0];
			expect(param1).not.toBeNull();
			expect(param1.name).toBe("param1");
			expect(param1.type).not.toBeNull();
			expect(param1.type.getFullyQualifiedName()).toBe(as3.BuiltIns[as3.BuiltIns.String]);
			expect(param1.isRest).toBe(false);
			expect(param1.value).toBeNull();
			let param2 = params[1];
			expect(param2).not.toBeNull();
			expect(param2.name).toBe("param2");
			expect(param2.type).not.toBeNull();
			expect(param2.type.getFullyQualifiedName()).toBe(as3.BuiltIns[as3.BuiltIns.Number]);
			expect(param2.isRest).toBe(false);
			expect(param2.value).toBe("undefined");
			let param3 = params[2];
			expect(param3).not.toBeNull();
			expect(param3.name).toBe("param3");
			expect(param3.type).not.toBeNull();
			expect(param3.type.getFullyQualifiedName()).toBe(as3.BuiltIns[as3.BuiltIns.Boolean]);
			expect(param3.isRest).toBe(false);
			expect(param3.value).toBe("undefined");
		});
		it("must merge rest parameters", () =>
		{
			let symbols = parser.parse(["spec/fixtures/function-overload-merge-rest-params.d.ts"]).definitions;
			let as3Function = <as3.PackageFunctionDefinition> as3.getDefinitionByName("functionWithOverload", symbols);
			expect(as3Function).not.toBeNull();
			expect(as3Function.constructor).toBe(as3.PackageFunctionDefinition);
			expect(as3Function.accessLevel).toBe(as3.AccessModifiers[as3.AccessModifiers.public]);
			let params = as3Function.parameters;
			expect(params).not.toBeNull();
			expect(params.length).toBe(2);
			let param1 = params[0];
			expect(param1).not.toBeNull();
			expect(param1.name).toBe("param1");
			expect(param1.type).not.toBeNull();
			expect(param1.type.getFullyQualifiedName()).toBe(as3.BuiltIns[as3.BuiltIns.String]);
			expect(param1.isRest).toBe(false);
			expect(param1.value).toBeNull();
			let param2 = params[1];
			expect(param2).not.toBeNull();
			expect(param2.name).toBe("rest");
			expect(param2.type).not.toBeNull();
			expect(param2.type.getFullyQualifiedName()).toBe(as3.BuiltIns[as3.BuiltIns.Array]);
			expect(param2.isRest).toBe(true);
			expect(param2.value).toBeNull();
		});
	});
	it("may have a return value", () =>
	{
		let symbols = parser.parse(["spec/fixtures/function-return.d.ts"]).definitions;
		let as3Function = <as3.PackageFunctionDefinition> as3.getDefinitionByName("functionWithReturn", symbols);
		expect(as3Function).not.toBeNull();
		expect(as3Function.constructor).toBe(as3.PackageFunctionDefinition);
		expect(as3Function.accessLevel).toBe(as3.AccessModifiers[as3.AccessModifiers.public]);
		expect(as3Function.type).not.toBeNull();
		expect(as3Function.type.getFullyQualifiedName()).toBe(as3.BuiltIns[as3.BuiltIns.Number]);
		let params = as3Function.parameters;
		expect(params).not.toBeNull();
		expect(params.length).toBe(0);
	});
	it("may have multiple parameters", () =>
	{
		let symbols = parser.parse(["spec/fixtures/function-multiple-parameters.d.ts"]).definitions;
		let as3Function = <as3.PackageFunctionDefinition> as3.getDefinitionByName("functionWithMultipleParameters", symbols);
		expect(as3Function).not.toBeNull();
		expect(as3Function.constructor).toBe(as3.PackageFunctionDefinition);
		expect(as3Function.accessLevel).toBe(as3.AccessModifiers[as3.AccessModifiers.public]);
		expect(as3Function.type).not.toBeNull();
		expect(as3Function.type.getFullyQualifiedName()).toBe(as3.BuiltIns[as3.BuiltIns.void]);
		let params = as3Function.parameters;
		expect(params).not.toBeNull();
		expect(params.length).toBe(5);
		
		let param1 = params[0];
		expect(param1).not.toBeNull();
		expect(param1.name).toBe("param1");
		expect(param1.type).not.toBeNull();
		expect(param1.type.getFullyQualifiedName()).toBe(as3.BuiltIns[as3.BuiltIns.Number]);
		expect(param1.value).toBeNull();
		expect(param1.isRest).toBe(false);
		
		let param2 = params[1];
		expect(param2).not.toBeNull();
		expect(param2.name).toBe("param2");
		expect(param2.type).not.toBeNull();
		expect(param2.type.getFullyQualifiedName()).toBe(as3.BuiltIns[as3.BuiltIns.String]);
		expect(param2.value).toBeNull();
		expect(param2.isRest).toBe(false);
		
		let param3 = params[2];
		expect(param3).not.toBeNull();
		expect(param3.name).toBe("param3");
		expect(param3.type).not.toBeNull();
		expect(param3.type.getFullyQualifiedName()).toBe(as3.BuiltIns[as3.BuiltIns.Boolean]);
		expect(param3.value).toBe("false");
		expect(param3.isRest).toBe(false);
		
		let param4 = params[3];
		expect(param4).not.toBeNull();
		expect(param4.name).toBe("param4");
		expect(param4.type).not.toBeNull();
		expect(param4.type.getFullyQualifiedName()).toBe(as3.BuiltIns[as3.BuiltIns.Object]);
		expect(param4.value).toBe("undefined");
		expect(param4.isRest).toBe(false);
		
		let param5 = params[4];
		expect(param5).not.toBeNull();
		expect(param5.name).toBe("param5");
		expect(param5.type).not.toBeNull();
		expect(param5.type.getFullyQualifiedName()).toBe(as3.BuiltIns[as3.BuiltIns.Array]);
		expect(param5.value).toBeNull();
		expect(param5.isRest).toBe(true);
	});
	it("may have a type parameter", () =>
	{
		let symbols = parser.parse(["spec/fixtures/function-type-parameter.d.ts"]).definitions;
		let as3Function = <as3.PackageFunctionDefinition> as3.getDefinitionByName("functionWithTypeParameter", symbols);
		expect(as3Function).not.toBeNull();
		expect(as3Function.constructor).toBe(as3.PackageFunctionDefinition);
		expect(as3Function.accessLevel).toBe(as3.AccessModifiers[as3.AccessModifiers.public]);
		expect(as3Function.type).not.toBeNull();
		expect(as3Function.type.getFullyQualifiedName()).toBe(as3.BuiltIns[as3.BuiltIns.void]);
		let params = as3Function.parameters;
		expect(params).not.toBeNull();
		expect(params.length).toBe(1);
		let param1 = params[0];
		expect(param1).not.toBeNull();
		expect(param1.name).toBe("param1");
		expect(param1.type).not.toBeNull();
		expect(param1.type.getFullyQualifiedName()).toBe(as3.BuiltIns[as3.BuiltIns.Object]);
		expect(param1.value).toBeNull();
		expect(param1.isRest).toBe(false);
	});
});

describe("A variable", () =>
{
	let parser: TS2ASParser;
	beforeAll(() =>
	{
		parser = new TS2ASParser(ts.ScriptTarget.Latest);
		parser.debugLevel = DebugLevel.WARN;
	});
	describe("in a namespace", () =>
	{
		it("may omit a type and be typed with initializer", () =>
		{
			let symbols = parser.parse(["spec/fixtures/variable-initializer-instead-of-type.d.ts"]).definitions;
			let as3Variable = <as3.PackageVariableDefinition> as3.getDefinitionByName("NamespaceWithInitializerVar.initializerVar", symbols);
			expect(as3Variable).not.toBeNull();
			expect(as3Variable.constructor).toBe(as3.PackageVariableDefinition);
			expect(as3Variable.accessLevel).toBe(as3.AccessModifiers[as3.AccessModifiers.public]);
			let as3Type = as3Variable.type;
			expect(as3Type).not.toBeNull();
			expect(as3Type.getFullyQualifiedName()).toBe(as3.BuiltIns[as3.BuiltIns.String]);
		});
	});
	describe("when typed as a union type in TypeScript", () =>
	{
		it("is typed as Object in ActionScript", () =>
		{
			let symbols = parser.parse(["spec/fixtures/variable-union-type.d.ts"]).definitions;
			let as3Variable = <as3.PackageVariableDefinition> as3.getDefinitionByName("unionType", symbols);
			expect(as3Variable).not.toBeNull();
			expect(as3Variable.constructor).toBe(as3.PackageVariableDefinition);
			expect(as3Variable.accessLevel).toBe(as3.AccessModifiers[as3.AccessModifiers.public]);
			let as3Type = as3Variable.type;
			expect(as3Type).not.toBeNull();
			expect(as3Type.getFullyQualifiedName()).toBe(as3.BuiltIns[as3.BuiltIns.Object]);
		});
	});
	describe("when typed as an intersection type in TypeScript", () =>
	{
		it("is typed as Object in ActionScript", () =>
		{
			let symbols = parser.parse(["spec/fixtures/variable-intersection-type.d.ts"]).definitions;
			let as3Variable = <as3.PackageVariableDefinition> as3.getDefinitionByName("intersectionType", symbols);
			expect(as3Variable).not.toBeNull();
			expect(as3Variable.constructor).toBe(as3.PackageVariableDefinition);
			expect(as3Variable.accessLevel).toBe(as3.AccessModifiers[as3.AccessModifiers.public]);
			let as3Type = as3Variable.type;
			expect(as3Type).not.toBeNull();
			expect(as3Type.getFullyQualifiedName()).toBe(as3.BuiltIns[as3.BuiltIns.Object]);
		});
	});
	describe("when typed with keyof type in TypeScript", () =>
	{
		it("is typed as string in ActionScript", () =>
		{
			let symbols = parser.parse(["spec/fixtures/variable-keyof-type.d.ts"]).definitions;
			let as3Variable = <as3.PackageVariableDefinition> as3.getDefinitionByName("keyOfType", symbols);
			expect(as3Variable).not.toBeNull();
			expect(as3Variable.constructor).toBe(as3.PackageVariableDefinition);
			expect(as3Variable.accessLevel).toBe(as3.AccessModifiers[as3.AccessModifiers.public]);
			let as3Type = as3Variable.type;
			expect(as3Type).not.toBeNull();
			expect(as3Type.getFullyQualifiedName()).toBe(as3.BuiltIns[as3.BuiltIns.String]);
		});
	});
	describe("when typed as the any type in TypeScript", () =>
	{
		it("is typed as Object in ActionScript", () =>
		{
			let symbols = parser.parse(["spec/fixtures/variable-primitives.d.ts"]).definitions;
			let as3Variable = <as3.PackageVariableDefinition> as3.getDefinitionByName("anyPrimitive", symbols);
			expect(as3Variable).not.toBeNull();
			expect(as3Variable.constructor).toBe(as3.PackageVariableDefinition);
			expect(as3Variable.accessLevel).toBe(as3.AccessModifiers[as3.AccessModifiers.public]);
			let as3Type = as3Variable.type;
			expect(as3Type).not.toBeNull();
			expect(as3Type.getFullyQualifiedName()).toBe(as3.BuiltIns[as3.BuiltIns.Object]);
		});
	});
	describe("when typed as the boolean type in TypeScript", () =>
	{
		it("is typed as Boolean in ActionScript", () =>
		{
			let symbols = parser.parse(["spec/fixtures/variable-primitives.d.ts"]).definitions;
			let as3Variable = <as3.PackageVariableDefinition> as3.getDefinitionByName("booleanPrimitive", symbols);
			expect(as3Variable).not.toBeNull();
			expect(as3Variable.constructor).toBe(as3.PackageVariableDefinition);
			expect(as3Variable.accessLevel).toBe(as3.AccessModifiers[as3.AccessModifiers.public]);
			let as3Type = as3Variable.type;
			expect(as3Type).not.toBeNull();
			expect(as3Type.getFullyQualifiedName()).toBe(as3.BuiltIns[as3.BuiltIns.Boolean]);
		});
	});
	describe("when typed as the number type in TypeScript", () =>
	{
		it("is typed as Number in ActionScript", () =>
		{
			let symbols = parser.parse(["spec/fixtures/variable-primitives.d.ts"]).definitions;
			let as3Variable = <as3.PackageVariableDefinition> as3.getDefinitionByName("numberPrimitive", symbols);
			expect(as3Variable).not.toBeNull();
			expect(as3Variable.constructor).toBe(as3.PackageVariableDefinition);
			expect(as3Variable.accessLevel).toBe(as3.AccessModifiers[as3.AccessModifiers.public]);
			let as3Type = as3Variable.type;
			expect(as3Type).not.toBeNull();
			expect(as3Type.getFullyQualifiedName()).toBe(as3.BuiltIns[as3.BuiltIns.Number]);
		});
	});
	describe("when typed as the string type in TypeScript", () =>
	{
		it("is typed as String in ActionScript", () =>
		{
			let symbols = parser.parse(["spec/fixtures/variable-primitives.d.ts"]).definitions;
			let as3Variable = <as3.PackageVariableDefinition> as3.getDefinitionByName("stringPrimitive", symbols);
			expect(as3Variable).not.toBeNull();
			expect(as3Variable.constructor).toBe(as3.PackageVariableDefinition);
			expect(as3Variable.accessLevel).toBe(as3.AccessModifiers[as3.AccessModifiers.public]);
			let as3Type = as3Variable.type;
			expect(as3Type).not.toBeNull();
			expect(as3Type.getFullyQualifiedName()).toBe(as3.BuiltIns[as3.BuiltIns.String]);
		});
	});
	describe("when typed as the symbol type in TypeScript", () =>
	{
		it("is typed as Symbol in ActionScript", () =>
		{
			let symbols = parser.parse(["spec/fixtures/variable-primitives.d.ts"]).definitions;
			let as3Variable = <as3.PackageVariableDefinition> as3.getDefinitionByName("symbolPrimitive", symbols);
			expect(as3Variable).not.toBeNull();
			expect(as3Variable.constructor).toBe(as3.PackageVariableDefinition);
			expect(as3Variable.accessLevel).toBe(as3.AccessModifiers[as3.AccessModifiers.public]);
			let as3Type = as3Variable.type;
			expect(as3Type).not.toBeNull();
			expect(as3Type.getFullyQualifiedName()).toBe("Symbol");
		});
	});
	describe("when typed as the null type in TypeScript", () =>
	{
		it("is typed as Object in ActionScript", () =>
		{
			let symbols = parser.parse(["spec/fixtures/variable-primitives.d.ts"]).definitions;
			let as3Variable = <as3.PackageVariableDefinition> as3.getDefinitionByName("nullPrimitive", symbols);
			expect(as3Variable).not.toBeNull();
			expect(as3Variable.constructor).toBe(as3.PackageVariableDefinition);
			expect(as3Variable.accessLevel).toBe(as3.AccessModifiers[as3.AccessModifiers.public]);
			let as3Type = as3Variable.type;
			expect(as3Type).not.toBeNull();
			expect(as3Type.getFullyQualifiedName()).toBe(as3.BuiltIns[as3.BuiltIns.Object]);
		});
	});
	describe("when typed as the undefined type in TypeScript", () =>
	{
		it("is typed as * in ActionScript", () =>
		{
			let symbols = parser.parse(["spec/fixtures/variable-primitives.d.ts"]).definitions;
			let as3Variable = <as3.PackageVariableDefinition> as3.getDefinitionByName("undefinedPrimitive", symbols);
			expect(as3Variable).not.toBeNull();
			expect(as3Variable.constructor).toBe(as3.PackageVariableDefinition);
			expect(as3Variable.accessLevel).toBe(as3.AccessModifiers[as3.AccessModifiers.public]);
			let as3Type = as3Variable.type;
			expect(as3Type).not.toBeNull();
			expect(as3Type.getFullyQualifiedName()).toBe("*");
		});
	});
	describe("when typed as the never type in TypeScript", () =>
	{
		it("is typed as * in ActionScript", () =>
		{
			let symbols = parser.parse(["spec/fixtures/variable-primitives.d.ts"]).definitions;
			let as3Variable = <as3.PackageVariableDefinition> as3.getDefinitionByName("neverPrimitive", symbols);
			expect(as3Variable).not.toBeNull();
			expect(as3Variable.constructor).toBe(as3.PackageVariableDefinition);
			expect(as3Variable.accessLevel).toBe(as3.AccessModifiers[as3.AccessModifiers.public]);
			let as3Type = as3Variable.type;
			expect(as3Type).not.toBeNull();
			expect(as3Type.getFullyQualifiedName()).toBe("*");
		});
	});
	describe("when typed as the string[] type in TypeScript", () =>
	{
		it("is typed as Array in ActionScript", () =>
		{
			let symbols = parser.parse(["spec/fixtures/variable-primitives.d.ts"]).definitions;
			let as3Variable = <as3.PackageVariableDefinition> as3.getDefinitionByName("arrayPrimitiveAdjacentBrackets", symbols);
			expect(as3Variable).not.toBeNull();
			expect(as3Variable.constructor).toBe(as3.PackageVariableDefinition);
			expect(as3Variable.accessLevel).toBe(as3.AccessModifiers[as3.AccessModifiers.public]);
			let as3Type = as3Variable.type;
			expect(as3Type).not.toBeNull();
			expect(as3Type.getFullyQualifiedName()).toBe(as3.BuiltIns[as3.BuiltIns.Array]);
		});
	});
	describe("when typed as the Array.<string> type in TypeScript", () =>
	{
		it("is typed as Array in ActionScript", () =>
		{
			let symbols = parser.parse(["spec/fixtures/variable-primitives.d.ts"]).definitions;
			let as3Variable = <as3.PackageVariableDefinition> as3.getDefinitionByName("arrayPrimitiveGeneric", symbols);
			expect(as3Variable).not.toBeNull();
			expect(as3Variable.constructor).toBe(as3.PackageVariableDefinition);
			expect(as3Variable.accessLevel).toBe(as3.AccessModifiers[as3.AccessModifiers.public]);
			let as3Type = as3Variable.type;
			expect(as3Type).not.toBeNull();
			expect(as3Type.getFullyQualifiedName()).toBe(as3.BuiltIns[as3.BuiltIns.Array]);
		});
	});
	describe("when typed as the [string] type in TypeScript", () =>
	{
		it("is typed as Array in ActionScript", () =>
		{
			let symbols = parser.parse(["spec/fixtures/variable-primitives.d.ts"]).definitions;
			let as3Variable = <as3.PackageVariableDefinition> as3.getDefinitionByName("arrayPrimitiveSplitBrackets", symbols);
			expect(as3Variable).not.toBeNull();
			expect(as3Variable.constructor).toBe(as3.PackageVariableDefinition);
			expect(as3Variable.accessLevel).toBe(as3.AccessModifiers[as3.AccessModifiers.public]);
			let as3Type = as3Variable.type;
			expect(as3Type).not.toBeNull();
			expect(as3Type.getFullyQualifiedName()).toBe(as3.BuiltIns[as3.BuiltIns.Array]);
		});
	});
	describe("when typed as the true type in TypeScript", () =>
	{
		it("is typed as Boolean in ActionScript", () =>
		{
			let symbols = parser.parse(["spec/fixtures/variable-literal-types.d.ts"]).definitions;
			let as3Variable = <as3.PackageVariableDefinition> as3.getDefinitionByName("variableTrueLiteral", symbols);
			expect(as3Variable).not.toBeNull();
			expect(as3Variable.constructor).toBe(as3.PackageVariableDefinition);
			expect(as3Variable.accessLevel).toBe(as3.AccessModifiers[as3.AccessModifiers.public]);
			let as3Type = as3Variable.type;
			expect(as3Type).not.toBeNull();
			expect(as3Type.getFullyQualifiedName()).toBe(as3.BuiltIns[as3.BuiltIns.Boolean]);
		});
	});
	describe("when typed as the false type in TypeScript", () =>
	{
		it("is typed as Boolean in ActionScript", () =>
		{
			let symbols = parser.parse(["spec/fixtures/variable-literal-types.d.ts"]).definitions;
			let as3Variable = <as3.PackageVariableDefinition> as3.getDefinitionByName("variableFalseLiteral", symbols);
			expect(as3Variable).not.toBeNull();
			expect(as3Variable.constructor).toBe(as3.PackageVariableDefinition);
			expect(as3Variable.accessLevel).toBe(as3.AccessModifiers[as3.AccessModifiers.public]);
			let as3Type = as3Variable.type;
			expect(as3Type).not.toBeNull();
			expect(as3Type.getFullyQualifiedName()).toBe(as3.BuiltIns[as3.BuiltIns.Boolean]);
		});
	});
	describe("when typed as a numeric literal type in TypeScript", () =>
	{
		it("is typed as Number in ActionScript", () =>
		{
			let symbols = parser.parse(["spec/fixtures/variable-literal-types.d.ts"]).definitions;
			let as3Variable = <as3.PackageVariableDefinition> as3.getDefinitionByName("variableNumberLiteral", symbols);
			expect(as3Variable).not.toBeNull();
			expect(as3Variable.constructor).toBe(as3.PackageVariableDefinition);
			expect(as3Variable.accessLevel).toBe(as3.AccessModifiers[as3.AccessModifiers.public]);
			let as3Type = as3Variable.type;
			expect(as3Type).not.toBeNull();
			expect(as3Type.getFullyQualifiedName()).toBe(as3.BuiltIns[as3.BuiltIns.Number]);
		});
	});
	describe("when typed as a negative numeric literal type in TypeScript", () =>
	{
		it("is typed as Number in ActionScript", () =>
		{
			let symbols = parser.parse(["spec/fixtures/variable-literal-types.d.ts"]).definitions;
			let as3Variable = <as3.PackageVariableDefinition> as3.getDefinitionByName("variableNegativeNumberLiteral", symbols);
			expect(as3Variable).not.toBeNull();
			expect(as3Variable.constructor).toBe(as3.PackageVariableDefinition);
			expect(as3Variable.accessLevel).toBe(as3.AccessModifiers[as3.AccessModifiers.public]);
			let as3Type = as3Variable.type;
			expect(as3Type).not.toBeNull();
			expect(as3Type.getFullyQualifiedName()).toBe(as3.BuiltIns[as3.BuiltIns.Number]);
		});
	});
	describe("when typed as a string literal type in TypeScript", () =>
	{
		it("is typed as String in ActionScript", () =>
		{
			let symbols = parser.parse(["spec/fixtures/variable-literal-types.d.ts"]).definitions;
			let as3Variable = <as3.PackageVariableDefinition> as3.getDefinitionByName("variableStringLiteral", symbols);
			expect(as3Variable).not.toBeNull();
			expect(as3Variable.constructor).toBe(as3.PackageVariableDefinition);
			expect(as3Variable.accessLevel).toBe(as3.AccessModifiers[as3.AccessModifiers.public]);
			let as3Type = as3Variable.type;
			expect(as3Type).not.toBeNull();
			expect(as3Type.getFullyQualifiedName()).toBe(as3.BuiltIns[as3.BuiltIns.String]);
		});
	});
	describe("when typed as a object literal type in TypeScript", () =>
	{
		it("is typed as Object in ActionScript", () =>
		{
			let symbols = parser.parse(["spec/fixtures/variable-literal-types.d.ts"]).definitions;
			let as3Variable = <as3.PackageVariableDefinition> as3.getDefinitionByName("variableObjectLiteral", symbols);
			expect(as3Variable).not.toBeNull();
			expect(as3Variable.constructor).toBe(as3.PackageVariableDefinition);
			expect(as3Variable.accessLevel).toBe(as3.AccessModifiers[as3.AccessModifiers.public]);
			let as3Type = as3Variable.type;
			expect(as3Type).not.toBeNull();
			expect(as3Type.getFullyQualifiedName()).toBe(as3.BuiltIns[as3.BuiltIns.Object]);
		});
	});
});

describe("A method", () =>
{
	let parser: TS2ASParser;
	beforeAll(() =>
	{
		parser = new TS2ASParser(ts.ScriptTarget.Latest);
		parser.debugLevel = DebugLevel.WARN;
	});
	it("may have a parameter", () =>
	{
		let symbols = parser.parse(["spec/fixtures/method-parameter.d.ts"]).definitions;
		let as3Class = <as3.ClassDefinition> as3.getDefinitionByName("MethodWithParameter", symbols);
		expect(as3Class).not.toBeNull();
		expect(as3Class.constructor).toBe(as3.ClassDefinition);
		expect(as3Class.accessLevel).toBe(as3.AccessModifiers[as3.AccessModifiers.public]);
		let methods = as3Class.methods;
		expect(methods.length).toBe(1);
		let method = methods[0];
		expect(method).not.toBeNull();
		expect(method.name).toBe("method1");
		expect(method.accessLevel).toBe(as3.AccessModifiers[as3.AccessModifiers.public]);
		expect(method.isStatic).toBe(false);
		expect(method.type.getFullyQualifiedName()).toBe(as3.BuiltIns[as3.BuiltIns.void]);
		let params = method.parameters;
		expect(params).not.toBeNull();
		expect(params.length).toBe(1);
		let param1 = params[0];
		expect(param1).not.toBeNull();
		expect(param1.name).toBe("param1");
		expect(param1.type).not.toBeNull();
		expect(param1.type.getFullyQualifiedName()).toBe(as3.BuiltIns[as3.BuiltIns.Number]);
		expect(param1.value).toBeNull();
		expect(param1.isRest).toBe(false);
	});
	it("may have a default parameter", () =>
	{
		let symbols = parser.parse(["spec/fixtures/method-parameter-default.d.ts"]).definitions;
		let as3Class = <as3.ClassDefinition> as3.getDefinitionByName("MethodWithDefaultParameter", symbols);
		expect(as3Class).not.toBeNull();
		expect(as3Class.constructor).toBe(as3.ClassDefinition);
		expect(as3Class.accessLevel).toBe(as3.AccessModifiers[as3.AccessModifiers.public]);
		let methods = as3Class.methods;
		expect(methods.length).toBe(1);
		let method = methods[0];
		expect(method).not.toBeNull();
		expect(method.name).toBe("method1");
		expect(method.accessLevel).toBe(as3.AccessModifiers[as3.AccessModifiers.public]);
		expect(method.isStatic).toBe(false);
		expect(method.type.getFullyQualifiedName()).toBe(as3.BuiltIns[as3.BuiltIns.void]);
		let params = method.parameters;
		expect(params).not.toBeNull();
		expect(params.length).toBe(1);
		let param1 = params[0];
		expect(param1).not.toBeNull();
		expect(param1.name).toBe("param1");
		expect(param1.type).not.toBeNull();
		expect(param1.type.getFullyQualifiedName()).toBe(as3.BuiltIns[as3.BuiltIns.String]);
		expect(param1.value).toBe("\"hello\"");
		expect(param1.isRest).toBe(false);
	});
	it("may have a rest parameter", () =>
	{
		let symbols = parser.parse(["spec/fixtures/method-parameter-rest.d.ts"]).definitions;
		let as3Class = <as3.ClassDefinition> as3.getDefinitionByName("MethodWithRestParameter", symbols);
		expect(as3Class).not.toBeNull();
		expect(as3Class.constructor).toBe(as3.ClassDefinition);
		expect(as3Class.accessLevel).toBe(as3.AccessModifiers[as3.AccessModifiers.public]);
		let methods = as3Class.methods;
		expect(methods.length).toBe(1);
		let method = methods[0];
		expect(method).not.toBeNull();
		expect(method.name).toBe("method1");
		expect(method.accessLevel).toBe(as3.AccessModifiers[as3.AccessModifiers.public]);
		expect(method.isStatic).toBe(false);
		expect(method.type.getFullyQualifiedName()).toBe(as3.BuiltIns[as3.BuiltIns.void]);
		let params = method.parameters;
		expect(params).not.toBeNull();
		expect(params.length).toBe(1);
		let param1 = params[0];
		expect(param1).not.toBeNull();
		expect(param1.name).toBe("param1");
		expect(param1.type).not.toBeNull();
		expect(param1.type.getFullyQualifiedName()).toBe(as3.BuiltIns[as3.BuiltIns.Array]);
		expect(param1.value).toBeNull();
		expect(param1.isRest).toBe(true);
	});
	it("may have an optional parameter", () =>
	{
		let symbols = parser.parse(["spec/fixtures/method-parameter-optional.d.ts"]).definitions;
		let as3Class = <as3.ClassDefinition> as3.getDefinitionByName("MethodWithOptionalParameter", symbols);
		expect(as3Class).not.toBeNull();
		expect(as3Class.constructor).toBe(as3.ClassDefinition);
		expect(as3Class.accessLevel).toBe(as3.AccessModifiers[as3.AccessModifiers.public]);
		let methods = as3Class.methods;
		expect(methods.length).toBe(1);
		let method = methods[0];
		expect(method).not.toBeNull();
		expect(method.name).toBe("method1");
		expect(method.accessLevel).toBe(as3.AccessModifiers[as3.AccessModifiers.public]);
		expect(method.isStatic).toBe(false);
		expect(method.type.getFullyQualifiedName()).toBe(as3.BuiltIns[as3.BuiltIns.void]);
		let params = method.parameters;
		expect(params).not.toBeNull();
		expect(params.length).toBe(1);
		let param1 = params[0];
		expect(param1).not.toBeNull();
		expect(param1.name).toBe("param1");
		expect(param1.type).not.toBeNull();
		expect(param1.type.getFullyQualifiedName()).toBe(as3.BuiltIns[as3.BuiltIns.String]);
		expect(param1.value).toBe("undefined");
		expect(param1.isRest).toBe(false);
	});
	describe("that has overloads", () =>
	{
		it("must type a parameter as Object in ActionScript if the types have no common base type", () =>
		{
			let symbols = parser.parse(["spec/fixtures/method-overload-incompatible-parameter-type.d.ts"]).definitions;
			let as3Class = <as3.ClassDefinition> as3.getDefinitionByName("MethodOverload", symbols);
			expect(as3Class).not.toBeNull();
			expect(as3Class.constructor).toBe(as3.ClassDefinition);
			expect(as3Class.accessLevel).toBe(as3.AccessModifiers[as3.AccessModifiers.public]);
			let methods = as3Class.methods;
			expect(methods.length).toBe(1);
			let method = methods[0];
			expect(method).not.toBeNull();
			expect(method.name).toBe("method1");
			expect(method.accessLevel).toBe(as3.AccessModifiers[as3.AccessModifiers.public]);
			expect(method.isStatic).toBe(false);
			expect(method.type.getFullyQualifiedName()).toBe(as3.BuiltIns[as3.BuiltIns.void]);
			let params = method.parameters;
			expect(params).not.toBeNull();
			expect(params.length).toBe(1);
			let param1 = params[0];
			expect(param1).not.toBeNull();
			expect(param1.name).toBe("param1");
			expect(param1.type).not.toBeNull();
			expect(param1.type.getFullyQualifiedName()).toBe(as3.BuiltIns[as3.BuiltIns.Object]);
			expect(param1.value).toBeNull();
			expect(param1.isRest).toBe(false);
		});
		it("must type a return value as Object in ActionScript if the types have no common base type", () =>
		{
			let symbols = parser.parse(["spec/fixtures/method-overload-incompatible-return-type.d.ts"]).definitions;
			let as3Class = <as3.ClassDefinition> as3.getDefinitionByName("MethodOverload", symbols);
			expect(as3Class).not.toBeNull();
			expect(as3Class.constructor).toBe(as3.ClassDefinition);
			expect(as3Class.accessLevel).toBe(as3.AccessModifiers[as3.AccessModifiers.public]);
			let methods = as3Class.methods;
			expect(methods.length).toBe(1);
			let method = methods[0];
			expect(method).not.toBeNull();
			expect(method.name).toBe("method1");
			expect(method.accessLevel).toBe(as3.AccessModifiers[as3.AccessModifiers.public]);
			expect(method.isStatic).toBe(false);
			let type = method.type;
			expect(type).not.toBeNull();
			expect(type.getFullyQualifiedName()).toBe(as3.BuiltIns[as3.BuiltIns.Object]);
		});
	});
	it("may have a return value", () =>
	{
		let symbols = parser.parse(["spec/fixtures/method-return.d.ts"]).definitions;
		let as3Class = <as3.ClassDefinition> as3.getDefinitionByName("MethodWithReturn", symbols);
		expect(as3Class).not.toBeNull();
		expect(as3Class.constructor).toBe(as3.ClassDefinition);
		expect(as3Class.accessLevel).toBe(as3.AccessModifiers[as3.AccessModifiers.public]);
		let methods = as3Class.methods;
		expect(methods.length).toBe(1);
		let method = methods[0];
		expect(method).not.toBeNull();
		expect(method.name).toBe("method1");
		expect(method.accessLevel).toBe(as3.AccessModifiers[as3.AccessModifiers.public]);
		expect(method.isStatic).toBe(false);
		expect(method.type).not.toBeNull();
		expect(method.type.getFullyQualifiedName()).toBe(as3.BuiltIns[as3.BuiltIns.Number]);
		let params = method.parameters;
		expect(params).not.toBeNull();
		expect(params.length).toBe(0);
	});
	it("may have multiple parameters", () =>
	{
		let symbols = parser.parse(["spec/fixtures/method-multiple-parameters.d.ts"]).definitions;
		let as3Class = <as3.ClassDefinition> as3.getDefinitionByName("MethodWithMultipleParameters", symbols);
		expect(as3Class).not.toBeNull();
		expect(as3Class.constructor).toBe(as3.ClassDefinition);
		expect(as3Class.accessLevel).toBe(as3.AccessModifiers[as3.AccessModifiers.public]);
		let methods = as3Class.methods;
		expect(methods.length).toBe(1);
		let method = methods[0];
		expect(method).not.toBeNull();
		expect(method.name).toBe("method1");
		expect(method.accessLevel).toBe(as3.AccessModifiers[as3.AccessModifiers.public]);
		expect(method.isStatic).toBe(false);
		expect(method.type.getFullyQualifiedName()).toBe(as3.BuiltIns[as3.BuiltIns.void]);
		let params = method.parameters;
		expect(params).not.toBeNull();
		expect(params.length).toBe(5);
		
		let param1 = params[0];
		expect(param1).not.toBeNull();
		expect(param1.name).toBe("param1");
		expect(param1.type).not.toBeNull();
		expect(param1.type.getFullyQualifiedName()).toBe(as3.BuiltIns[as3.BuiltIns.Number]);
		expect(param1.value).toBeNull();
		expect(param1.isRest).toBe(false);
		
		let param2 = params[1];
		expect(param2).not.toBeNull();
		expect(param2.name).toBe("param2");
		expect(param2.type).not.toBeNull();
		expect(param2.type.getFullyQualifiedName()).toBe(as3.BuiltIns[as3.BuiltIns.String]);
		expect(param2.value).toBeNull();
		expect(param2.isRest).toBe(false);
		
		let param3 = params[2];
		expect(param3).not.toBeNull();
		expect(param3.name).toBe("param3");
		expect(param3.type).not.toBeNull();
		expect(param3.type.getFullyQualifiedName()).toBe(as3.BuiltIns[as3.BuiltIns.Boolean]);
		expect(param3.value).toBe("false");
		expect(param3.isRest).toBe(false);
		
		let param4 = params[3];
		expect(param4).not.toBeNull();
		expect(param4.name).toBe("param4");
		expect(param4.type).not.toBeNull();
		expect(param4.type.getFullyQualifiedName()).toBe(as3.BuiltIns[as3.BuiltIns.Object]);
		expect(param4.value).toBe("undefined");
		expect(param4.isRest).toBe(false);
		
		let param5 = params[4];
		expect(param5).not.toBeNull();
		expect(param5.name).toBe("param5");
		expect(param5.type).not.toBeNull();
		expect(param5.type.getFullyQualifiedName()).toBe(as3.BuiltIns[as3.BuiltIns.Array]);
		expect(param5.value).toBeNull();
		expect(param5.isRest).toBe(true);
	});
	it("may have a type parameter", () =>
	{
		let symbols = parser.parse(["spec/fixtures/method-type-parameter.d.ts"]).definitions;
		let as3Class = <as3.ClassDefinition> as3.getDefinitionByName("MethodWithTypeParameter", symbols);
		expect(as3Class).not.toBeNull();
		expect(as3Class.constructor).toBe(as3.ClassDefinition);
		expect(as3Class.accessLevel).toBe(as3.AccessModifiers[as3.AccessModifiers.public]);
		let methods = as3Class.methods;
		expect(methods.length).toBe(1);
		let method = methods[0];
		expect(method).not.toBeNull();
		expect(method.name).toBe("method1");
		expect(method.accessLevel).toBe(as3.AccessModifiers[as3.AccessModifiers.public]);
		expect(method.isStatic).toBe(false);
		expect(method.type.getFullyQualifiedName()).toBe(as3.BuiltIns[as3.BuiltIns.void]);
		let params = method.parameters;
		expect(params).not.toBeNull();
		expect(params.length).toBe(1);
		let param1 = params[0];
		expect(param1).not.toBeNull();
		expect(param1.name).toBe("param1");
		expect(param1.type).not.toBeNull();
		expect(param1.type.getFullyQualifiedName()).toBe(as3.BuiltIns[as3.BuiltIns.Object]);
		expect(param1.value).toBeNull();
		expect(param1.isRest).toBe(false);
	});
	it("may have a type parameter with the same name as a type parameter on the class", () =>
	{
		let symbols = parser.parse(["spec/fixtures/method-type-parameter-same-as-class.d.ts"]).definitions;
		let as3Class = <as3.ClassDefinition> as3.getDefinitionByName("ClassAndMethodWithSameTypeParameter", symbols);
		expect(as3Class).not.toBeNull();
		expect(as3Class.constructor).toBe(as3.ClassDefinition);
		expect(as3Class.accessLevel).toBe(as3.AccessModifiers[as3.AccessModifiers.public]);
		
		let methods = as3Class.methods;
		expect(methods.length).toBe(2);
		
		let method = methods[0];
		expect(method).not.toBeNull();
		expect(method.name).toBe("method1");
		expect(method.accessLevel).toBe(as3.AccessModifiers[as3.AccessModifiers.public]);
		expect(method.isStatic).toBe(false);
		expect(method.type.getFullyQualifiedName()).toBe(as3.BuiltIns[as3.BuiltIns.void]);
		let params = method.parameters;
		expect(params).not.toBeNull();
		expect(params.length).toBe(1);
		let param1 = params[0];
		expect(param1).not.toBeNull();
		expect(param1.name).toBe("param1");
		expect(param1.type).not.toBeNull();
		expect(param1.type.getFullyQualifiedName()).toBe(as3.BuiltIns[as3.BuiltIns.Object]);
		expect(param1.value).toBeNull();
		expect(param1.isRest).toBe(false);
		expect(methods.length).toBe(2);

		let method2 = methods[1];
		expect(method2).not.toBeNull();
		expect(method2.name).toBe("method2");
		expect(method.accessLevel).toBe(as3.AccessModifiers[as3.AccessModifiers.public]);
		expect(method2.isStatic).toBe(false);
		expect(method2.type.getFullyQualifiedName()).toBe(as3.BuiltIns[as3.BuiltIns.void]);
		params = method2.parameters;
		expect(params).not.toBeNull();
		expect(params.length).toBe(2);
		param1 = params[0];
		expect(param1).not.toBeNull();
		expect(param1.name).toBe("param1");
		expect(param1.type).not.toBeNull();
		expect(param1.type.getFullyQualifiedName()).toBe(as3.BuiltIns[as3.BuiltIns.Object]);
		expect(param1.value).toBeNull();
		expect(param1.isRest).toBe(false);
		let param2 = params[1];
		expect(param2).not.toBeNull();
		expect(param2.name).toBe("param2");
		expect(param2.type).not.toBeNull();
		expect(param2.type.getFullyQualifiedName()).toBe(as3.BuiltIns[as3.BuiltIns.Object]);
		expect(param2.value).toBeNull();
		expect(param2.isRest).toBe(false);
	});
});

describe("A constructor", () =>
{
	let parser: TS2ASParser;
	beforeAll(() =>
	{
		parser = new TS2ASParser(ts.ScriptTarget.Latest);
		parser.debugLevel = DebugLevel.WARN;
	});
	it("may have a parameter", () =>
	{
		let symbols = parser.parse(["spec/fixtures/constructor-parameter.d.ts"]).definitions;
		let as3Class = <as3.ClassDefinition> as3.getDefinitionByName("ConstructorWithParameter", symbols);
		expect(as3Class).not.toBeNull();
		expect(as3Class.constructor).toBe(as3.ClassDefinition);
		expect(as3Class.accessLevel).toBe(as3.AccessModifiers[as3.AccessModifiers.public]);
		let constructor = as3Class.constructorMethod;
		expect(constructor).not.toBeNull();
		expect(constructor.name).toBe(as3Class.name);
		expect(constructor.type).toBeNull();
		let params = constructor.parameters;
		expect(params).not.toBeNull();
		expect(params.length).toBe(1);
		let param1 = params[0];
		expect(param1).not.toBeNull();
		expect(param1.name).toBe("param1");
		expect(param1.type).not.toBeNull();
		expect(param1.type.getFullyQualifiedName()).toBe(as3.BuiltIns[as3.BuiltIns.Number]);
		expect(param1.value).toBeNull();
		expect(param1.isRest).toBe(false);
	});
	it("may have a default parameter", () =>
	{
		let symbols = parser.parse(["spec/fixtures/constructor-parameter-default.d.ts"]).definitions;
		let as3Class = <as3.ClassDefinition> as3.getDefinitionByName("ConstructorWithDefaultParameter", symbols);
		expect(as3Class).not.toBeNull();
		expect(as3Class.constructor).toBe(as3.ClassDefinition);
		expect(as3Class.accessLevel).toBe(as3.AccessModifiers[as3.AccessModifiers.public]);
		let constructor = as3Class.constructorMethod;
		expect(constructor).not.toBeNull();
		expect(constructor.name).toBe(as3Class.name);
		expect(constructor.type).toBeNull();
		let params = constructor.parameters;
		expect(params).not.toBeNull();
		expect(params.length).toBe(1);
		let param1 = params[0];
		expect(param1).not.toBeNull();
		expect(param1.name).toBe("param1");
		expect(param1.type).not.toBeNull();
		expect(param1.type.getFullyQualifiedName()).toBe(as3.BuiltIns[as3.BuiltIns.String]);
		expect(param1.value).toBe("\"hello\"");
		expect(param1.isRest).toBe(false);
	});
	it("may have a rest parameter", () =>
	{
		let symbols = parser.parse(["spec/fixtures/constructor-parameter-rest.d.ts"]).definitions;
		let as3Class = <as3.ClassDefinition> as3.getDefinitionByName("ConstructorWithRestParameter", symbols);
		expect(as3Class).not.toBeNull();
		expect(as3Class.constructor).toBe(as3.ClassDefinition);
		expect(as3Class.accessLevel).toBe(as3.AccessModifiers[as3.AccessModifiers.public]);
		let constructor = as3Class.constructorMethod;
		expect(constructor).not.toBeNull();
		expect(constructor.name).toBe(as3Class.name);
		expect(constructor.type).toBeNull();
		let params = constructor.parameters;
		expect(params).not.toBeNull();
		expect(params.length).toBe(1);
		let param1 = params[0];
		expect(param1).not.toBeNull();
		expect(param1.name).toBe("param1");
		expect(param1.type).not.toBeNull();
		expect(param1.type.getFullyQualifiedName()).toBe(as3.BuiltIns[as3.BuiltIns.Array]);
		expect(param1.value).toBeNull();
		expect(param1.isRest).toBe(true);
	});
	it("may have an optional parameter", () =>
	{
		let symbols = parser.parse(["spec/fixtures/constructor-parameter-optional.d.ts"]).definitions;
		let as3Class = <as3.ClassDefinition> as3.getDefinitionByName("ConstructorWithOptionalParameter", symbols);
		expect(as3Class).not.toBeNull();
		expect(as3Class.constructor).toBe(as3.ClassDefinition);
		expect(as3Class.accessLevel).toBe(as3.AccessModifiers[as3.AccessModifiers.public]);
		let constructor = as3Class.constructorMethod;
		expect(constructor).not.toBeNull();
		expect(constructor.name).toBe(as3Class.name);
		expect(constructor.type).toBeNull();
		let params = constructor.parameters;
		expect(params).not.toBeNull();
		expect(params.length).toBe(1);
		let param1 = params[0];
		expect(param1).not.toBeNull();
		expect(param1.name).toBe("param1");
		expect(param1.type).not.toBeNull();
		expect(param1.type.getFullyQualifiedName()).toBe(as3.BuiltIns[as3.BuiltIns.String]);
		expect(param1.value).toBe("undefined");
		expect(param1.isRest).toBe(false);
	});
	describe("that has overloads", () =>
	{
		it("must type a parameter as Object in ActionScript if the types have no common base type", () =>
		{
			let symbols = parser.parse(["spec/fixtures/constructor-overload-incompatible-parameter-type.d.ts"]).definitions;
			let as3Class = <as3.ClassDefinition> as3.getDefinitionByName("ConstructorOverload", symbols);
			expect(as3Class).not.toBeNull();
			expect(as3Class.constructor).toBe(as3.ClassDefinition);
			expect(as3Class.accessLevel).toBe(as3.AccessModifiers[as3.AccessModifiers.public]);
			let constructor = as3Class.constructorMethod;
			expect(constructor).not.toBeNull();
			expect(constructor.name).toBe(as3Class.name);
			expect(constructor.type).toBeNull();
			let params = constructor.parameters;
			expect(params).not.toBeNull();
			expect(params.length).toBe(1);
			let param1 = params[0];
			expect(param1).not.toBeNull();
			expect(param1.name).toBe("param1");
			expect(param1.type).not.toBeNull();
			expect(param1.type.getFullyQualifiedName()).toBe(as3.BuiltIns[as3.BuiltIns.Object]);
			expect(param1.value).toBeNull();
			expect(param1.isRest).toBe(false);
		});
	});
	it("may have multiple parameters", () =>
	{
		let symbols = parser.parse(["spec/fixtures/constructor-multiple-parameters.d.ts"]).definitions;
		let as3Class = <as3.ClassDefinition> as3.getDefinitionByName("ConstructorWithMultipleParameters", symbols);
		expect(as3Class).not.toBeNull();
		expect(as3Class.constructor).toBe(as3.ClassDefinition);
		expect(as3Class.accessLevel).toBe(as3.AccessModifiers[as3.AccessModifiers.public]);
		let constructor = as3Class.constructorMethod;
		expect(constructor).not.toBeNull();
		expect(constructor.name).toBe(as3Class.name);
		expect(constructor.type).toBeNull();
		let params = constructor.parameters;
		expect(params).not.toBeNull();
		expect(params.length).toBe(5);
		
		let param1 = params[0];
		expect(param1).not.toBeNull();
		expect(param1.name).toBe("param1");
		expect(param1.type).not.toBeNull();
		expect(param1.type.getFullyQualifiedName()).toBe(as3.BuiltIns[as3.BuiltIns.Number]);
		expect(param1.value).toBeNull();
		expect(param1.isRest).toBe(false);
		
		let param2 = params[1];
		expect(param2).not.toBeNull();
		expect(param2.name).toBe("param2");
		expect(param2.type).not.toBeNull();
		expect(param2.type.getFullyQualifiedName()).toBe(as3.BuiltIns[as3.BuiltIns.String]);
		expect(param2.value).toBeNull();
		expect(param2.isRest).toBe(false);
		
		let param3 = params[2];
		expect(param3).not.toBeNull();
		expect(param3.name).toBe("param3");
		expect(param3.type).not.toBeNull();
		expect(param3.type.getFullyQualifiedName()).toBe(as3.BuiltIns[as3.BuiltIns.Boolean]);
		expect(param3.value).toBe("false");
		expect(param3.isRest).toBe(false);
		
		let param4 = params[3];
		expect(param4).not.toBeNull();
		expect(param4.name).toBe("param4");
		expect(param4.type).not.toBeNull();
		expect(param4.type.getFullyQualifiedName()).toBe(as3.BuiltIns[as3.BuiltIns.Object]);
		expect(param4.value).toBe("undefined");
		expect(param4.isRest).toBe(false);
		
		let param5 = params[4];
		expect(param5).not.toBeNull();
		expect(param5.name).toBe("param5");
		expect(param5.type).not.toBeNull();
		expect(param5.type.getFullyQualifiedName()).toBe(as3.BuiltIns[as3.BuiltIns.Array]);
		expect(param5.value).toBeNull();
		expect(param5.isRest).toBe(true);
	});
	it("may have a type parameter", () =>
	{
		let symbols = parser.parse(["spec/fixtures/constructor-type-parameter.d.ts"]).definitions;
		let as3Class = <as3.ClassDefinition> as3.getDefinitionByName("ConstructorWithTypeParameter", symbols);
		expect(as3Class).not.toBeNull();
		expect(as3Class.constructor).toBe(as3.ClassDefinition);
		expect(as3Class.accessLevel).toBe(as3.AccessModifiers[as3.AccessModifiers.public]);
		let constructor = as3Class.constructorMethod;
		expect(constructor).not.toBeNull();
		expect(constructor.name).toBe(as3Class.name);
		expect(constructor.type).toBeNull();
		let params = constructor.parameters;
		expect(params).not.toBeNull();
		expect(params.length).toBe(1);
		let param1 = params[0];
		expect(param1).not.toBeNull();
		expect(param1.name).toBe("param1");
		expect(param1.type).not.toBeNull();
		expect(param1.type.getFullyQualifiedName()).toBe(as3.BuiltIns[as3.BuiltIns.Object]);
		expect(param1.value).toBeNull();
		expect(param1.isRest).toBe(false);
	});
});

describe("A decomposed class", () =>
{
	let parser: TS2ASParser;
	beforeAll(() =>
	{
		parser = new TS2ASParser(ts.ScriptTarget.Latest);
		parser.debugLevel = DebugLevel.WARN;
	});
	it("may have multiple static side interfaces with constructors and the same name", () =>
	{
		let symbols = parser.parse(["spec/fixtures/duplicate-static-side.d.ts"]).definitions;
		let as3Class = <as3.ClassDefinition> as3.getDefinitionByName("DuplicateStaticSide", symbols);
		expect(as3Class).not.toBeNull();
		expect(as3Class.constructor).toBe(as3.ClassDefinition);
		expect(as3Class.accessLevel).toBe(as3.AccessModifiers[as3.AccessModifiers.public]);
		
		let methods = as3Class.methods;
		expect(methods.length).toBe(2);
		let foundMethod1 = false;
		let foundMethod2 = false;
		methods.forEach((method) =>
		{
			expect(method).not.toBeNull();
			switch(method.name)
			{
				case "method1":
				{
					foundMethod1 = true;
					expect(method.accessLevel).toBe(as3.AccessModifiers[as3.AccessModifiers.public]);
					expect(method.isStatic).toBe(true);
					let as3MethodType = <as3.ClassDefinition> as3.getDefinitionByName("String", symbols);
					expect(method.type).toBe(as3MethodType);
					break;
				}
				case "method2":
				{
					foundMethod2 = true;
					expect(method.accessLevel).toBe(as3.AccessModifiers[as3.AccessModifiers.public]);
					expect(method.isStatic).toBe(true);
					let as3MethodType = <as3.ClassDefinition> as3.getDefinitionByName("Number", symbols);
					expect(method.type).toBe(as3MethodType);
					break;
				}
				default:
				{
					fail("unknown method with name " + method.name);
				}
			}
		});
		expect(foundMethod1).toBe(true);
		expect(foundMethod2).toBe(true);
		
		let staticSide = as3.getDefinitionByName("StaticSide", symbols);
		expect(staticSide).toBeNull();
	});
	it("may be an interface followed by variable with same name with a static side interface", () =>
	{
		let symbols = parser.parse(["spec/fixtures/interface-static-side-variable-decomposed-class.d.ts"]).definitions;
		let as3Class = <as3.ClassDefinition> as3.getDefinitionByName("InterfaceStaticSideVariableDecomposedClass", symbols);
		expect(as3Class).not.toBeNull();
		expect(as3Class.constructor).toBe(as3.ClassDefinition);
		expect(as3Class.accessLevel).toBe(as3.AccessModifiers[as3.AccessModifiers.public]);
		
		let staticSide = as3.getDefinitionByName("StaticSide", symbols);
		expect(staticSide).toBeNull();
	});
	it("may be a variable with a static side interface", () =>
	{
		let symbols = parser.parse(["spec/fixtures/variable-no-interface-decomposed-class.d.ts"]).definitions;
		let as3Class = <as3.ClassDefinition> as3.getDefinitionByName("VariableNoInterfaceDecomposedClass", symbols);
		expect(as3Class).not.toBeNull();
		expect(as3Class.constructor).toBe(as3.ClassDefinition);
		expect(as3Class.accessLevel).toBe(as3.AccessModifiers[as3.AccessModifiers.public]);
		
		let staticSide = as3.getDefinitionByName("StaticSide", symbols);
		expect(staticSide).toBeNull();
	});
	it("may be an interface followed by variable with same name with a static side interface that has no constructor", () =>
	{
		let symbols = parser.parse(["spec/fixtures/interface-static-side-variable-decomposed-class-without-constructor.d.ts"]).definitions;
		let as3Class = <as3.ClassDefinition> as3.getDefinitionByName("InterfaceStaticSideVariableDecomposedClassWithoutConstructor", symbols);
		expect(as3Class).not.toBeNull();
		expect(as3Class.constructor).toBe(as3.ClassDefinition);
		expect(as3Class.accessLevel).toBe(as3.AccessModifiers[as3.AccessModifiers.public]);
		
		let methods = as3Class.methods;
		expect(methods.length).toBe(1);
		let method = methods[0];
		expect(method).not.toBeNull();
		expect(method.name).toBe("method1");
		expect(method.accessLevel).toBe(as3.AccessModifiers[as3.AccessModifiers.public]);
		expect(method.isStatic).toBe(true);
		let as3MethodType = <as3.TypeDefinition> as3.getDefinitionByName("String", symbols);
		expect(method.type).toBe(as3MethodType);
		
		let staticSide = as3.getDefinitionByName("StaticSide", symbols);
		expect(staticSide).toBeNull();
		
	});
	it("may be an interface followed by multiple variables with same name", () =>
	{
		let symbols = parser.parse(["spec/fixtures/interface-duplicate-variable-decomposed-class.d.ts"]).definitions;
		let as3Class = <as3.ClassDefinition> as3.getDefinitionByName("InterfaceDuplicateVariableDecomposedClass", symbols);
		expect(as3Class).not.toBeNull();
		expect(as3Class.constructor).toBe(as3.ClassDefinition);
		expect(as3Class.accessLevel).toBe(as3.AccessModifiers[as3.AccessModifiers.public]);
	});
	it("may be a variable followed by an interface with same name", () =>
	{
		let symbols = parser.parse(["spec/fixtures/variable-interface-decomposed-class.d.ts"]).definitions;
		let as3Class = <as3.ClassDefinition> as3.getDefinitionByName("VariableInterfaceDecomposedClass", symbols);
		expect(as3Class).not.toBeNull();
		expect(as3Class.constructor).toBe(as3.ClassDefinition);
		expect(as3Class.accessLevel).toBe(as3.AccessModifiers[as3.AccessModifiers.public]);
	});
	it("may be a variable typed as an interface with same name", () =>
	{
		let symbols = parser.parse(["spec/fixtures/variable-typed-as-interface-decomposed-class.d.ts"]).definitions;
		let as3Class = <as3.ClassDefinition> as3.getDefinitionByName("VariableTypedAsInterfaceDecomposedClass", symbols);
		expect(as3Class).not.toBeNull();
		expect(as3Class.constructor).toBe(as3.ClassDefinition);
		expect(as3Class.accessLevel).toBe(as3.AccessModifiers[as3.AccessModifiers.public]);
		expect(as3Class.methods.length).toBe(1);
		let method = as3Class.methods[0];
		expect(method).not.toBeNull();
		expect(method.name).toBe("method1");
		expect(method.accessLevel).toBe(as3.AccessModifiers[as3.AccessModifiers.public]);
		expect(method.isStatic).toBe(true);
	});
	it("may be an interface that extends another decomposed class", () =>
	{
		let symbols = parser.parse(["spec/fixtures/interface-extends-decomposed-class.d.ts"]).definitions;
		let as3Class = <as3.ClassDefinition> as3.getDefinitionByName("InterfaceExtendsDecomposedClass", symbols);
		expect(as3Class).not.toBeNull();
		expect(as3Class.constructor).toBe(as3.ClassDefinition);
		expect(as3Class.accessLevel).toBe(as3.AccessModifiers[as3.AccessModifiers.public]);
		let superClass = as3Class.superClass;
		expect(superClass).not.toBeNull();
		expect(superClass.getFullyQualifiedName()).toBe("DecomposedClass");
		expect(superClass.constructor).toBe(as3.ClassDefinition);
		expect(superClass.accessLevel).toBe(as3.AccessModifiers[as3.AccessModifiers.public]);
	});
	it("may have a property", () =>
	{
		let symbols = parser.parse(["spec/fixtures/decomposed-class-member-property.d.ts"]).definitions;
		let as3Class = <as3.ClassDefinition> as3.getDefinitionByName("DecomposedClassWithProperty", symbols);
		expect(as3Class).not.toBeNull();
		expect(as3Class.properties.length).toBe(1);
		let property = as3Class.properties[0];
		expect(property).not.toBeNull();
		expect(property.name).toBe("property1");
		expect(property.accessLevel).toBe(as3.AccessModifiers[as3.AccessModifiers.public]);
		expect(property.isStatic).toBe(false);
		let as3PropertyType = <as3.TypeDefinition> as3.getDefinitionByName("String", symbols);
		expect(property.type).toBe(as3PropertyType);
	});
	it("may have a static property", () =>
	{
		let symbols = parser.parse(["spec/fixtures/decomposed-class-static-property.d.ts"]).definitions;
		let as3Class = <as3.ClassDefinition> as3.getDefinitionByName("DecomposedClassWithStaticProperty", symbols);
		expect(as3Class).not.toBeNull();
		expect(as3Class.properties.length).toBe(1);
		let property = as3Class.properties[0];
		expect(property).not.toBeNull();
		expect(property.name).toBe("property1");
		expect(property.accessLevel).toBe(as3.AccessModifiers[as3.AccessModifiers.public]);
		expect(property.isStatic).toBe(true);
		let as3PropertyType = <as3.TypeDefinition> as3.getDefinitionByName("String", symbols);
		expect(property.type).toBe(as3PropertyType);
	});
	it("may have a method", () =>
	{
		let symbols = parser.parse(["spec/fixtures/decomposed-class-member-method.d.ts"]).definitions;
		let as3Class = <as3.ClassDefinition> as3.getDefinitionByName("DecomposedClassWithMethod", symbols);
		expect(as3Class).not.toBeNull();
		expect(as3Class.methods.length).toBe(1);
		let method = as3Class.methods[0];
		expect(method).not.toBeNull();
		expect(method.name).toBe("method1");
		expect(method.accessLevel).toBe(as3.AccessModifiers[as3.AccessModifiers.public]);
		expect(method.isStatic).toBe(false);
		let as3MethodType = <as3.TypeDefinition> as3.getDefinitionByName("Number", symbols);
		expect(method.type).toBe(as3MethodType);
	});
	it("may have a static method", () =>
	{
		let symbols = parser.parse(["spec/fixtures/decomposed-class-static-method.d.ts"]).definitions;
		let as3Class = <as3.ClassDefinition> as3.getDefinitionByName("DecomposedClassWithStaticMethod", symbols);
		expect(as3Class).not.toBeNull();
		expect(as3Class.methods.length).toBe(1);
		let method = as3Class.methods[0];
		expect(method).not.toBeNull();
		expect(method.name).toBe("method1");
		expect(method.accessLevel).toBe(as3.AccessModifiers[as3.AccessModifiers.public]);
		expect(method.isStatic).toBe(true);
		let as3MethodType = <as3.TypeDefinition> as3.getDefinitionByName("Number", symbols);
		expect(method.type).toBe(as3MethodType);
	});

	describe("that is a variable typed as an interface with same name", () =>
	{
		it("may define a static method as a member of the interface", () =>
		{
			let symbols = parser.parse(["spec/fixtures/variable-interface-decomposed-class-method.d.ts"]).definitions;
			let as3Class = <as3.ClassDefinition> as3.getDefinitionByName("VariableInterfaceDecomposedClass", symbols);
			expect(as3Class).not.toBeNull();
			expect(as3Class.constructor).toBe(as3.ClassDefinition);
			expect(as3Class.accessLevel).toBe(as3.AccessModifiers[as3.AccessModifiers.public]);
			expect(as3Class.methods.length).toBe(1);
			let method = as3Class.methods[0];
			expect(method).not.toBeNull();
			expect(method.name).toBe("method1");
			expect(method.accessLevel).toBe(as3.AccessModifiers[as3.AccessModifiers.public]);
			expect(method.isStatic).toBe(true);
			let as3MethodType = <as3.TypeDefinition> as3.getDefinitionByName("Number", symbols);
			expect(method.type).toBe(as3MethodType);
		});
	});
});

describe("A module", () =>
{
	let parser: TS2ASParser;
	beforeAll(() =>
	{
		parser = new TS2ASParser(ts.ScriptTarget.Latest);
		parser.debugLevel = DebugLevel.WARN;
	});
	it("may be exported with a different name", () =>
	{
		let symbols = parser.parse(["spec/fixtures/assign-inner-module-to-export.d.ts"]).definitions;
		let as3Variable = <as3.PackageVariableDefinition> as3.getDefinitionByName("outer.variable", symbols);
		expect(as3Variable).not.toBeNull();
		expect(as3Variable.name).toBe("variable");
		expect(as3Variable.packageName).toBe("outer");
	});
	it("may export something declared outside", () =>
	{
		let symbols = parser.parse(["spec/fixtures/assign-definition-outside-module-to-export.d.ts"]).definitions;
		let as3Variable = <as3.PackageVariableDefinition> as3.getDefinitionByName("variable", symbols);
		expect(as3Variable).not.toBeNull();
		expect(as3Variable.name).toBe("variable");
		expect(as3Variable.packageName).toBe("");
		expect(as3Variable.moduleName).toBe("some-module");
	});
	it("may assign a function with the same name to be exported", () =>
	{
		let symbols = parser.parse(["spec/fixtures/export-function-as-named-module-with-same-name.d.ts"]).definitions;
		let as3Function = <as3.PackageFunctionDefinition> as3.getDefinitionByName("functionModule", symbols);
		expect(as3Function).not.toBeNull();
		expect(as3Function.name).toBe("functionModule");
		expect(as3Function.packageName).toBe("");
		expect(as3Function.moduleName).toBe("functionModule");
	});
	it("may assign a function with a different name to be exported", () =>
	{
		let symbols = parser.parse(["spec/fixtures/export-function-as-named-module-with-different-name.d.ts"]).definitions;
		let as3Function = <as3.PackageFunctionDefinition> as3.getDefinitionByName("functionModule", symbols);
		expect(as3Function).not.toBeNull();
		expect(as3Function.name).toBe("functionModule");
		expect(as3Function.packageName).toBe("");
		expect(as3Function.moduleName).toBe("functionModule");
	});
	describe("with hyphens in the name", () =>
	{
		it("must not have hyphens in the package", () =>
		{
			let symbols = parser.parse(["spec/fixtures/module-hyphens.d.ts"]).definitions;
			let as3Class = <as3.ClassDefinition> as3.getDefinitionByName("moduleWithHyphens.ClassInModuleWithHyphens", symbols);
			expect(as3Class).not.toBeNull();
			expect(as3Class.name).toBe("ClassInModuleWithHyphens");
			expect(as3Class.packageName).toBe("moduleWithHyphens");
			expect(as3Class.moduleName).toBe("module-with-hyphens");
		});
	});
});

describe("A type alias", () =>
{
	let parser: TS2ASParser;
	beforeAll(() =>
	{
		parser = new TS2ASParser(ts.ScriptTarget.Latest);
		parser.debugLevel = DebugLevel.WARN;
	});
	it("may be declared", () =>
	{
		let symbols = parser.parse(["spec/fixtures/type-alias.d.ts"]).definitions;
		let as3Variable = <as3.PackageVariableDefinition> as3.getDefinitionByName("typeAlias", symbols);
		expect(as3Variable).not.toBeNull();
		expect(as3Variable.name).toBe("typeAlias");
		let as3VariableType = <as3.TypeDefinition> as3.getDefinitionByName("String", symbols);
		expect(as3Variable.type).toBe(as3VariableType);
	});
	it("may be declared in a module", () =>
	{
		let symbols = parser.parse(["spec/fixtures/type-alias-module.d.ts"]).definitions;
		let as3Variable = <as3.PackageVariableDefinition> as3.getDefinitionByName("typeAlias", symbols);
		expect(as3Variable).not.toBeNull();
		expect(as3Variable.name).toBe("typeAlias");
		let as3VariableType = <as3.TypeDefinition> as3.getDefinitionByName("String", symbols);
		expect(as3Variable.type).toBe(as3VariableType);
	});
	it("may be declared in a submodule and referenced without full module name", () =>
	{
		let symbols = parser.parse(["spec/fixtures/type-alias-submodule.d.ts"]).definitions;
		let as3Variable = <as3.PackageVariableDefinition> as3.getDefinitionByName("module1.typeAlias", symbols);
		expect(as3Variable).not.toBeNull();
		expect(as3Variable.name).toBe("typeAlias");
		let as3VariableType = <as3.TypeDefinition> as3.getDefinitionByName("String", symbols);
		expect(as3Variable.type).toBe(as3VariableType);
	});
	it("may be declared in a parent module and referenced without full module name", () =>
	{
		let symbols = parser.parse(["spec/fixtures/type-alias-parent-module.d.ts"]).definitions;
		let as3Variable = <as3.PackageVariableDefinition> as3.getDefinitionByName("module1.module2.typeAlias", symbols);
		expect(as3Variable).not.toBeNull();
		expect(as3Variable.name).toBe("typeAlias");
		let as3VariableType = <as3.TypeDefinition> as3.getDefinitionByName("String", symbols);
		expect(as3Variable.type).toBe(as3VariableType);
	});
});

describe("An import", () =>
{
	let parser: TS2ASParser;
	beforeAll(() =>
	{
		parser = new TS2ASParser(ts.ScriptTarget.Latest);
		parser.debugLevel = DebugLevel.WARN;
	});
	describe("declared in a module", () =>
	{
		it("may refer to another module", () =>
		{
			let symbols = parser.parse(["spec/fixtures/import-module.d.ts"]).definitions;
			let as3Class = <as3.ClassDefinition> as3.getDefinitionByName("first.ClassOne", symbols);
			expect(as3Class).not.toBeNull();
			let as3Variable = <as3.PackageVariableDefinition> as3.getDefinitionByName("second.var1", symbols);
			expect(as3Variable).not.toBeNull();
			expect(as3Variable.type).toBe(as3Class);
		});
		it("may be used in a sub-module", () =>
		{
			let symbols = parser.parse(["spec/fixtures/import-module-use-in-sub-module.d.ts"]).definitions;
			let as3Class = <as3.ClassDefinition> as3.getDefinitionByName("aliased.ClassOne", symbols);
			expect(as3Class).not.toBeNull();
			let as3Variable = <as3.PackageVariableDefinition> as3.getDefinitionByName("outer.inner.var1", symbols);
			expect(as3Variable).not.toBeNull();
			expect(as3Variable.type).toBe(as3Class);
		});
	});
	describe("declared in a source file", () =>
	{
		it("may be used in a module", () =>
		{
			let symbols = parser.parse(["spec/fixtures/import-module-in-source-file-use-in-module.d.ts"]).definitions;
			let as3Class = <as3.ClassDefinition> as3.getDefinitionByName("aliasedModule.ClassOne", symbols);
			expect(as3Class).not.toBeNull();
			let as3Variable = <as3.PackageVariableDefinition> as3.getDefinitionByName("aliasedModule.var1", symbols);
			expect(as3Variable).not.toBeNull();
			expect(as3Variable.type).toBe(as3Class);
		});
	});
});