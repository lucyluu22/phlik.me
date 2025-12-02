import { createContext } from 'svelte';

export interface Context {
	files: FileList | null;
}

export const context: Context = $state({
	files: null
});

export const [getContext, setContext] = createContext<Context>();
