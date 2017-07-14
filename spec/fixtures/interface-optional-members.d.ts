export interface InterfaceWithOptionalMembers
{
	method1(): number;
	method2?(): boolean;
}

export class ClassImplementsInterfaceWithOptionalMembers implements InterfaceWithOptionalMembers
{
	method1();
}