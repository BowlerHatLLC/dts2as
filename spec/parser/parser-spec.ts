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
/// <reference path="../../source/as3.ts" />
/// <reference path="../../source/parser.ts" />
/// <reference path="../../typings/jasmine/jasmine.d.ts" />
/// <reference path="../../node_modules/typescript/lib/typescript.d.ts" />

import as3 = require("../../source/as3");
import TS2ASParser = require("../../source/parser");
import ts = require("typescript");

describe("Definitions", () =>
{
    let parser: TS2ASParser;
    beforeEach(() =>
    {
        parser = new TS2ASParser(ts.ScriptTarget.ES5);
    });
    it("Declare a class", () =>
    {
        let symbols = parser.parse("spec/fixtures/declare-class.d.ts");
        let as3Class = as3.getDefinitionByName("DeclareClass", symbols);
        expect(as3Class).not.toBeNull();
        expect(as3Class.constructor).toBe(as3.ClassDefinition);
        expect(as3Class.accessLevel).toBe(as3.AccessModifiers[as3.AccessModifiers.public]);
    });
    it("Export a class", () =>
    {
        let symbols = parser.parse("spec/fixtures/export-class.d.ts");
        let as3Class = as3.getDefinitionByName("ExportClass", symbols);
        expect(as3Class).not.toBeNull();
        expect(as3Class.constructor).toBe(as3.ClassDefinition);
        expect(as3Class.accessLevel).toBe(as3.AccessModifiers[as3.AccessModifiers.public]);
    });
    it("Export a class in a module", () =>
    {
        let symbols = parser.parse("spec/fixtures/class-in-module.d.ts");
        let as3Class = as3.getDefinitionByName("test.ClassInModule", symbols);
        expect(as3Class).not.toBeNull();
        expect(as3Class.constructor).toBe(as3.ClassDefinition);
        expect(as3Class.accessLevel).toBe(as3.AccessModifiers[as3.AccessModifiers.public]);
    });
    it("Export a class in a module with a dot", () =>
    {
        let symbols = parser.parse("spec/fixtures/class-in-module-with-dot.d.ts");
        let as3Class = as3.getDefinitionByName("com.example.ClassInNestedModule", symbols);
        expect(as3Class).not.toBeNull();
        expect(as3Class.constructor).toBe(as3.ClassDefinition);
        expect(as3Class.accessLevel).toBe(as3.AccessModifiers[as3.AccessModifiers.public]);
    });
    it("Export a class in a nested module", () =>
    {
        let symbols = parser.parse("spec/fixtures/class-in-nested-module.d.ts");
        let as3Class = as3.getDefinitionByName("com.example.ClassInNestedModule", symbols);
        expect(as3Class).not.toBeNull();
        expect(as3Class.constructor).toBe(as3.ClassDefinition);
        expect(as3Class.accessLevel).toBe(as3.AccessModifiers[as3.AccessModifiers.public]);
    });
});

describe("Members", () =>
{
    let parser: TS2ASParser;
    beforeEach(() =>
    {
        parser = new TS2ASParser(ts.ScriptTarget.ES5);
    });
    it("Property on a class", () =>
    {
        let symbols = parser.parse("spec/fixtures/member-property.d.ts");
        let as3Class = <as3.ClassDefinition> as3.getDefinitionByName("ClassWithProperty", symbols);
        expect(as3Class).not.toBeNull();
        expect(as3Class.properties.length).toBe(1);
        let property = as3Class.properties[0];
        expect(property).not.toBeNull();
        expect(property.name).toBe("property1");
        expect(property.accessLevel).toBe(as3.AccessModifiers[as3.AccessModifiers.public]);
        expect(property.isStatic).toBe(false);
        let as3PropertyType = as3.getDefinitionByName("String", symbols);
        expect(property.type).toBe(as3PropertyType);
    });
    it("Static property on a class", () =>
    {
        let symbols = parser.parse("spec/fixtures/static-property.d.ts");
        let as3Class = <as3.ClassDefinition> as3.getDefinitionByName("ClassWithStaticProperty", symbols);
        expect(as3Class).not.toBeNull();
        expect(as3Class.properties.length).toBe(1);
        let property = as3Class.properties[0];
        expect(property).not.toBeNull();
        expect(property.name).toBe("property1");
        expect(property.accessLevel).toBe(as3.AccessModifiers[as3.AccessModifiers.public]);
        expect(property.isStatic).toBe(true);
        let as3PropertyType = as3.getDefinitionByName("String", symbols);
        expect(property.type).toBe(as3PropertyType);
    });
    it("Method on a class", () =>
    {
        let symbols = parser.parse("spec/fixtures/member-method.d.ts");
        let as3Class = <as3.ClassDefinition> as3.getDefinitionByName("ClassWithMethod", symbols);
        expect(as3Class).not.toBeNull();
        expect(as3Class.methods.length).toBe(1);
        let method = as3Class.methods[0];
        expect(method).not.toBeNull();
        expect(method.name).toBe("method1");
        expect(method.accessLevel).toBe(as3.AccessModifiers[as3.AccessModifiers.public]);
        expect(method.isStatic).toBe(false);
        let as3MethodType = as3.getDefinitionByName("Number", symbols);
        expect(method.type).toBe(as3MethodType);
    });
    it("Static method on a class", () =>
    {
        let symbols = parser.parse("spec/fixtures/static-method.d.ts");
        let as3Class = <as3.ClassDefinition> as3.getDefinitionByName("ClassWithStaticMethod", symbols);
        expect(as3Class).not.toBeNull();
        expect(as3Class.methods.length).toBe(1);
        let method = as3Class.methods[0];
        expect(method).not.toBeNull();
        expect(method.name).toBe("method1");
        expect(method.accessLevel).toBe(as3.AccessModifiers[as3.AccessModifiers.public]);
        expect(method.isStatic).toBe(true);
        let as3MethodType = as3.getDefinitionByName("Number", symbols);
        expect(method.type).toBe(as3MethodType);
    });
});