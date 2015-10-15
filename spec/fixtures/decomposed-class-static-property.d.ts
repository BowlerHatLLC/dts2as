interface DecomposedClassWithStaticProperty {}

interface StaticSide
{
	new (): DecomposedClassWithStaticProperty;
	property1: string;
}

declare var DecomposedClassWithStaticProperty: StaticSide