interface InterfaceStaticSideVariableDecomposedClass {}

interface StaticSide
{
	new (): InterfaceStaticSideVariableDecomposedClass;
}

declare var InterfaceStaticSideVariableDecomposedClass: StaticSide;