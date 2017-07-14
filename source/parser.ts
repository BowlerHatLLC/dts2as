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
import * as fs from "fs";
import * as ts from "typescript";
import * as as3 from "./as3";

class StaticSideClassDefinition extends as3.ClassDefinition
{
	constructor(name: string, packageName: string, accessLevel: string, sourceFile: string, moduleName: string)
	{
		super(name, packageName, accessLevel, sourceFile, moduleName, true);
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

enum TypeScriptPrimitives
{
	any,
	number,
	boolean,
	string,
	symbol,
	void,
	undefined,
	null,
	never
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

let PRIMITIVE_TO_CLASS_TYPE_MAP = {};
PRIMITIVE_TO_CLASS_TYPE_MAP[TypeScriptPrimitives[TypeScriptPrimitives.number]] = as3.BuiltIns[as3.BuiltIns.Number];
PRIMITIVE_TO_CLASS_TYPE_MAP[TypeScriptPrimitives[TypeScriptPrimitives.boolean]] = as3.BuiltIns[as3.BuiltIns.Boolean];
PRIMITIVE_TO_CLASS_TYPE_MAP[TypeScriptPrimitives[TypeScriptPrimitives.string]] =  as3.BuiltIns[as3.BuiltIns.String];
PRIMITIVE_TO_CLASS_TYPE_MAP[TypeScriptPrimitives[TypeScriptPrimitives.any]] =  as3.BuiltIns[as3.BuiltIns.Object];
PRIMITIVE_TO_CLASS_TYPE_MAP[TypeScriptPrimitives[TypeScriptPrimitives.void]] =  as3.BuiltIns[as3.BuiltIns.void];
PRIMITIVE_TO_CLASS_TYPE_MAP[TypeScriptPrimitives[TypeScriptPrimitives.symbol]] =  "Symbol";
PRIMITIVE_TO_CLASS_TYPE_MAP[TypeScriptPrimitives[TypeScriptPrimitives.undefined]] =  "*";
PRIMITIVE_TO_CLASS_TYPE_MAP[TypeScriptPrimitives[TypeScriptPrimitives.null]] =  as3.BuiltIns[as3.BuiltIns.Object];
PRIMITIVE_TO_CLASS_TYPE_MAP[TypeScriptPrimitives[TypeScriptPrimitives.never]] =  "*";

const invalidNameRegExp = /^public|private|protected|internal|extends$/
const identifierNameRegExp = /^(?:[\$A-Z_a-z\xAA\xB5\xBA\xC0-\xD6\xD8-\xF6\xF8-\u02C1\u02C6-\u02D1\u02E0-\u02E4\u02EC\u02EE\u0370-\u0374\u0376\u0377\u037A-\u037D\u037F\u0386\u0388-\u038A\u038C\u038E-\u03A1\u03A3-\u03F5\u03F7-\u0481\u048A-\u052F\u0531-\u0556\u0559\u0561-\u0587\u05D0-\u05EA\u05F0-\u05F2\u0620-\u064A\u066E\u066F\u0671-\u06D3\u06D5\u06E5\u06E6\u06EE\u06EF\u06FA-\u06FC\u06FF\u0710\u0712-\u072F\u074D-\u07A5\u07B1\u07CA-\u07EA\u07F4\u07F5\u07FA\u0800-\u0815\u081A\u0824\u0828\u0840-\u0858\u08A0-\u08B2\u0904-\u0939\u093D\u0950\u0958-\u0961\u0971-\u0980\u0985-\u098C\u098F\u0990\u0993-\u09A8\u09AA-\u09B0\u09B2\u09B6-\u09B9\u09BD\u09CE\u09DC\u09DD\u09DF-\u09E1\u09F0\u09F1\u0A05-\u0A0A\u0A0F\u0A10\u0A13-\u0A28\u0A2A-\u0A30\u0A32\u0A33\u0A35\u0A36\u0A38\u0A39\u0A59-\u0A5C\u0A5E\u0A72-\u0A74\u0A85-\u0A8D\u0A8F-\u0A91\u0A93-\u0AA8\u0AAA-\u0AB0\u0AB2\u0AB3\u0AB5-\u0AB9\u0ABD\u0AD0\u0AE0\u0AE1\u0B05-\u0B0C\u0B0F\u0B10\u0B13-\u0B28\u0B2A-\u0B30\u0B32\u0B33\u0B35-\u0B39\u0B3D\u0B5C\u0B5D\u0B5F-\u0B61\u0B71\u0B83\u0B85-\u0B8A\u0B8E-\u0B90\u0B92-\u0B95\u0B99\u0B9A\u0B9C\u0B9E\u0B9F\u0BA3\u0BA4\u0BA8-\u0BAA\u0BAE-\u0BB9\u0BD0\u0C05-\u0C0C\u0C0E-\u0C10\u0C12-\u0C28\u0C2A-\u0C39\u0C3D\u0C58\u0C59\u0C60\u0C61\u0C85-\u0C8C\u0C8E-\u0C90\u0C92-\u0CA8\u0CAA-\u0CB3\u0CB5-\u0CB9\u0CBD\u0CDE\u0CE0\u0CE1\u0CF1\u0CF2\u0D05-\u0D0C\u0D0E-\u0D10\u0D12-\u0D3A\u0D3D\u0D4E\u0D60\u0D61\u0D7A-\u0D7F\u0D85-\u0D96\u0D9A-\u0DB1\u0DB3-\u0DBB\u0DBD\u0DC0-\u0DC6\u0E01-\u0E30\u0E32\u0E33\u0E40-\u0E46\u0E81\u0E82\u0E84\u0E87\u0E88\u0E8A\u0E8D\u0E94-\u0E97\u0E99-\u0E9F\u0EA1-\u0EA3\u0EA5\u0EA7\u0EAA\u0EAB\u0EAD-\u0EB0\u0EB2\u0EB3\u0EBD\u0EC0-\u0EC4\u0EC6\u0EDC-\u0EDF\u0F00\u0F40-\u0F47\u0F49-\u0F6C\u0F88-\u0F8C\u1000-\u102A\u103F\u1050-\u1055\u105A-\u105D\u1061\u1065\u1066\u106E-\u1070\u1075-\u1081\u108E\u10A0-\u10C5\u10C7\u10CD\u10D0-\u10FA\u10FC-\u1248\u124A-\u124D\u1250-\u1256\u1258\u125A-\u125D\u1260-\u1288\u128A-\u128D\u1290-\u12B0\u12B2-\u12B5\u12B8-\u12BE\u12C0\u12C2-\u12C5\u12C8-\u12D6\u12D8-\u1310\u1312-\u1315\u1318-\u135A\u1380-\u138F\u13A0-\u13F4\u1401-\u166C\u166F-\u167F\u1681-\u169A\u16A0-\u16EA\u16EE-\u16F8\u1700-\u170C\u170E-\u1711\u1720-\u1731\u1740-\u1751\u1760-\u176C\u176E-\u1770\u1780-\u17B3\u17D7\u17DC\u1820-\u1877\u1880-\u18A8\u18AA\u18B0-\u18F5\u1900-\u191E\u1950-\u196D\u1970-\u1974\u1980-\u19AB\u19C1-\u19C7\u1A00-\u1A16\u1A20-\u1A54\u1AA7\u1B05-\u1B33\u1B45-\u1B4B\u1B83-\u1BA0\u1BAE\u1BAF\u1BBA-\u1BE5\u1C00-\u1C23\u1C4D-\u1C4F\u1C5A-\u1C7D\u1CE9-\u1CEC\u1CEE-\u1CF1\u1CF5\u1CF6\u1D00-\u1DBF\u1E00-\u1F15\u1F18-\u1F1D\u1F20-\u1F45\u1F48-\u1F4D\u1F50-\u1F57\u1F59\u1F5B\u1F5D\u1F5F-\u1F7D\u1F80-\u1FB4\u1FB6-\u1FBC\u1FBE\u1FC2-\u1FC4\u1FC6-\u1FCC\u1FD0-\u1FD3\u1FD6-\u1FDB\u1FE0-\u1FEC\u1FF2-\u1FF4\u1FF6-\u1FFC\u2071\u207F\u2090-\u209C\u2102\u2107\u210A-\u2113\u2115\u2119-\u211D\u2124\u2126\u2128\u212A-\u212D\u212F-\u2139\u213C-\u213F\u2145-\u2149\u214E\u2160-\u2188\u2C00-\u2C2E\u2C30-\u2C5E\u2C60-\u2CE4\u2CEB-\u2CEE\u2CF2\u2CF3\u2D00-\u2D25\u2D27\u2D2D\u2D30-\u2D67\u2D6F\u2D80-\u2D96\u2DA0-\u2DA6\u2DA8-\u2DAE\u2DB0-\u2DB6\u2DB8-\u2DBE\u2DC0-\u2DC6\u2DC8-\u2DCE\u2DD0-\u2DD6\u2DD8-\u2DDE\u2E2F\u3005-\u3007\u3021-\u3029\u3031-\u3035\u3038-\u303C\u3041-\u3096\u309D-\u309F\u30A1-\u30FA\u30FC-\u30FF\u3105-\u312D\u3131-\u318E\u31A0-\u31BA\u31F0-\u31FF\u3400-\u4DB5\u4E00-\u9FCC\uA000-\uA48C\uA4D0-\uA4FD\uA500-\uA60C\uA610-\uA61F\uA62A\uA62B\uA640-\uA66E\uA67F-\uA69D\uA6A0-\uA6EF\uA717-\uA71F\uA722-\uA788\uA78B-\uA78E\uA790-\uA7AD\uA7B0\uA7B1\uA7F7-\uA801\uA803-\uA805\uA807-\uA80A\uA80C-\uA822\uA840-\uA873\uA882-\uA8B3\uA8F2-\uA8F7\uA8FB\uA90A-\uA925\uA930-\uA946\uA960-\uA97C\uA984-\uA9B2\uA9CF\uA9E0-\uA9E4\uA9E6-\uA9EF\uA9FA-\uA9FE\uAA00-\uAA28\uAA40-\uAA42\uAA44-\uAA4B\uAA60-\uAA76\uAA7A\uAA7E-\uAAAF\uAAB1\uAAB5\uAAB6\uAAB9-\uAABD\uAAC0\uAAC2\uAADB-\uAADD\uAAE0-\uAAEA\uAAF2-\uAAF4\uAB01-\uAB06\uAB09-\uAB0E\uAB11-\uAB16\uAB20-\uAB26\uAB28-\uAB2E\uAB30-\uAB5A\uAB5C-\uAB5F\uAB64\uAB65\uABC0-\uABE2\uAC00-\uD7A3\uD7B0-\uD7C6\uD7CB-\uD7FB\uF900-\uFA6D\uFA70-\uFAD9\uFB00-\uFB06\uFB13-\uFB17\uFB1D\uFB1F-\uFB28\uFB2A-\uFB36\uFB38-\uFB3C\uFB3E\uFB40\uFB41\uFB43\uFB44\uFB46-\uFBB1\uFBD3-\uFD3D\uFD50-\uFD8F\uFD92-\uFDC7\uFDF0-\uFDFB\uFE70-\uFE74\uFE76-\uFEFC\uFF21-\uFF3A\uFF41-\uFF5A\uFF66-\uFFBE\uFFC2-\uFFC7\uFFCA-\uFFCF\uFFD2-\uFFD7\uFFDA-\uFFDC])(?:[\$0-9A-Z_a-z\xAA\xB5\xBA\xC0-\xD6\xD8-\xF6\xF8-\u02C1\u02C6-\u02D1\u02E0-\u02E4\u02EC\u02EE\u0300-\u0374\u0376\u0377\u037A-\u037D\u037F\u0386\u0388-\u038A\u038C\u038E-\u03A1\u03A3-\u03F5\u03F7-\u0481\u0483-\u0487\u048A-\u052F\u0531-\u0556\u0559\u0561-\u0587\u0591-\u05BD\u05BF\u05C1\u05C2\u05C4\u05C5\u05C7\u05D0-\u05EA\u05F0-\u05F2\u0610-\u061A\u0620-\u0669\u066E-\u06D3\u06D5-\u06DC\u06DF-\u06E8\u06EA-\u06FC\u06FF\u0710-\u074A\u074D-\u07B1\u07C0-\u07F5\u07FA\u0800-\u082D\u0840-\u085B\u08A0-\u08B2\u08E4-\u0963\u0966-\u096F\u0971-\u0983\u0985-\u098C\u098F\u0990\u0993-\u09A8\u09AA-\u09B0\u09B2\u09B6-\u09B9\u09BC-\u09C4\u09C7\u09C8\u09CB-\u09CE\u09D7\u09DC\u09DD\u09DF-\u09E3\u09E6-\u09F1\u0A01-\u0A03\u0A05-\u0A0A\u0A0F\u0A10\u0A13-\u0A28\u0A2A-\u0A30\u0A32\u0A33\u0A35\u0A36\u0A38\u0A39\u0A3C\u0A3E-\u0A42\u0A47\u0A48\u0A4B-\u0A4D\u0A51\u0A59-\u0A5C\u0A5E\u0A66-\u0A75\u0A81-\u0A83\u0A85-\u0A8D\u0A8F-\u0A91\u0A93-\u0AA8\u0AAA-\u0AB0\u0AB2\u0AB3\u0AB5-\u0AB9\u0ABC-\u0AC5\u0AC7-\u0AC9\u0ACB-\u0ACD\u0AD0\u0AE0-\u0AE3\u0AE6-\u0AEF\u0B01-\u0B03\u0B05-\u0B0C\u0B0F\u0B10\u0B13-\u0B28\u0B2A-\u0B30\u0B32\u0B33\u0B35-\u0B39\u0B3C-\u0B44\u0B47\u0B48\u0B4B-\u0B4D\u0B56\u0B57\u0B5C\u0B5D\u0B5F-\u0B63\u0B66-\u0B6F\u0B71\u0B82\u0B83\u0B85-\u0B8A\u0B8E-\u0B90\u0B92-\u0B95\u0B99\u0B9A\u0B9C\u0B9E\u0B9F\u0BA3\u0BA4\u0BA8-\u0BAA\u0BAE-\u0BB9\u0BBE-\u0BC2\u0BC6-\u0BC8\u0BCA-\u0BCD\u0BD0\u0BD7\u0BE6-\u0BEF\u0C00-\u0C03\u0C05-\u0C0C\u0C0E-\u0C10\u0C12-\u0C28\u0C2A-\u0C39\u0C3D-\u0C44\u0C46-\u0C48\u0C4A-\u0C4D\u0C55\u0C56\u0C58\u0C59\u0C60-\u0C63\u0C66-\u0C6F\u0C81-\u0C83\u0C85-\u0C8C\u0C8E-\u0C90\u0C92-\u0CA8\u0CAA-\u0CB3\u0CB5-\u0CB9\u0CBC-\u0CC4\u0CC6-\u0CC8\u0CCA-\u0CCD\u0CD5\u0CD6\u0CDE\u0CE0-\u0CE3\u0CE6-\u0CEF\u0CF1\u0CF2\u0D01-\u0D03\u0D05-\u0D0C\u0D0E-\u0D10\u0D12-\u0D3A\u0D3D-\u0D44\u0D46-\u0D48\u0D4A-\u0D4E\u0D57\u0D60-\u0D63\u0D66-\u0D6F\u0D7A-\u0D7F\u0D82\u0D83\u0D85-\u0D96\u0D9A-\u0DB1\u0DB3-\u0DBB\u0DBD\u0DC0-\u0DC6\u0DCA\u0DCF-\u0DD4\u0DD6\u0DD8-\u0DDF\u0DE6-\u0DEF\u0DF2\u0DF3\u0E01-\u0E3A\u0E40-\u0E4E\u0E50-\u0E59\u0E81\u0E82\u0E84\u0E87\u0E88\u0E8A\u0E8D\u0E94-\u0E97\u0E99-\u0E9F\u0EA1-\u0EA3\u0EA5\u0EA7\u0EAA\u0EAB\u0EAD-\u0EB9\u0EBB-\u0EBD\u0EC0-\u0EC4\u0EC6\u0EC8-\u0ECD\u0ED0-\u0ED9\u0EDC-\u0EDF\u0F00\u0F18\u0F19\u0F20-\u0F29\u0F35\u0F37\u0F39\u0F3E-\u0F47\u0F49-\u0F6C\u0F71-\u0F84\u0F86-\u0F97\u0F99-\u0FBC\u0FC6\u1000-\u1049\u1050-\u109D\u10A0-\u10C5\u10C7\u10CD\u10D0-\u10FA\u10FC-\u1248\u124A-\u124D\u1250-\u1256\u1258\u125A-\u125D\u1260-\u1288\u128A-\u128D\u1290-\u12B0\u12B2-\u12B5\u12B8-\u12BE\u12C0\u12C2-\u12C5\u12C8-\u12D6\u12D8-\u1310\u1312-\u1315\u1318-\u135A\u135D-\u135F\u1380-\u138F\u13A0-\u13F4\u1401-\u166C\u166F-\u167F\u1681-\u169A\u16A0-\u16EA\u16EE-\u16F8\u1700-\u170C\u170E-\u1714\u1720-\u1734\u1740-\u1753\u1760-\u176C\u176E-\u1770\u1772\u1773\u1780-\u17D3\u17D7\u17DC\u17DD\u17E0-\u17E9\u180B-\u180D\u1810-\u1819\u1820-\u1877\u1880-\u18AA\u18B0-\u18F5\u1900-\u191E\u1920-\u192B\u1930-\u193B\u1946-\u196D\u1970-\u1974\u1980-\u19AB\u19B0-\u19C9\u19D0-\u19D9\u1A00-\u1A1B\u1A20-\u1A5E\u1A60-\u1A7C\u1A7F-\u1A89\u1A90-\u1A99\u1AA7\u1AB0-\u1ABD\u1B00-\u1B4B\u1B50-\u1B59\u1B6B-\u1B73\u1B80-\u1BF3\u1C00-\u1C37\u1C40-\u1C49\u1C4D-\u1C7D\u1CD0-\u1CD2\u1CD4-\u1CF6\u1CF8\u1CF9\u1D00-\u1DF5\u1DFC-\u1F15\u1F18-\u1F1D\u1F20-\u1F45\u1F48-\u1F4D\u1F50-\u1F57\u1F59\u1F5B\u1F5D\u1F5F-\u1F7D\u1F80-\u1FB4\u1FB6-\u1FBC\u1FBE\u1FC2-\u1FC4\u1FC6-\u1FCC\u1FD0-\u1FD3\u1FD6-\u1FDB\u1FE0-\u1FEC\u1FF2-\u1FF4\u1FF6-\u1FFC\u200C\u200D\u203F\u2040\u2054\u2071\u207F\u2090-\u209C\u20D0-\u20DC\u20E1\u20E5-\u20F0\u2102\u2107\u210A-\u2113\u2115\u2119-\u211D\u2124\u2126\u2128\u212A-\u212D\u212F-\u2139\u213C-\u213F\u2145-\u2149\u214E\u2160-\u2188\u2C00-\u2C2E\u2C30-\u2C5E\u2C60-\u2CE4\u2CEB-\u2CF3\u2D00-\u2D25\u2D27\u2D2D\u2D30-\u2D67\u2D6F\u2D7F-\u2D96\u2DA0-\u2DA6\u2DA8-\u2DAE\u2DB0-\u2DB6\u2DB8-\u2DBE\u2DC0-\u2DC6\u2DC8-\u2DCE\u2DD0-\u2DD6\u2DD8-\u2DDE\u2DE0-\u2DFF\u2E2F\u3005-\u3007\u3021-\u302F\u3031-\u3035\u3038-\u303C\u3041-\u3096\u3099\u309A\u309D-\u309F\u30A1-\u30FA\u30FC-\u30FF\u3105-\u312D\u3131-\u318E\u31A0-\u31BA\u31F0-\u31FF\u3400-\u4DB5\u4E00-\u9FCC\uA000-\uA48C\uA4D0-\uA4FD\uA500-\uA60C\uA610-\uA62B\uA640-\uA66F\uA674-\uA67D\uA67F-\uA69D\uA69F-\uA6F1\uA717-\uA71F\uA722-\uA788\uA78B-\uA78E\uA790-\uA7AD\uA7B0\uA7B1\uA7F7-\uA827\uA840-\uA873\uA880-\uA8C4\uA8D0-\uA8D9\uA8E0-\uA8F7\uA8FB\uA900-\uA92D\uA930-\uA953\uA960-\uA97C\uA980-\uA9C0\uA9CF-\uA9D9\uA9E0-\uA9FE\uAA00-\uAA36\uAA40-\uAA4D\uAA50-\uAA59\uAA60-\uAA76\uAA7A-\uAAC2\uAADB-\uAADD\uAAE0-\uAAEF\uAAF2-\uAAF6\uAB01-\uAB06\uAB09-\uAB0E\uAB11-\uAB16\uAB20-\uAB26\uAB28-\uAB2E\uAB30-\uAB5A\uAB5C-\uAB5F\uAB64\uAB65\uABC0-\uABEA\uABEC\uABED\uABF0-\uABF9\uAC00-\uD7A3\uD7B0-\uD7C6\uD7CB-\uD7FB\uF900-\uFA6D\uFA70-\uFAD9\uFB00-\uFB06\uFB13-\uFB17\uFB1D-\uFB28\uFB2A-\uFB36\uFB38-\uFB3C\uFB3E\uFB40\uFB41\uFB43\uFB44\uFB46-\uFBB1\uFBD3-\uFD3D\uFD50-\uFD8F\uFD92-\uFDC7\uFDF0-\uFDFB\uFE00-\uFE0F\uFE20-\uFE2D\uFE33\uFE34\uFE4D-\uFE4F\uFE70-\uFE74\uFE76-\uFEFC\uFF10-\uFF19\uFF21-\uFF3A\uFF3F\uFF41-\uFF5A\uFF66-\uFFBE\uFFC2-\uFFC7\uFFCA-\uFFCF\uFFD2-\uFFD7\uFFDA-\uFFDC])*$/

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

export default class
{
	constructor(scriptTarget: ts.ScriptTarget = ts.ScriptTarget.ES5)
	{
		this._scriptTarget = scriptTarget;
	}
	
	private _sourceFiles: ts.SourceFile[];
	private _definitions: as3.PackageLevelDefinition[];
	private _functionAliases: string[];
	private _mappedTypes: string[];
	private _typeAliasMap: any;
	private _typeParameterMap: any;
	private _importModuleStack: any[];
	private _importModuleMap: any;
	private _currentSourceFile: ts.SourceFile;
	private _currentFileIsExternal: boolean;
	private _moduleStack: string[];
	private _currentModuleName: string = null;
	private _variableStatementHasDeclareKeyword: boolean = false;
	private _variableStatementHasExport: boolean = false;
	private _scriptTarget: ts.ScriptTarget;
	private _promoted: { [key: string]: as3.ClassDefinition[] };
	debugLevel: DebugLevel = DebugLevel.NONE;
	
	parse(fileNames: string[]): ParserResult
	{
		this._functionAliases = [];
		this._mappedTypes = [];
		this._typeAliasMap = {};
		this._typeParameterMap = {};
		this._importModuleStack = [];
		this._sourceFiles = [];
		this._promoted = {};
		fileNames.forEach((fileName: string) =>
		{
			this.findSourceFiles(fileName, this._sourceFiles);
		});
		let referencedFileIsStandardLib = this._sourceFiles.some((sourceFile) =>
		{
			return sourceFile.hasNoDefaultLib;
		});
		if(referencedFileIsStandardLib)
		{
			if(this.debugLevel >= DebugLevel.INFO)
			{
				console.info("Referenced files contain a standard library.");
			}
			this._definitions = [];
		}
		else
		{
			if(this.debugLevel >= DebugLevel.INFO)
			{
				console.info("Using default standard library for script target.");
			}
			this.readStandardLibrary();
		}
		let hasIncludedCore = false;
		this._sourceFiles.forEach((sourceFile, index) =>
		{
			//the fileName property of ts.SourceFile may not account for
			//platform path differences, so use path.resolve to normalize
			let sourceFileName = path.resolve(sourceFile.fileName);
			this._currentFileIsExternal = !fileNames.some((fileName) =>
			{
				fileName = path.resolve(fileName); 
				return fileName === sourceFileName;
			});
			this.readSourceFile(sourceFile, !hasIncludedCore && referencedFileIsStandardLib);
			if(referencedFileIsStandardLib)
			{
				hasIncludedCore = true;
			}
		});
		this._sourceFiles.forEach((sourceFile, index) =>
		{
			this._currentFileIsExternal = index !== (this._sourceFiles.length - 1);
			this.populateInheritance(sourceFile);
		});
		this._sourceFiles.forEach((sourceFile, index) =>
		{
			this._currentFileIsExternal = index !== (this._sourceFiles.length - 1);
			this.populatePackageLevelDefinitions(sourceFile);
		});
		this.promoteInterfaces();
		this.cleanupStaticSideDefinitions();
		this.cleanupMembersWithForceStaticFlag();
		this.cleanupInterfaceOverrides();
		this.cleanupClassOverrides();
		this.cleanupMembersWithSameNameAsType();
		this.cleanupMembersWithStaticSideTypes();
		this.cleanupBuiltInTypes();
		return { definitions: this._definitions, hasNoDefaultLib: referencedFileIsStandardLib };
	}
	
	private findStandardLibraryDOM()
	{
		let standardLibDOMPath = require.resolve("typescript");
		standardLibDOMPath = path.dirname(standardLibDOMPath);
		standardLibDOMPath = path.resolve(standardLibDOMPath, "lib.dom.d.ts");
		return standardLibDOMPath;
	}
	
	private findStandardLibrary()
	{
		let standardLibFileName: string;
		switch(this._scriptTarget)
		{
			case ts.ScriptTarget.ES3:
			case ts.ScriptTarget.ES5:
			{
				standardLibFileName = "lib.es5.d.ts";
				break;
			}
			case ts.ScriptTarget.ES2015:
			{
				standardLibFileName = "lib.es2015.d.ts";
				break;
			}
			case ts.ScriptTarget.ES2016:
			{
				standardLibFileName = "lib.es2016.d.ts";
				break;
			}
			case ts.ScriptTarget.ES2017:
			{
				standardLibFileName = "lib.es2017.d.ts";
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
		var standardLibFiles: ts.SourceFile[] = [];
		this.findSourceFiles(standardLibPath, standardLibFiles);
		this.findSourceFiles(this.findStandardLibraryDOM(), standardLibFiles);
		this._definitions = [];
		this._currentFileIsExternal = true;
		standardLibFiles.forEach((sourceFile, index) =>
		{
			//the fileName property of ts.SourceFile may not account for
			//platform path differences, so use path.resolve to normalize
			let sourceFileName = path.resolve(sourceFile.fileName);
			this.readSourceFile(sourceFile, index === 0);
		});
		standardLibFiles.forEach((sourceFile, index) =>
		{
			this.populateInheritance(sourceFile);
		});
		standardLibFiles.forEach((sourceFile, index) =>
		{
			this.populatePackageLevelDefinitions(sourceFile);
		});
		this.promoteInterfaces();
	}
	
	private sourceFileExists(fileName: string)
	{
		return this._sourceFiles.some((otherSourceFile) =>
		{
			//the fileName property of a ts.SourceFile object may not use the
			//path conventions of the current platform (Windows, in particular),
			//so we pass it to path.resolve() to normalize
			return path.resolve(otherSourceFile.fileName) === fileName;
		});
	}
	
	private findSourceFiles(fileName: string, result: ts.SourceFile[])
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
			this.findSourceFiles(fileName, result);
		});
		result.push(sourceFile);
	}
	
	private readSourceFile(sourceFile: ts.SourceFile, includeCore: boolean)
	{
		this._moduleStack = [];
		if(includeCore)
		{
			let as3SourceFile = "playerglobal.swc";
			
			//these are special types that are defined by the language, and
			//they don't appear in the standard library. we need to add them
			//manually.
			let as3NamespaceDefinition = new as3.NamespaceDefinition("AS3", "", as3.AccessModifiers[as3.AccessModifiers.public], "http://adobe.com/AS3/2006/builtin", as3SourceFile, null, this._currentFileIsExternal);
			this._definitions.push(as3NamespaceDefinition);
			let starDefinition = new as3.InterfaceDefinition("*", null, null, null, null, this._currentFileIsExternal);
			this._definitions.push(starDefinition);
			let voidDefinition = new as3.InterfaceDefinition("void", null, null, null, null, this._currentFileIsExternal);
			this._definitions.push(voidDefinition);
			let intDefinition = new as3.ClassDefinition("int", "", as3.AccessModifiers[as3.AccessModifiers.public], as3SourceFile, null, this._currentFileIsExternal);
			this._definitions.push(intDefinition);
			let uintDefinition = new as3.ClassDefinition("uint", "", as3.AccessModifiers[as3.AccessModifiers.public], as3SourceFile, null, this._currentFileIsExternal);
			this._definitions.push(uintDefinition);
			let undefinedDefinition = new as3.PackageVariableDefinition("undefined", "", as3.AccessModifiers[as3.AccessModifiers.public], as3SourceFile, null, this._currentFileIsExternal);
			undefinedDefinition.isConstant = true;
			this._definitions.push(undefinedDefinition);
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
	
	private isValidMemberName(memberName: string): boolean
	{
		if(invalidNameRegExp.test(memberName))
		{
			return false;
		}
		return identifierNameRegExp.test(memberName);
	}
	
	private mergeFunctionParameters(as3Function: as3.FunctionDefinition, parametersToMerge: as3.ParameterDefinition[])
	{
		let parametersToKeep = as3Function.parameters;
		if(!parametersToKeep)
		{
			as3Function.parameters = parametersToMerge;
			return;
		}
		let methodToKeepParamsCount = parametersToKeep.length;
		let parametersToMergeCount = parametersToMerge.length;
		let paramCount = Math.max(methodToKeepParamsCount, parametersToMergeCount);
		let mustBeOptional: boolean = false;
		for(let j = 0; j < paramCount; j++)
		{
			let paramToMerge: as3.ParameterDefinition = null;
			if(parametersToMergeCount > j)
			{
				paramToMerge = parametersToMerge[j];
			}
			else
			{
				mustBeOptional = true;
			}
			if(methodToKeepParamsCount <= j)
			{
				mustBeOptional = true;
				parametersToKeep[j] = paramToMerge;
			}
			let paramToKeep = parametersToKeep[j];
			if(paramToKeep.isRest)
			{
				//we already have a ...rest argument, and that must be the last
				//one so, we can ignore the rest of the parameters to merge
				break;
			}
			if(paramToMerge)
			{
				if(paramToMerge.isRest)
				{
					//the parameters to merge have a ...rest argument earlier than
					//what we have already, so we need to remove any remaining
					//arguments so that the ...rest is the last argument
					
					//we don't know if the name is relevant, so let's go generic
					paramToMerge.name = "rest";
					parametersToKeep.length = j;
					parametersToKeep[j] = paramToMerge;

					//no more parameters after a rest argument!
					break;
				}
				if(paramToKeep.value || paramToMerge.value)
				{
					mustBeOptional = true;
				}
				let mergeName = paramToMerge.name;
				if(paramToKeep.name !== mergeName)
				{
					paramToKeep.name += "Or" + mergeName.substr(0, 1).toUpperCase();
					if(mergeName.length > 1)
					{
						paramToKeep.name += mergeName.substr(1);
					}
				}
				paramToKeep.type = this.mergeTypes(paramToKeep.type, paramToMerge.type);
			}
			if(mustBeOptional && !paramToKeep.value && !paramToKeep.isRest)
			{
				paramToKeep.value = "undefined";
			}
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
				case ts.SyntaxKind.IntersectionType:
				{
					let unionType = <ts.UnionTypeNode> type;
					let commonBaseClass = this.getCommonBaseClassFromUnionOrIntersectionType(unionType);
					if(commonBaseClass !== null)
					{
						return commonBaseClass;
					}
					fullyQualifiedName = as3.BuiltIns[as3.BuiltIns.Object];
					break;
				}
				case ts.SyntaxKind.LiteralType:
				{
					let literalType = <ts.LiteralTypeNode> type;
					switch(literalType.literal.kind)
					{
						case ts.SyntaxKind.StringLiteral:
						{
							//variable: "some value";
							fullyQualifiedName = as3.BuiltIns[as3.BuiltIns.String];
							break;
						}
						case ts.SyntaxKind.NumericLiteral:
						{

							//variable: 1234;
							fullyQualifiedName = as3.BuiltIns[as3.BuiltIns.Number];
							break;
						}
						case ts.SyntaxKind.TrueKeyword:
						{

							//variable: true;
							fullyQualifiedName = as3.BuiltIns[as3.BuiltIns.Boolean];
							break;
						}
						case ts.SyntaxKind.FalseKeyword:
						{
							//variable: false;
							fullyQualifiedName = as3.BuiltIns[as3.BuiltIns.Boolean];
							break;
						}
						default:
						{
							if(this.debugLevel >= DebugLevel.WARN && !this._currentFileIsExternal)
							{
								console.warn("Unknown literal type: " + literalType.literal.kind);
							}
						}
					}
					break;
				}
				case ts.SyntaxKind.IndexedAccessType:
				{
					//variable: SomeType[K];
					fullyQualifiedName = as3.BuiltIns[as3.BuiltIns.String];
					break;
				}
				case ts.SyntaxKind.TypeLiteral:
				{
					//variable: {};
					fullyQualifiedName = as3.BuiltIns[as3.BuiltIns.Object];
					break;
				}
				case ts.SyntaxKind.ObjectKeyword:
				{
					//variable: object;
					fullyQualifiedName = as3.BuiltIns[as3.BuiltIns.Object];
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
		if(fullyQualifiedName !== null)
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
			let startArrayIndex = typeInSource.indexOf("[");
			if(startArrayIndex === 0)
			{
				typeInSource = typeInSource.substr(1, endArrayIndex - 1);
			}
			else if(startArrayIndex === (endArrayIndex - 1))
			{
				typeInSource = typeInSource.substr(0, startArrayIndex);
			}
		}
		return typeInSource;
	}
	
	private unmapType(type: ts.TypeNode): ts.TypeNode
	{
		let typeInSource = this.simplifyTypeNode(type);
		while(this._mappedTypes.indexOf(typeInSource) !== -1)
		{
			let typeReference = type as ts.TypeReferenceNode;
			type = typeReference.typeArguments[0];
			typeInSource = this.simplifyTypeNode(type);
		}
		return type;
	}
	
	private getAS3FullyQualifiedNameFromTSTypeNode(type: ts.TypeNode): string
	{
		let result = this.getAS3TypeFromTypeNodeKind(type);
		if(result !== null)
		{
			return result.getFullyQualifiedName();
		}
		type = this.unmapType(type);
		result = this.getAS3TypeFromTypeNodeKind(type);
		if(result !== null)
		{
			return result.getFullyQualifiedName();
		}
		
		let typeInSource = this.simplifyTypeNode(type);
		if(typeInSource in this._typeParameterMap)
		{
			typeInSource = this._typeParameterMap[typeInSource];
		}
		while(typeInSource in this._typeAliasMap)
		{
			typeInSource = this._typeAliasMap[typeInSource];
		}
		let packageName = this.getCamelCasePackage(this._moduleStack.join("."));
		if(packageName)
		{
			let typeInSourceWithPackage = packageName + "." + typeInSource;
			while(typeInSourceWithPackage in this._typeAliasMap)
			{
				typeInSourceWithPackage = this._typeAliasMap[typeInSourceWithPackage];
				typeInSource = typeInSourceWithPackage;
			}
		}
		for(let moduleAlias in this._importModuleMap)
		{
			if(typeInSource.indexOf(moduleAlias) === 0)
			{
				let alias = this._importModuleMap[moduleAlias];
				typeInSource = alias + typeInSource.substr(moduleAlias.length);
			}
		}
		this._importModuleStack.some((importModuleMap) =>
		{			
			for(let moduleAlias in importModuleMap)
			{
				if(typeInSource.indexOf(moduleAlias) === 0)
				{
					let alias = importModuleMap[moduleAlias];
					typeInSource = alias + typeInSource.substr(moduleAlias.length);
					return true;
				}
			}
			return false;
		});
		var moduleStack = this._moduleStack.slice();
		while(moduleStack.length > 0)
		{
			let packageName = this.getCamelCasePackage(moduleStack.join("."));
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
		if(PRIMITIVE_TO_CLASS_TYPE_MAP.hasOwnProperty(typeInSource))
		{
			return PRIMITIVE_TO_CLASS_TYPE_MAP[typeInSource];
		}
		return typeInSource;
	}
	
	private getAS3TypeFromTSTypeNode(type: ts.TypeNode, as3Type?: as3.TypeDefinition): as3.TypeDefinition
	{
		let typeName = as3.BuiltIns[as3.BuiltIns.void];
		if(type)
		{
			typeName = this.getAS3FullyQualifiedNameFromTSTypeNode(type);
			if(as3Type && typeName === "this")
			{
				return as3Type;
			}
		}
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
		
	private addConstructorMethodToAS3Class(as3Class: as3.ClassDefinition, constructorMethodToAdd: as3.ConstructorDefinition)
	{
		if(as3Class.constructorMethod)
		{
			this.mergeFunctionParameters(as3Class.constructorMethod,
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
		let existingMethod = as3Type.getMethod(methodToAdd.name, methodToAdd.isStatic);
		if(existingMethod !== null)
		{
			return;
		}
		//otherwise, add the new method
		as3Type.methods.push(methodToAdd);
	}
	
	private handleModuleBlock(node: ts.Node, handleImportAndExport: boolean, callback: (node: ts.Node) => void)
	{	
		this._importModuleStack.push(this._importModuleMap);
		this._importModuleMap = {};
		ts.forEachChild(node, (node) =>
		{
			if(node.kind === ts.SyntaxKind.ImportDeclaration)
			{
				if(handleImportAndExport)
				{
					let importDeclaration = <ts.ImportDeclaration> node;
					this.populateImport(importDeclaration);
				}
				return;
			}
			if(node.kind === ts.SyntaxKind.ImportEqualsDeclaration)
			{
				if(handleImportAndExport)
				{
					let importEqualsDeclaration = <ts.ImportEqualsDeclaration> node;
					this.populateImportEquals(importEqualsDeclaration);
				}
				return;
			}
			if(node.kind === ts.SyntaxKind.ExportAssignment)
			{
				if(handleImportAndExport)
				{
					let exportAssignment = <ts.ExportAssignment> node;
					this.assignExport(exportAssignment);
				}
				return;
			}
			if(node.kind === ts.SyntaxKind.TypeAliasDeclaration)
			{
				let typeAliasDeclaration = <ts.TypeAliasDeclaration> node;
				let aliasName = this.declarationNameToString(typeAliasDeclaration.name);
				let packageName = this.getCamelCasePackage(this._moduleStack.join("."));
				if(packageName)
				{
					aliasName = packageName + "." + aliasName;
				}
				let typeNode = typeAliasDeclaration.type;
				let aliasType = this.getAS3TypeFromTSTypeNode(typeNode);
				if(aliasType)
				{
					//populate the alias, if possible. otherwise, wait for the
					//next pass. this isn't ideal, but it's actuall possible
					//for an alias to reference another alias that hasn't been
					//parsed yet! we try over multiple passes to get them all.
					this._typeAliasMap[aliasName] = aliasType.getFullyQualifiedName();
				}
				return;
			}
			callback.call(this, node);
		});
		//clear imported modules after we're done with this module
		this._importModuleMap = this._importModuleStack.pop();
	}
	
	private handleModuleDeclaration(node: ts.Node, callback: (node: ts.Node) => void)
	{	
		let moduleDeclaration = <ts.ModuleDeclaration> node;
		let moduleName = moduleDeclaration.name;
		this._moduleStack.push(this.declarationNameToString(moduleName));
		let previousModuleName: string = this._currentModuleName;
		if(moduleName.kind === ts.SyntaxKind.StringLiteral)
		{
			this._currentModuleName = this.declarationNameToString(moduleName);
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
			callback.call(this, node);
		});
		this._moduleStack.pop();
		this._currentModuleName = previousModuleName;
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
					if(node.kind === ts.SyntaxKind.TypeAliasDeclaration)
					{
						let typeAliasDeclaration = <ts.TypeAliasDeclaration> node;
						if(typeAliasDeclaration.type.kind === ts.SyntaxKind.MappedType)
						{
							let mappedTypeName = this.declarationNameToString(typeAliasDeclaration.name);
							this._mappedTypes.push(mappedTypeName);
						}
						//safe to ignore other type aliases until later
						return;
					}
					if(node.kind === ts.SyntaxKind.ImportEqualsDeclaration)
					{
						//safe to ignore imports until later
						return;
					}
					this.readPackageLevelDefinitions(node);
				});
				break;
			}
			case ts.SyntaxKind.ModuleBlock:
			{
				this.handleModuleBlock(node, false, this.readPackageLevelDefinitions);
				break;
			}
			case ts.SyntaxKind.ModuleDeclaration:
			{
				this.handleModuleDeclaration(node, this.readPackageLevelDefinitions);
				break;
			}
			case ts.SyntaxKind.FunctionDeclaration:
			{
				let as3PackageFunction = this.readPackageFunction(<ts.FunctionDeclaration> node);
				//if the function already exists, readPackageFunction() will return null
				if(as3PackageFunction)
				{
					if(this.debugLevel >= DebugLevel.INFO && !as3PackageFunction.external)
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
					if(this.debugLevel >= DebugLevel.INFO && !as3PackageVariable.external)
					{
						console.info("Package Variable: " + as3PackageVariable.getFullyQualifiedName());
					}
					this._definitions.push(as3PackageVariable);
				}
				else 
				{
					let nodeName = (<ts.VariableDeclaration> node).name;
					let className = this.declarationNameToString(nodeName);
					let packageName = this.getCamelCasePackage(this._moduleStack.join("."));
					if(packageName)
					{
						className = packageName + "." + className;
					}
					let as3Class = as3.getDefinitionByName(className, this._definitions);
					if(this.debugLevel >= DebugLevel.INFO && !as3Class.external)
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
					if(this.debugLevel >= DebugLevel.INFO && !as3Interface.external)
					{
						console.info("Replace Interface with Static-side Class: " + as3Interface.getFullyQualifiedName());
					}
					this._definitions.push(as3Interface);
				}
				else if(as3Interface instanceof as3.InterfaceDefinition)
				{
					if(this.debugLevel >= DebugLevel.INFO && !as3Interface.external)
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
				if(this.debugLevel >= DebugLevel.INFO && !as3Class.external)
				{
					console.info("Class: " + as3Class.getFullyQualifiedName());
				}
				this._definitions.push(as3Class);
				break;
			}
			case ts.SyntaxKind.EnumDeclaration:
			{
				let as3Class = this.readEnum(<ts.EnumDeclaration> node);
				if(this.debugLevel >= DebugLevel.INFO && !as3Class.external)
				{
					console.info("Enum: " + as3Class.getFullyQualifiedName());
				}
				this._definitions.push(as3Class);
				break;
			}
			default:
			{
				if(this.debugLevel >= DebugLevel.WARN && !this._currentFileIsExternal)
				{
					console.warn("Unknown SyntaxKind while reading package-level definitions: " + node.kind.toString());
					console.warn(this._currentSourceFile.text.substring(node.pos, node.end));
				}
				break;
			}
		}
	}
	
	private copyMembers(fromType: as3.TypeDefinition, toType: as3.TypeDefinition, makeStatic: boolean)
	{
		fromType.properties.forEach((property) =>
		{
			let propertyName = property.name;
			let isStatic = property.isStatic;
			let existingProperty = toType.getProperty(propertyName, isStatic);
			if(existingProperty !== null)
			{
				let existingType = existingProperty.type;
				if(existingType !== null)
				{
					existingProperty.type = this.mergeTypes(existingProperty.type, property.type);
				}
				else
				{
					existingProperty.type = property.type;
				}
				return;
			}
			let accessLevel = property.accessLevel;
			if(makeStatic)
			{
				accessLevel = as3.AccessModifiers[as3.AccessModifiers.public];
			}
			property.accessLevel = accessLevel;
			(<ParserPropertyDefinition> property).forceStatic = makeStatic;
			toType.properties.push(property);
		});
		fromType.methods.forEach((method) =>
		{
			let methodName = method.name;
			let isStatic = method.isStatic;
			let existingMethod = toType.getMethod(methodName, isStatic);
			if(existingMethod !== null)
			{
				this.mergeFunctionParameters(existingMethod, method.parameters);
				let existingType = existingMethod.type;
				if(existingType !== null)
				{
					existingMethod.type = this.mergeTypes(existingMethod.type, method.type);
				}
				else
				{
					existingMethod.type = method.type;
				}
				return;
			}
			let accessLevel = method.accessLevel;
			if(makeStatic)
			{
				accessLevel = as3.AccessModifiers[as3.AccessModifiers.public];
			}
			method.accessLevel = accessLevel;
			(<ParserMethodDefinition> method).forceStatic = makeStatic;
			toType.methods.push(method);
		});
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
			exportedDefinition.moduleName = this._currentModuleName;
		}
		else
		{
			let currentStack = this.getCamelCasePackage(this._moduleStack.join("."));
			let innerModule = assignedIdentifier;
			if(currentStack.length > 0)
			{
				innerModule = currentStack + "." + innerModule; 
			}
			this._definitions.forEach((definition) =>
			{
				let name = definition.name;
				let packageName = definition.packageName;
				if(name === assignedIdentifier && packageName === currentStack)
				{
					definition.packageName = "";
					definition.name = this._currentModuleName;
					definition.moduleName = this._currentModuleName;
				}
				else if(packageName !== null &&
					packageName.indexOf(innerModule) === 0)
				{
					definition.packageName = packageName.replace(innerModule, currentStack);
					definition.moduleName = this._currentModuleName;
				}
			});
		}
	}
	
	private populateImportEquals(importEqualsDeclaration: ts.ImportEqualsDeclaration)
	{
		let importName = this.declarationNameToString(importEqualsDeclaration.name);
		let moduleReference = importEqualsDeclaration.moduleReference;
		let moduleName = this.declarationNameToString(<ts.Identifier> moduleReference);
		this._importModuleMap[importName] = moduleName;
	}	
	
	private populateImport(importDeclaration: ts.ImportDeclaration)
	{
		if(!importDeclaration.importClause)
		{
			return;
		}
		let moduleSpecifier = importDeclaration.moduleSpecifier;
		let moduleName = this.declarationNameToString(moduleSpecifier as ts.Identifier);
		let namedBindings = importDeclaration.importClause.namedBindings;
		if("name" in namedBindings)
		{
			let nsImport = <ts.NamespaceImport> namedBindings
			let moduleAlias = this.declarationNameToString(nsImport.name);
			this._importModuleMap[moduleAlias] = moduleName;
		}
		else if(this.debugLevel >= DebugLevel.WARN)
		{
			console.warn("Warning: Unable to parse import declaration.");
			console.warn(this._currentSourceFile.text.substring(importDeclaration.pos, importDeclaration.end));
		}
	}
	
	private populateInheritance(node: ts.Node)
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
					if(node.kind === ts.SyntaxKind.ImportEqualsDeclaration)
					{
						//safe to ignore source file imports during this phase
						return;
					}
					this.populateInheritance(node);
				});
				break;
			}
			case ts.SyntaxKind.ModuleBlock:
			{
				this.handleModuleBlock(node, false, this.populateInheritance);
				break;
			}
			case ts.SyntaxKind.ModuleDeclaration:
			{
				this.handleModuleDeclaration(node, this.populateInheritance);
				break;
			}
			case ts.SyntaxKind.InterfaceDeclaration:
			{
				this.populateInterfaceInheritance(<ts.InterfaceDeclaration> node);
				break;
			}
			case ts.SyntaxKind.ClassDeclaration:
			{
				this.populateClassInheritance(<ts.ClassDeclaration> node);
				break;
			}
			case ts.SyntaxKind.VariableStatement:
			case ts.SyntaxKind.VariableDeclarationList:
			case ts.SyntaxKind.FunctionDeclaration:
			case ts.SyntaxKind.EnumDeclaration:
			{
				//no inheritance to populate for these, so we wait until the
				//next pass
				break;
			}
			case ts.SyntaxKind.TypeAliasDeclaration:
			{
				let typeAliasDeclaration = <ts.TypeAliasDeclaration> node;
				let aliasName = this.declarationNameToString(typeAliasDeclaration.name);
				let packageName = this.getCamelCasePackage(this._moduleStack.join("."));
				if(packageName)
				{
					aliasName = packageName + "." + aliasName;
				}
				let typeNode = typeAliasDeclaration.type;
				if(typeNode.kind !== ts.SyntaxKind.MappedType)
				{
					let aliasType = this.getAS3TypeFromTSTypeNode(typeNode);
					this._typeAliasMap[aliasName] = aliasType.getFullyQualifiedName();
					if(this.debugLevel >= DebugLevel.INFO && !this._currentFileIsExternal)
					{
						console.info("Creating type alias from " + aliasName + " to " + aliasType.getFullyQualifiedName() + ".");
					}
				}
				break;
			}
			default:
			{
				if(this.debugLevel >= DebugLevel.WARN && !this._currentFileIsExternal)
				{
					console.warn("Unknown SyntaxKind while populating inheritance: " + node.kind.toString());
					console.warn(this._currentSourceFile.text.substring(node.pos, node.end));
				}
				break;
			}
		}
	}
	
	private populatePackageLevelDefinitions(node: ts.Node)
	{
		switch(node.kind)
		{
			case ts.SyntaxKind.SourceFile:
			{
				this._importModuleMap = {};
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
						//we already handled type aliases in populateInheritance()
						return;
					}
					if(node.kind === ts.SyntaxKind.ImportEqualsDeclaration)
					{
						this.populateImportEquals(<ts.ImportEqualsDeclaration> node);
						return;
					}
					this.populatePackageLevelDefinitions(node);
				});
				this._importModuleMap = null;
				break;
			}
			case ts.SyntaxKind.ModuleBlock:
			{
				this.handleModuleBlock(node, true, this.populatePackageLevelDefinitions);
				break;
			}
			case ts.SyntaxKind.ModuleDeclaration:
			{
				this.handleModuleDeclaration(node, this.populatePackageLevelDefinitions);
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
				this.populateInterfaceMembers(<ts.InterfaceDeclaration> node);
				break;
			}
			case ts.SyntaxKind.ClassDeclaration:
			{
				this.populateClassMembers(<ts.ClassDeclaration> node);
				break;
			}
			case ts.SyntaxKind.EnumDeclaration:
			{
				this.populateEnumMembers(<ts.EnumDeclaration> node);
				break;
			}
			default:
			{
				if(this.debugLevel >= DebugLevel.WARN && !this._currentFileIsExternal)
				{
					console.warn("Unknown SyntaxKind while populating members: " + node.kind.toString());
					console.warn(this._currentSourceFile.text.substring(node.pos, node.end));
				}
				break;
			}
		}
	}
	
	private readMembers(typeDefinition: as3.TypeDefinition, declaration: ts.ClassDeclaration|ts.InterfaceDeclaration|ts.TypeLiteralNode|ts.EnumDeclaration)
	{
		let members: Array<ts.Declaration> = declaration.members;
		members.forEach((member: ts.Declaration) =>
		{
			this.readMember(member, typeDefinition);
		});
	}
	
	private populateMembers(typeDefinition: as3.TypeDefinition, declaration: ts.ClassDeclaration|ts.InterfaceDeclaration|ts.TypeLiteralNode|ts.EnumDeclaration)
	{
		let members: Array<ts.Declaration> = declaration.members;
		members.forEach((member: ts.Declaration) =>
		{
			this.populateMember(member, typeDefinition);
		});
	}
	
	private mergeInterfaceAndVariable(interfaceDefinition: as3.InterfaceDefinition, variableDefinition: as3.PackageVariableDefinition)
	{
		let as3Class = new as3.ClassDefinition(interfaceDefinition.name,
			interfaceDefinition.packageName, variableDefinition.accessLevel,
			interfaceDefinition.sourceFile, interfaceDefinition.moduleName,
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
	
	private populateTypeParameters(declaration: ts.Declaration)
	{
		let names: string[] = [];
		let restore = {};
		
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
				if(this.debugLevel >= DebugLevel.INFO && !this._currentFileIsExternal)
				{
					let declarationName = null;
					if(declaration.name === undefined)
					{
						declarationName = "a constructor";
					}
					else
					{
						declarationName = this.declarationNameToString(declaration.name);
					}
					console.info("Mapping type parameter " + typeParameterName + " to " + as3TypeName + " in " + declarationName + ".");
				}
				if(typeParameterName in this._typeParameterMap)
				{
					//we need to restore this value later because it was
					//already defined before this declaration
					restore[typeParameterName] = this._typeParameterMap[typeParameterName];
				}
				this._typeParameterMap[typeParameterName] = as3TypeName;
				names.push(typeParameterName);
			}
		});
		
		return {names: names, restore: restore};
	}
	
	private cleanupTypeParameters(typeParameters: any)
	{
		let names = typeParameters.names;
		for(let param of names)
		{
			delete this._typeParameterMap[param];
		}
		let restore = typeParameters.restore;
		for(let param in restore)
		{
			this._typeParameterMap[param] = restore[param];
		}
	}
	
	private getCamelCasePackage(moduleName: string): string
	{
		let camelCasePackage = moduleName;
		let moduleIndex = camelCasePackage.indexOf("-");
		while (moduleIndex != -1 && moduleIndex < camelCasePackage.length - 1)
		{
			camelCasePackage = camelCasePackage.substring(0, moduleIndex)
					+ camelCasePackage.substring(moduleIndex + 1, moduleIndex + 2).toUpperCase()
					+ camelCasePackage.substring(moduleIndex + 2);
			moduleIndex = camelCasePackage.indexOf("-");
		}
		return camelCasePackage;
	}
	
	private readClass(classDeclaration: ts.ClassDeclaration): as3.ClassDefinition
	{
		let className = this.declarationNameToString(classDeclaration.name);
		let packageName = this.getCamelCasePackage(this._moduleStack.join("."));
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
		let as3Class = new as3.ClassDefinition(className, packageName, as3.AccessModifiers[as3.AccessModifiers.public], this._currentSourceFile.fileName, this._currentModuleName, this._currentFileIsExternal);
		this.readMembers(as3Class, classDeclaration);
		return as3Class;
	}
	
	private populateClassInheritance(classDeclaration: ts.ClassDeclaration)
	{
		let className = this.declarationNameToString(classDeclaration.name);
		let packageName = this.getCamelCasePackage(this._moduleStack.join("."));
		let fullyQualifiedClassName = className;
		if(packageName.length > 0)
		{
			fullyQualifiedClassName = packageName + "." + className;
		}
		
		let as3Class = <as3.ClassDefinition> as3.getDefinitionByName(fullyQualifiedClassName, this._definitions);
		if(!as3Class)
		{
			throw new Error("Class not found when trying to populate inheritance: " + fullyQualifiedClassName);
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
							if(this.debugLevel >= DebugLevel.WARN && !superClass.external)
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
								if(this.debugLevel >= DebugLevel.WARN && !as3Interface.external)
								{
									console.warn("Warning: Class " + fullyQualifiedClassName + " implements non-interface " + as3Interface.getFullyQualifiedName() + ", but this is not allowed in ActionScript.");
								}
							}
							else
							{
								//this is a bug in dts2as, and we warn the user that something went
								//wrong, but we continue anyway because the output may still be
								//useful, even if not complete
								console.error("Error: Interface " + this.getAS3FullyQualifiedNameFromTSTypeNode(type) + " not found for " + fullyQualifiedClassName + " to implement.");
							}
						});
						break;
					}
				}
			});
		}
		
		this.cleanupTypeParameters(typeParameters);
	}
	
	private populateClassMembers(classDeclaration: ts.ClassDeclaration)
	{
		let className = this.declarationNameToString(classDeclaration.name);
		let packageName = this.getCamelCasePackage(this._moduleStack.join("."));
		let fullyQualifiedClassName = className;
		if(packageName.length > 0)
		{
			fullyQualifiedClassName = packageName + "." + className;
		}
		
		let as3Class = <as3.ClassDefinition> as3.getDefinitionByName(fullyQualifiedClassName, this._definitions);
		if(!as3Class)
		{
			throw new Error("Class not found when trying to populate members: " + fullyQualifiedClassName);
		}
		
		let typeParameters = this.populateTypeParameters(classDeclaration);
		this.populateMembers(as3Class, classDeclaration);
		this.cleanupTypeParameters(typeParameters);
	}
	
	private readInterface(interfaceDeclaration: ts.InterfaceDeclaration): as3.InterfaceDefinition
	{
		let interfaceName = this.declarationNameToString(interfaceDeclaration.name);
		let packageName = this.getCamelCasePackage(this._moduleStack.join("."));
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
			if(this.debugLevel >= DebugLevel.INFO && !this._currentFileIsExternal)
			{
				console.info("Creating function alias from " + fullyQualifiedInterfaceName + ".");
			}
			return null;
		}
		let existingDefinition = as3.getDefinitionByName(fullyQualifiedInterfaceName, this._definitions);
		if(hasConstructSignature)
		{
			//if the interface defines a constructor, it is the static side of a
			//decomposed class
			if(existingDefinition instanceof StaticSideClassDefinition)
			{
				//the static-side class already exists, so we need to add
				//the new members
				this.readMembers(existingDefinition, interfaceDeclaration);
				return null;
			}
			let staticSideClass = new StaticSideClassDefinition(interfaceName, packageName, as3.AccessModifiers[as3.AccessModifiers.internal], this._currentSourceFile.fileName, this._currentModuleName);
			this.readMembers(staticSideClass, interfaceDeclaration);
			if(existingDefinition instanceof as3.InterfaceDefinition)
			{
				//an interface already exists, and we need to turn it into a
				//static side class
				this.copyMembers(existingDefinition, staticSideClass, true);
				
				let index = this._definitions.indexOf(existingDefinition);
				this._definitions[index] = staticSideClass;
				return null;
			}
			return staticSideClass;
		}
		
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
		
		let as3Interface = new as3.InterfaceDefinition(interfaceName, packageName, as3.AccessModifiers[as3.AccessModifiers.public], this._currentSourceFile.fileName, this._currentModuleName, this._currentFileIsExternal);
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
	
	private populateInterfaceInheritance(interfaceDeclaration: ts.InterfaceDeclaration)
	{
		let interfaceName = this.declarationNameToString(interfaceDeclaration.name);
		let packageName = this.getCamelCasePackage(this._moduleStack.join("."));
		let fullyQualifiedInterfaceName = interfaceName;
		if(packageName.length > 0)
		{
			fullyQualifiedInterfaceName = packageName + "." + interfaceName;
		}
		if(this._functionAliases.indexOf(fullyQualifiedInterfaceName) >= 0)
		{
			//this is a function alias, which is not treated as an interface
			//in ActionScript
			return;
		}
		
		//an interface may have been converted into a class,
		//so that's why the superclass of InterfaceDefinition
		//and ClassDefinition is used here.
		let existingInterface = <as3.TypeDefinition> as3.getDefinitionByName(fullyQualifiedInterfaceName, this._definitions);
		if(!existingInterface)
		{
			throw new Error("Interface not found when trying to populate inheritance: " + fullyQualifiedInterfaceName);
		}
		
		let typeParameters = this.populateTypeParameters(interfaceDeclaration);
		
		//it could be a StaticSideClassDefinition instead
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
							(existingInterface as as3.InterfaceDefinition).interfaces.push(otherInterface);
						}
						else if(otherInterface !== null &&
							otherInterface.getFullyQualifiedName() === as3.BuiltIns[as3.BuiltIns.Object])
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
							if(this.debugLevel >= DebugLevel.WARN && !existingInterface.external)
							{
								console.warn("Warning: Interface " + fullyQualifiedInterfaceName + " extends non-interface " + otherInterface.getFullyQualifiedName() + ", but this is not allowed in ActionScript.");
							}
						}
						else
						{
							//this is a bug in dts2as, and we warn the user that something went
							//wrong, but we continue anyway because the output may still be
							//useful, even if not complete
							console.error("Error: Interface " + this.getAS3FullyQualifiedNameFromTSTypeNode(type) + " not found for " + fullyQualifiedInterfaceName + " to extend.");
						}
					});
				});
			}
		}
		this.cleanupTypeParameters(typeParameters);
	}
	
	private populateInterfaceMembers(interfaceDeclaration: ts.InterfaceDeclaration)
	{
		let interfaceName = this.declarationNameToString(interfaceDeclaration.name);
		let packageName = this.getCamelCasePackage(this._moduleStack.join("."));
		let fullyQualifiedInterfaceName = interfaceName;
		if(packageName.length > 0)
		{
			fullyQualifiedInterfaceName = packageName + "." + interfaceName;
		}
		if(this._functionAliases.indexOf(fullyQualifiedInterfaceName) >= 0)
		{
			//this is a function alias, which is not treated as an interface
			//in ActionScript
			return;
		}
		
		//an interface may have been converted into a class,
		//so that's why the superclass of InterfaceDefinition
		//and ClassDefinition is used here.
		let existingInterface = <as3.TypeDefinition> as3.getDefinitionByName(fullyQualifiedInterfaceName, this._definitions);
		if(!existingInterface)
		{
			throw new Error("Interface not found when trying to populate members: " + fullyQualifiedInterfaceName);
		}
		
		let typeParameters = this.populateTypeParameters(interfaceDeclaration);
		this.populateMembers(existingInterface, interfaceDeclaration);
		this.cleanupTypeParameters(typeParameters);
	}
	
	private readEnum(enumDeclaration: ts.EnumDeclaration): as3.ClassDefinition
	{
		let enumName = this.declarationNameToString(enumDeclaration.name);
		let packageName = this.getCamelCasePackage(this._moduleStack.join("."));
		let fullyQualifiedEnumName = enumName;
		if(packageName.length > 0)
		{
			fullyQualifiedEnumName = packageName + "." + enumName;
		}
		
		let existingDefinition = as3.getDefinitionByName(fullyQualifiedEnumName, this._definitions);
		if(existingDefinition !== null)
		{
			throw new Error("Definition with name " + fullyQualifiedEnumName + " already exists. Cannot create class for enum.");
		}
		let as3Class = new as3.ClassDefinition(enumName, packageName, as3.AccessModifiers[as3.AccessModifiers.public], this._currentSourceFile.fileName, this._currentModuleName, this._currentFileIsExternal);
		this.readMembers(as3Class, enumDeclaration);
		return as3Class;
	}
	
	private populateEnumMembers(enumDeclaration: ts.EnumDeclaration)
	{
		let enumName = this.declarationNameToString(enumDeclaration.name);
		let packageName = this.getCamelCasePackage(this._moduleStack.join("."));
		let fullyQualifiedEnumName = enumName;
		if(packageName.length > 0)
		{
			fullyQualifiedEnumName = packageName + "." + enumName;
		}
		
		let existingEnum = <as3.ClassDefinition> as3.getDefinitionByName(fullyQualifiedEnumName, this._definitions);
		if(!existingEnum)
		{
			throw new Error("Enum not found when trying to populate members: " + fullyQualifiedEnumName);
		}
		this.populateMembers(existingEnum, enumDeclaration);
	}
	
	private readPackageFunction(functionDeclaration: ts.FunctionDeclaration): as3.PackageFunctionDefinition
	{
		let functionName = this.declarationNameToString(functionDeclaration.name);
		let packageName = this.getCamelCasePackage(this._moduleStack.join("."));
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
		return new as3.PackageFunctionDefinition(functionName, packageName, as3.AccessModifiers[as3.AccessModifiers.public], this._currentSourceFile.fileName, this._currentModuleName, this._currentFileIsExternal);
	}
	
	private populatePackageFunction(functionDeclaration: ts.FunctionDeclaration)
	{
		let typeParameters = this.populateTypeParameters(functionDeclaration);
		
		let functionName = this.declarationNameToString(functionDeclaration.name);
		let packageName = this.getCamelCasePackage(this._moduleStack.join("."));
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
		this.mergeFunctionParameters(as3PackageFunction, functionParameters);
		as3PackageFunction.accessLevel = as3.AccessModifiers[as3.AccessModifiers.public];
		
		this.cleanupTypeParameters(typeParameters);
	}
	
	private readPackageVariable(variableDeclaration: ts.VariableDeclaration): as3.PackageVariableDefinition
	{
		let variableName = this.declarationNameToString(variableDeclaration.name);
		let packageName = this.getCamelCasePackage(this._moduleStack.join("."));
		let fullyQualifiedName = variableName;
		if(packageName)
		{
			fullyQualifiedName = packageName + "." + variableName; 
		}
		let accessLevel = as3.AccessModifiers[as3.AccessModifiers.public];
		let existingDefinition = as3.getDefinitionByName(fullyQualifiedName, this._definitions);
		if(existingDefinition instanceof StaticSideClassDefinition)
		{
			//this is a decomposed class where the variable name and the static
			//side have the same name
			existingDefinition.accessLevel = accessLevel;
			return null;
		}
		let as3Variable = new as3.PackageVariableDefinition(variableName, packageName, accessLevel, this._currentSourceFile.fileName, this._currentModuleName, this._currentFileIsExternal);
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
		let packageName = this.getCamelCasePackage(this._moduleStack.join("."));
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
			if(variableType instanceof StaticSideClassDefinition)
			{
				//this is a decomposed class that only consists of a variable
				//and a static side interface. we didn't have a chance to
				//catch this special case until now
				let classDefinition = new as3.ClassDefinition(as3PackageVariable.name,
					as3PackageVariable.packageName, as3PackageVariable.accessLevel,
					as3PackageVariable.sourceFile, as3PackageVariable.moduleName,
					as3PackageVariable.external);
				let index = this._definitions.indexOf(as3PackageVariable);
				this._definitions[index] = classDefinition;
				as3PackageLevelDefinition = classDefinition;
			}
			else
			{
				as3PackageVariable.type = variableType;
				return;
			}
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
				let tempStaticSideClass = new StaticSideClassDefinition(null, null, as3.AccessModifiers[as3.AccessModifiers.internal], this._currentSourceFile.fileName, this._currentModuleName);
				let typeLiteral = <ts.TypeLiteralNode> variableDeclaration.type;
				this.readMembers(tempStaticSideClass, typeLiteral);
				this.populateMembers(tempStaticSideClass, typeLiteral);
				variableType = tempStaticSideClass;
			}
			if(variableType instanceof StaticSideClassDefinition)
			{
				//an interface had a construct signature, so it was converted
				//to a StaticSideClassDefinition
				
				//the static side of this decomposed class is a different
				//interface than the instance side. we need to copy over
				//all the members from the static side to the instance side
				//and make them static
				this.copyMembers(variableType, as3PackageLevelDefinition, true);
				
				let constructorMethod = variableType.constructorMethod;
				if(constructorMethod !== null)
				{
					//the constructor name should match
					constructorMethod.name = as3PackageLevelDefinition.name;
				}
				as3PackageLevelDefinition.constructorMethod = constructorMethod;
				return;
			}
			if(variableType instanceof as3.InterfaceDefinition)
			{
				//the interface doesn't have a construct signature, so we
				//couldn't tell that it was the static side of a class until
				//now
				
				//the static side of this decomposed class is a different
				//interface than the instance side. we need to copy over
				//all the members from the static side to the instance side
				//and make them static
				this.copyMembers(variableType, as3PackageLevelDefinition, true);
				
				//we need this interface to be cleaned up at the end, so we
				//convert it to a StaticSideClassDefinition
				let staticSide = new StaticSideClassDefinition(variableType.name, variableType.packageName, variableType.accessLevel, variableType.sourceFile, variableType.moduleName);
				staticSide.methods = variableType.methods;
				staticSide.properties = variableType.properties;
				let index = this._definitions.indexOf(variableType);
				this._definitions[index] = staticSide;
				return;
			}
			
			//something went wrong. it's a class, but we couldn't find the static side.
			if(this.debugLevel >= DebugLevel.WARN && !this._currentFileIsExternal)
			{
				console.error("Cannot populate class from package variable named " + fullyQualifiedPackageVariableName + ".");
			}
			return;
		}
		//something went terribly wrong. it's not a variable or a class.
		if(this.debugLevel >= DebugLevel.WARN && !this._currentFileIsExternal)
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
				let as3Property = this.readProperty(propertyDeclaration, as3Type);
				if(as3Property !== null)
				{
					//if the property name starts with [, readProperty() will return null
					as3Type.properties.push(as3Property);
				}
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
				if(as3Method !== null)
				{
					//if the method name starts with [, readMethod() will return null
					this.addMethodToAS3Type(as3Type, as3Method);
				}
				break;
			}
			case ts.SyntaxKind.EnumMember:
			{
				let enumMember = <ts.EnumMember> member;
				let as3Property = this.readEnumMember(enumMember);
				if(as3Property !== null)
				{
					as3Type.properties.push(as3Property);
				}
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
				if(this.debugLevel >= DebugLevel.WARN && !this._currentFileIsExternal)
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
				this.populateConstructor(constructorDeclaration, <as3.ClassDefinition> as3Type);
				break;
			}
			case ts.SyntaxKind.MethodDeclaration:
			case ts.SyntaxKind.MethodSignature:
			{
				let functionDeclaration = <ts.FunctionDeclaration> member;
				this.populateMethod(functionDeclaration, as3Type);
				break;
			}
			case ts.SyntaxKind.EnumMember:
			{
				let enumMember = <ts.EnumMember> member;
				this.populateEnumMember(enumMember, as3Type);
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
				if(this.debugLevel >= DebugLevel.WARN && !this._currentFileIsExternal)
				{
					console.warn("Unknown SyntaxKind in member: " + member.kind.toString());
					console.warn(this._currentSourceFile.text.substring(member.pos, member.end));
				}
				break;
			}
		}
	}
	
	private readProperty(propertyDeclaration: ts.PropertyDeclaration, as3Type: as3.TypeDefinition): as3.PropertyDefinition
	{
		let propertyName = this.declarationNameToString(propertyDeclaration.name);
		if(!this.isValidMemberName(propertyName))
		{
			//this property can be ignored
			return null;
		}
		let isStatic = false;
		if(propertyDeclaration.modifiers)
		{
			isStatic = propertyDeclaration.modifiers.some(modifier => (modifier.kind & ts.ModifierFlags.Static) === ts.ModifierFlags.Static);
		}
		//if the property is declared more than once, skip it!
		let propertyAlreadyExists = as3Type.properties.some((property) =>
		{
			return property.name === propertyName && property.isStatic === isStatic;
		});
		if(propertyAlreadyExists)
		{
			//avoid duplicates!
			return null;
		}
		return new ParserPropertyDefinition(propertyName, null, null, isStatic);
	}
	
	private populateProperty(propertyDeclaration: ts.PropertyDeclaration, as3Type: as3.TypeDefinition)
	{
		let propertyName = this.declarationNameToString(propertyDeclaration.name);
		if(!this.isValidMemberName(propertyName))
		{
			//this property can be ignored
			return;
		}
		let isStatic = false;
		if(propertyDeclaration.modifiers)
		{
			isStatic = propertyDeclaration.modifiers.some(modifier => (modifier.kind & ts.ModifierFlags.Static) === ts.ModifierFlags.Static);
		}
		let as3Property = as3Type.getProperty(propertyName, isStatic);
		if(as3Property === null)
		{
			throw new Error("Property " + propertyName + " not found on type " + as3Type.getFullyQualifiedName() + ".");
		}
		let propertyType = this.getAS3TypeFromTSTypeNode(propertyDeclaration.type);
		if(!propertyType)
		{
			//this is a bug in dts2as, and we warn the user that something went
			//wrong, but we continue anyway because the output may still be
			//useful, even if not complete
			console.error("Error: Type " + this.getAS3FullyQualifiedNameFromTSTypeNode(propertyDeclaration.type) + " not found for property " + propertyName + " on type " + as3Type.getFullyQualifiedName() + ".");
			propertyType = as3.getDefinitionByName(as3.BuiltIns[as3.BuiltIns.Object], this._definitions) as as3.TypeDefinition;
		}
		as3Property.type = propertyType;
		if("superClass" in as3Type)
		{
			//members of interfaces don't have an access level, but we should
			//use public for classes
			as3Property.accessLevel = as3.AccessModifiers[as3.AccessModifiers.public];
		}
	}
	
	private readEnumMember(enumMember: ts.EnumMember): as3.PropertyDefinition
	{
		let propertyName = this.declarationNameToString(enumMember.name);
		if(!this.isValidMemberName(propertyName))
		{
			//this member can be ignored
			return null;
		}
		return new ParserPropertyDefinition(propertyName, as3.AccessModifiers[as3.AccessModifiers.public], null, true, true);
	}
	
	private populateEnumMember(enumMember: ts.EnumMember, as3Type: as3.TypeDefinition)
	{
		let propertyName = this.declarationNameToString(enumMember.name);
		if(!this.isValidMemberName(propertyName))
		{
			//this member can be ignored
			return;
		}
		let as3Property = as3Type.getProperty(propertyName, true);
		if(as3Property === null)
		{
			throw new Error("Property " + propertyName + " not found on enum type " + as3Type.getFullyQualifiedName() + ".");
		}
		let propertyType = <as3.TypeDefinition> as3.getDefinitionByName("int", this._definitions);
		as3Property.type = propertyType;
	}
	
	private populateParameters(functionLikeDeclaration: ts.FunctionLikeDeclaration, as3Type?: as3.TypeDefinition): as3.ParameterDefinition[]
	{
		let parameters = functionLikeDeclaration.parameters;
		let as3Parameters: as3.ParameterDefinition[] = [];
		for(let i = 0, count = parameters.length; i < count; i++)
		{
			let value = parameters[i];
			let parameterName = this.declarationNameToString(value.name);
			let parameterType = this.getAS3TypeFromTSTypeNode(value.type, as3Type);
			if(!parameterType)
			{
				let functionName = "constructor";
				if(functionLikeDeclaration.kind !== ts.SyntaxKind.Constructor)
				{
					functionName = this.declarationNameToString(functionLikeDeclaration.name);
				}
				let parameterTypeName = this.getAS3FullyQualifiedNameFromTSTypeNode(value.type);
				//this is a bug in dts2as, and we warn the user that something went
				//wrong, but we continue anyway because the output may still be
				//useful, even if not complete
				console.error("Error: Type " + parameterTypeName + " not found for parameter " + parameterName + " in function " + functionName + (as3Type ? " on type " + as3Type.getFullyQualifiedName() : "") + ".");
				parameterType = <as3.TypeDefinition> as3.getDefinitionByName(as3.BuiltIns[as3.BuiltIns.Object], this._definitions);
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
		let typeParameters = this.populateTypeParameters(constructorDeclaration);
		
		let className = as3Class.name;
		let as3Constructor = as3Class.constructorMethod;
		if(!as3Constructor)
		{
			throw new Error("Constructor not found on class " + as3Class.getFullyQualifiedName() + ".");
		}
		let constructorParameters = this.populateParameters(constructorDeclaration, as3Class);
		this.mergeFunctionParameters(as3Constructor, constructorParameters);
		
		this.cleanupTypeParameters(typeParameters);
	}
	
	private readMethod(functionDeclaration: ts.FunctionDeclaration, as3Type: as3.TypeDefinition): as3.MethodDefinition
	{
		let methodName = this.declarationNameToString(functionDeclaration.name);
		if(!this.isValidMemberName(methodName))
		{
			//this method can be ignored
			return null;
		}
		let isStatic = functionDeclaration.modifiers && functionDeclaration.modifiers.some(modifier => (modifier.kind & ts.ModifierFlags.Static) === ts.ModifierFlags.Static);
		//if the property is declared more than once, skip it!
		let methodAlreadyExists = as3Type.methods.some((method) =>
		{
			return method.name === methodName && method.isStatic === isStatic;
		});
		if(methodAlreadyExists)
		{
			//avoid duplicates!
			return null;
		}
		let accessLevel = as3Type.constructor === as3.ClassDefinition ? as3.AccessModifiers[as3.AccessModifiers.public] : null;
		return new ParserMethodDefinition(methodName, null, null, accessLevel, isStatic);
	}
	
	private populateMethod(functionDeclaration: ts.FunctionDeclaration, as3Type: as3.TypeDefinition)
	{	
		let methodName = this.declarationNameToString(functionDeclaration.name);
		if(!this.isValidMemberName(methodName))
		{
			//this method can be ignored
			return;
		}
		let typeParameters = this.populateTypeParameters(functionDeclaration);
		let isStatic = false;
		if(functionDeclaration.modifiers)
		{
			isStatic = functionDeclaration.modifiers.some(modifier => (modifier.kind & ts.ModifierFlags.Static) === ts.ModifierFlags.Static);
		}
		let as3Method = as3Type.getMethod(methodName, isStatic);
		if(as3Method === null)
		{
			let staticMessage = isStatic ? "Static" : "Non-static";
			throw new Error(staticMessage + " method " + methodName + "() not found on type " + as3Type.getFullyQualifiedName() + ".");
		}
		
		let methodType = this.getAS3TypeFromTSTypeNode(functionDeclaration.type, as3Type);
		if(!methodType)
		{
			//this is a bug in dts2as, and we warn the user that something went
			//wrong, but we continue anyway because the output may still be
			//useful, even if not complete
			console.error("Error: Return type " + this.getAS3FullyQualifiedNameFromTSTypeNode(functionDeclaration.type) + " not found for method " + methodName + "() on type " + as3Type.getFullyQualifiedName() + ".");
			methodType = as3.getDefinitionByName(as3.BuiltIns[as3.BuiltIns.Object], this._definitions) as as3.TypeDefinition;
		}
		let methodParameters = this.populateParameters(functionDeclaration, as3Type);
		this.mergeFunctionParameters(as3Method, methodParameters);
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
					if(this.debugLevel >= DebugLevel.INFO)
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
						as3Definition.moduleName, as3Definition.external);
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

	private cleanupMembersWithSameNameAsType()
	{
		this._definitions.forEach((definition: as3.PackageLevelDefinition) =>
		{
			 if(definition instanceof as3.ClassDefinition)
			 {
				 definition.properties = definition.properties.filter((property: as3.PropertyDefinition) =>
				 {
					 return property.name !== definition.name;
				 });
			 }
			 if(definition instanceof as3.ClassDefinition ||
			 	definition instanceof as3.InterfaceDefinition)
			 {
				 definition.methods = definition.methods.filter((method: as3.MethodDefinition) =>
				 {
					 return method.name !== definition.name;
				 })
			 }
		});
	}

	private cleanupMembersWithStaticSideTypes()
	{
		//if a member is typed as a static-side type, it will result in a
		//compiler error because these types are removed, so convert it to *
		this._definitions.forEach((definition: as3.PackageLevelDefinition) =>
		{
			 if(definition instanceof as3.ClassDefinition ||
			 	definition instanceof as3.InterfaceDefinition)
			 {
				 definition.properties.forEach((property: as3.PropertyDefinition) =>
				 {
					 if(property.type instanceof StaticSideClassDefinition)
					 {
						 property.type = <as3.TypeDefinition> as3.getDefinitionByName(as3.BuiltIns[as3.BuiltIns.Object], this._definitions);
					 }
				 });
				 definition.methods.forEach((method: as3.MethodDefinition) =>
				 {
					 if(method.type instanceof StaticSideClassDefinition)
					 {
						 method.type = <as3.TypeDefinition> as3.getDefinitionByName(as3.BuiltIns[as3.BuiltIns.Object], this._definitions);
					 }
				 })
			 }
		});
	}
	
	//an interface that overrides another cannot override methods in
	//ActionScript, but TypeScript allows overloads, so we must remove
	//any duplicates that are found 
	private cleanupInterfaceOverrides()
	{
		this._definitions.forEach((definition: as3.PackageLevelDefinition) =>
		{
			if(definition instanceof as3.InterfaceDefinition)
			{
				definition.methods.forEach((method, index) =>
				{
					let foundMethod = definition.interfaces.some((otherInterface) =>
					{
						return otherInterface.getMethod(method.name) !== null;
					});
					if(foundMethod)
					{
						definition.methods.splice(index, 1);
					}
				});
			}
		});
	}
	
	//TypeScript allows classes to change certain parts of method signatures
	//when overloading, and that's not allowed in ActionScript
	private cleanupClassOverrides()
	{
		this._definitions.forEach((definition: as3.PackageLevelDefinition) =>
		{
			if(definition instanceof as3.ClassDefinition)
			{
				definition.methods.forEach((method) =>
				{
					definition.interfaces.some((otherInterface) =>
					{
						let otherMethod = otherInterface.getMethod(method.name);
						if(otherMethod === null)
						{
							return false;
						}
						if(method.type !== otherMethod.type)
						{
							method.type = otherMethod.type;
						}
						let parameterCount = Math.min(method.parameters.length, otherMethod.parameters.length);
						for(let i = 0; i < parameterCount; i++)
						{
							let param1 = method.parameters[i];
							let param2 = otherMethod.parameters[i];
							if(param1.type !== param2.type)
							{
								param1.type = param2.type;
							}
						}
						return true;
					});
				});
			}
		});
	}
}