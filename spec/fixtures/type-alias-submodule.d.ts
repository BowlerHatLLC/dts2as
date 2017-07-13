declare module module1
{
	module module2
	{
		type MyType = string;
	}
	export var typeAlias: module2.MyType;
}