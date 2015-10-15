interface DecomposedClassWithMethod
{
	method1() :number;
}

interface StaticSide
{
	new (): DecomposedClassWithMethod;
}

declare var DecomposedClassWithMethod: StaticSide