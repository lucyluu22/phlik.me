/**
 * throttle
 * Returns a function that, when invoked repeatedly, will only call `fn`
 * at most once every `wait` milliseconds. This is a simple leading-edge throttle.
 *
 * Note: this implementation does not preserve `this` for the wrapped call. If you need
 * to preserve `this`, bind the function before passing it to `throttle`.
 */
export function throttle<T extends (...args: never[]) => unknown>(fn: T, wait = 0) {
	let lastCall = 0;

	return function (...args: Parameters<T>): ReturnType<T> | undefined {
		const now = Date.now();
		if (now - lastCall >= wait) {
			lastCall = now;
			return fn(...(args as Parameters<T>)) as ReturnType<T>;
		}
		return undefined;
	};
}

/*
Usage

import { throttle } from '$lib/utils/throttle';

const t = throttle((v: string) => console.log(v), 200);
t('a'); // invokes immediately
t('b'); // ignored if within 200ms

// If you need `this`, bind the function first:
const obj = { x: 1, method(v: number) { console.log(this.x, v); } };
const throttledMethod = throttle(obj.method.bind(obj), 100);
*/
