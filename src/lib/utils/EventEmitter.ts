/**
 * Minimal typed EventEmitter.
 *
 * Example:
 *   interface Events { ping: [string]; pong: [] }
 *   const e = new EventEmitter<Events>();
 *   e.on('ping', (msg) => console.log(msg));
 */

type InternalListener = (...args: unknown[]) => void;

export class EventEmitter<Events extends Record<string | symbol, unknown[]>> {
	private listeners = new Map<keyof Events, Set<InternalListener>>();

	on<K extends keyof Events>(event: K, listener: (...args: Events[K]) => void): this {
		let set = this.listeners.get(event);
		if (!set) {
			set = new Set();
			this.listeners.set(event, set);
		}
		set.add(listener as unknown as InternalListener);
		return this;
	}

	off<K extends keyof Events>(event: K, listener: (...args: Events[K]) => void): this {
		const set = this.listeners.get(event);
		if (set) set.delete(listener as unknown as InternalListener);
		return this;
	}

	once<K extends keyof Events>(event: K, listener: (...args: Events[K]) => void): this {
		const wrapper = (...args: unknown[]) => {
			this.off(event, wrapper as unknown as InternalListener);
			listener(...(args as Events[K]));
		};
		return this.on(event, wrapper as unknown as InternalListener);
	}

	emit<K extends keyof Events>(event: K, ...args: Events[K]): boolean {
		const set = this.listeners.get(event);
		if (!set || set.size === 0) return false;
		const arr = Array.from(set.values()) as Array<InternalListener>;
		for (const fn of arr) {
			try {
				fn(...(args as unknown[]));
			} catch (err) {
				// swallow listener errors so one bad listener doesn't break others
				// feel free to log or rethrow depending on needs
				console.error('Event listener error', err);
			}
		}
		return true;
	}

	removeAllListeners<K extends keyof Events>(event?: K): this {
		if (typeof event === 'undefined') {
			this.listeners.clear();
		} else {
			this.listeners.delete(event);
		}
		return this;
	}

	listenersOf<K extends keyof Events>(event: K): Array<(...args: Events[K]) => void> {
		const set = this.listeners.get(event);
		return set ? (Array.from(set.values()) as Array<(...args: Events[K]) => void>) : [];
	}

	listenerCount<K extends keyof Events>(event: K): number {
		return this.listeners.get(event)?.size ?? 0;
	}
}

export default EventEmitter;
