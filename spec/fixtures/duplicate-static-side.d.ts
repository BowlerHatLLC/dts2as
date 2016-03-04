interface StaticSide
{
	new (): DuplicateStaticSide;
	method1(): string;
}

interface DuplicateStaticSide {}

interface StaticSide
{
	new (): DuplicateStaticSide;
	method1(): string;
	method2(): number;
}

declare var DuplicateStaticSide: StaticSide;