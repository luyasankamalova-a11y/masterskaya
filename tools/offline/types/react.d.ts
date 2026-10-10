// ЗАГЛУШКА ТИПОВ React для офлайн-проверки (в среде без @types/react).
// Покрывает только API, которые использует Мастерская. В настоящем проекте — @types/react.
declare module 'react' {
  export type ReactNode = string | number | boolean | null | undefined | JSX.Element | ReactNode[];
  export interface CSSProperties { [key: string]: string | number | undefined }
  export type Dispatch<A> = (value: A) => void;
  export type SetStateAction<S> = S | ((prev: S) => S);
  export interface MutableRefObject<T> { current: T }
  export interface RefObject<T> { current: T }

  export function useState<S>(initial: S | (() => S)): [S, Dispatch<SetStateAction<S>>];
  export function useState<S = undefined>(): [S | undefined, Dispatch<SetStateAction<S | undefined>>];
  export function useEffect(effect: () => void | (() => void) | undefined, deps?: readonly unknown[]): void;
  export function useLayoutEffect(effect: () => void | (() => void), deps?: readonly unknown[]): void;
  export function useRef<T>(initial: T): MutableRefObject<T>;
  export function useRef<T>(initial: T | null): RefObject<T | null>;
  export function useRef<T>(initial: T | undefined): MutableRefObject<T | undefined>;
  export function useRef<T = undefined>(): MutableRefObject<T | undefined>;
  export function useMemo<T>(f: () => T, deps: readonly unknown[]): T;
  export function useCallback<T extends (...a: never[]) => unknown>(f: T, deps: readonly unknown[]): T;
  export function useSyncExternalStore<T>(subscribe: (cb: () => void) => () => void, get: () => T): T;
  export function memo<P>(c: (p: P) => JSX.Element | null): (p: P & { key?: string | number }) => JSX.Element | null;

  interface SyntheticEvent<T = Element, E = Event> {
    target: EventTarget; currentTarget: T; nativeEvent: E;
    preventDefault(): void; stopPropagation(): void;
  }
  export interface MouseEvent<T = Element, E = globalThis.MouseEvent> extends SyntheticEvent<T, E> {
    clientX: number; clientY: number; button: number; buttons: number; ctrlKey: boolean; shiftKey: boolean; metaKey: boolean;
  }
  export interface PointerEvent<T = Element> extends MouseEvent<T, globalThis.PointerEvent> {
    pointerId: number; pointerType: string; pressure: number;
  }
  export interface WheelEvent<T = Element> extends MouseEvent<T, globalThis.WheelEvent> {
    deltaX: number; deltaY: number; deltaMode: number;
  }
  export interface KeyboardEvent<T = Element> extends SyntheticEvent<T, globalThis.KeyboardEvent> {
    key: string; ctrlKey: boolean; shiftKey: boolean; metaKey: boolean;
  }
}

declare module 'react/jsx-runtime' {
  export const jsx: unknown;
  export const jsxs: unknown;
  export const Fragment: unknown;
  export namespace JSX {
    type Element = { readonly __el: unique symbol } | null;
    interface IntrinsicElements { [tag: string]: { [prop: string]: any } } // eslint-disable-line @typescript-eslint/no-explicit-any
    interface IntrinsicAttributes { key?: string | number | null }
    interface ElementChildrenAttribute { children: {} } // eslint-disable-line @typescript-eslint/no-empty-object-type
  }
}

declare namespace JSX {
  type Element = import('react/jsx-runtime').JSX.Element;
}

declare module 'react-dom/client' {
  export function createRoot(el: Element): { render(node: unknown): void };
}
