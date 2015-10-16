interface DecomposedClass {}

interface StaticSide
{
	new (): DecomposedClass;
}

declare var DecomposedClass: StaticSide

interface InterfaceExtendsDecomposedClass extends DecomposedClass {}