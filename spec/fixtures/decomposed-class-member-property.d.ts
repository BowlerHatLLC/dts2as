interface DecomposedClassWithProperty
{
	property1: string;
}

interface StaticSide
{
	new (): DecomposedClassWithProperty;
}

declare var DecomposedClassWithProperty: StaticSide