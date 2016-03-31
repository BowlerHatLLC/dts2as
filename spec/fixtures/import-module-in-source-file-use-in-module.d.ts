import alias = aliasedModule;

declare module aliasedModule
{
	class ClassOne {}
	var var1: alias.ClassOne;
}