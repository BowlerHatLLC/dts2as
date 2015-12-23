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

import path = require("path");
import as3 = require("../../source/as3");
import TS2ASParser = require("../../source/parser");
import ts = require("typescript");

describe("A top-level class", () =>
{
    it("doesn't require import", () =>
    {
        let scope = new as3.ClassDefinition("ClassInPackage", "com.example", as3.AccessModifiers[as3.AccessModifiers.public], null, null, false);
        let classToImport = new as3.ClassDefinition("TopLevelClass", null, as3.AccessModifiers[as3.AccessModifiers.public], null, null, false);
        let requiresImport = as3.requiresImport(classToImport, scope);
        expect(requiresImport).toBe(false);
    });
});
describe("A class in the same package", () =>
{
    it("doesn't require import", () =>
    {
        let scope = new as3.ClassDefinition("ClassInPackage", "com.example", as3.AccessModifiers[as3.AccessModifiers.public], null, null, false);
        let classToImport = new as3.ClassDefinition("AnotherClassInPackage", "com.example", as3.AccessModifiers[as3.AccessModifiers.public], null, null, false);
        let requiresImport = as3.requiresImport(classToImport, scope);
        expect(requiresImport).toBe(false);
    }); 
});
describe("A class in a different package", () =>
{
    it("Class in different package requires import", () =>
    {
        let scope = new as3.ClassDefinition("ClassInPackage", "com.example", as3.AccessModifiers[as3.AccessModifiers.public], null, null, false);
        let classToImport = new as3.ClassDefinition("ClassInDifferentPackage", "org.example", as3.AccessModifiers[as3.AccessModifiers.public], null, null, false);
        let requiresImport = as3.requiresImport(classToImport, scope);
        expect(requiresImport).toBe(true);
    });
});

describe("A class in the a sub-package", () =>
{
    it("requires import", () =>
    {
        let scope = new as3.ClassDefinition("ClassInPackage", "com.example", as3.AccessModifiers[as3.AccessModifiers.public], null, null, false);
        let classToImport = new as3.ClassDefinition("ClassInSubPackage", "com.example.sub", as3.AccessModifiers[as3.AccessModifiers.public], null, null, false);
        let requiresImport = as3.requiresImport(classToImport, scope);
        expect(requiresImport).toBe(true);
    });
});

describe("A class in the super-package", () =>
{
    it("requires import", () =>
    {
        let scope = new as3.ClassDefinition("ClassInSubPackage", "com.example.sub", as3.AccessModifiers[as3.AccessModifiers.public], null, null, false);
        let classToImport = new as3.ClassDefinition("ClassInSuperPackage", "com.example", as3.AccessModifiers[as3.AccessModifiers.public], null, null, false);
        let requiresImport = as3.requiresImport(classToImport, scope);
        expect(requiresImport).toBe(true);
    });
});

describe("The default return value", () =>
{
    let symbols: as3.PackageLevelDefinition[];
    beforeAll(() =>
    {
        let parser = new TS2ASParser(ts.ScriptTarget.ES5);
        let standardLibPath = require.resolve("typescript");
        standardLibPath = path.dirname(standardLibPath);
        standardLibPath = path.resolve(standardLibPath, "lib.core.d.ts");
        symbols = parser.parse([standardLibPath]).definitions;
    });
    describe("for Number", () =>
    {
        it("is 0", () =>
        {
            let type = <as3.TypeDefinition> as3.getDefinitionByName(as3.BuiltIns[as3.BuiltIns.Number], symbols);
            let defaultReturnValue = as3.getDefaultReturnValueForType(type);
            expect(defaultReturnValue).toBe("0");
        });
    });
    describe("for Boolean", () =>
    {
        it("is false", () =>
        {
            let type = <as3.TypeDefinition> as3.getDefinitionByName(as3.BuiltIns[as3.BuiltIns.Boolean], symbols);
            let defaultReturnValue = as3.getDefaultReturnValueForType(type);
            expect(defaultReturnValue).toBe("false");
        });
    });
    describe("for String", () =>
    {
        it("is null", () =>
        {
            let type = <as3.TypeDefinition> as3.getDefinitionByName(as3.BuiltIns[as3.BuiltIns.String], symbols);
            let defaultReturnValue = as3.getDefaultReturnValueForType(type);
            expect(defaultReturnValue).toBe("null");
        });
    });
    describe("for Object", () =>
    {
        it("is null", () =>
        {
            let type = <as3.TypeDefinition> as3.getDefinitionByName(as3.BuiltIns[as3.BuiltIns.Object], symbols);
            let defaultReturnValue = as3.getDefaultReturnValueForType(type);
            expect(defaultReturnValue).toBe("null");
        });
    });
});

describe("The common base class", () =>
{
    let symbols: as3.PackageLevelDefinition[];
    beforeAll(() =>
    {
        let parser = new TS2ASParser(ts.ScriptTarget.ES5);
        let standardLibPath = require.resolve("typescript");
        standardLibPath = path.dirname(standardLibPath);
        standardLibPath = path.resolve(standardLibPath, "lib.core.d.ts");
        symbols = parser.parse([standardLibPath]).definitions;
    });
    describe("for a class and itself", () =>
    {
        it("is the same class class", () =>
        {
            let class1 = new as3.ClassDefinition("SomeClass", "com.example", as3.AccessModifiers[as3.AccessModifiers.public], null, null, false);
            let result = as3.getCommonBaseClass(class1, class1);
            expect(result).toBe(class1);
        });
    });
    describe("for a class and its super class", () =>
    {
        it("is the super class", () =>
        {
            let class1 = new as3.ClassDefinition("SuperClass", "com.example", as3.AccessModifiers[as3.AccessModifiers.public], null, null, false);
            let class2 = new as3.ClassDefinition("SubClass", "com.example", as3.AccessModifiers[as3.AccessModifiers.public], null, null, false);
            class2.superClass = class1;
            let result = as3.getCommonBaseClass(class1, class2);
            expect(result).toBe(class1);
            result = as3.getCommonBaseClass(class2, class1);
            expect(result).toBe(class1);
        });
    });
    describe("for two classes with the same super class", () =>
    {
        it("is the super class", () =>
        {
            let class1 = new as3.ClassDefinition("SuperClass", "com.example", as3.AccessModifiers[as3.AccessModifiers.public], null, null, false);
            let class2 = new as3.ClassDefinition("SubClass1", "com.example", as3.AccessModifiers[as3.AccessModifiers.public], null, null, false);
            class2.superClass = class1;
            let class3 = new as3.ClassDefinition("SubClass2", "com.example", as3.AccessModifiers[as3.AccessModifiers.public], null, null, false);
            class3.superClass = class1;
            let result = as3.getCommonBaseClass(class2, class3);
            expect(result).toBe(class1);
            result = as3.getCommonBaseClass(class3, class2);
            expect(result).toBe(class1);
        });
    });
    describe("for two unrelated classes", () =>
    {
        it("is null", () =>
        {
            let class1 = new as3.ClassDefinition("SomeClass", "com.example", as3.AccessModifiers[as3.AccessModifiers.public], null, null, false);
            let class2 = new as3.ClassDefinition("AnotherClass", "com.example", as3.AccessModifiers[as3.AccessModifiers.public], null, null, false);
            let result = as3.getCommonBaseClass(class1, class2);
            expect(result).toBeNull();
            result = as3.getCommonBaseClass(class2, class1);
            expect(result).toBeNull();
        });
    });
});