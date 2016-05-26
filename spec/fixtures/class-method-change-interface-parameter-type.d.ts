declare interface InterfaceParameterType
{
	method1(param1: any);
}

declare class ClassChangeInterfaceParameterType implements InterfaceParameterType
{
	method1(param1: number);
}