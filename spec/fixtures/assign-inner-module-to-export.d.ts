declare module "outer"
{
	module inner
	{
		export var variable: string;
	}
	export = inner;
}