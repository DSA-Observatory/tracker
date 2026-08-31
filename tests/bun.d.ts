declare module 'bun:test' {
	export function describe(name: string, run: () => void): void;
	export function test(name: string, run: () => void | Promise<void>): void;
	export function expect(value: unknown): {
		toContain(expected: unknown): void;
		toEqual(expected: unknown): void;
		toHaveLength(expected: number): void;
		toBe(expected: unknown): void;
	};
}
