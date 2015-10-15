interface DecomposedClassWithStaticMethod {}

interface StaticSide
{
	new (): DecomposedClassWithStaticMethod;
	method1(): number;
}

declare var DecomposedClassWithStaticMethod: StaticSide