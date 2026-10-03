declare module 'bun:test' {
	export function describe(name: string, run: () => void): void;
	export function test(name: string, run: () => void | Promise<void>): void;
	interface Matchers {
		toContain(expected: unknown): void;
		toEqual(expected: unknown): void;
		toHaveLength(expected: number): void;
		toBe(expected: unknown): void;
		toBeNull(): void;
		toThrow(expected?: string | RegExp): void;
		not: Matchers;
	}
	export function expect(value: unknown): Matchers;
}

declare namespace Bun {
	class Transpiler {
		constructor(options: { loader: 'ts' });
		transformSync(source: string): string;
	}
}
