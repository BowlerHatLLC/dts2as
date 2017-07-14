declare module module1
{
	type MyType = string;
	module module2
	{
		export var typeAlias: MyType;
	}
}