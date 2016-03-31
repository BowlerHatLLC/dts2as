declare module aliased
{
	class ClassOne {}
}

declare module outer
{
	import alias = aliased;
	module inner
	{
		var var1: alias.ClassOne;
	}
}