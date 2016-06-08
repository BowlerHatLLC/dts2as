declare class ClassAndMethodWithSameTypeParameter<T>
{
	method1<T>(param1: T)
	method2<U>(param1: T, param2: U)
}