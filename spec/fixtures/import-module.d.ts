declare module first
{
	class ClassOne {}
}

declare module second
{
	import alias = first;
	var var1: alias.ClassOne;
}