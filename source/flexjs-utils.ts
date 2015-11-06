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
/// <reference path="../typings/tsd.d.ts" />

import fs = require("fs");
import path = require("path");
import os = require("os");

export function isValidApacheFlexJSPath(sdkPath: string)
{
	let sdkDescriptionPath = path.join(sdkPath, "flex-sdk-description.xml");	
	if(!fs.existsSync(sdkDescriptionPath) || fs.statSync(sdkDescriptionPath).isDirectory())
	{
		return false;
	}
	let asjscPath = path.join(sdkPath, "js", "bin", "asjsc");
	if(!fs.existsSync(asjscPath) || fs.statSync(asjscPath).isDirectory())
	{
		return false;
	}
	return true;
}

export function findFlexHome()
{
	if(!("FLEX_HOME" in process.env))
	{
		return null;
	}
	let sdkPath = process.env.FLEX_HOME;
	if(!isValidApacheFlexJSPath(sdkPath))
	{
		return null;
	}
	return sdkPath;
}

export function findBinCompc(flexHome: string)
{
	if(!isValidApacheFlexJSPath(flexHome))
	{
		return null;
	}
	let executableName = "compc";
	if(os.platform() === "win32")
	{
		name += ".bat";
	}
	let executablePath = path.join(flexHome, "bin", executableName);
	if(!fs.existsSync(executablePath))
	{
		return null;
	}
	return executablePath;
}