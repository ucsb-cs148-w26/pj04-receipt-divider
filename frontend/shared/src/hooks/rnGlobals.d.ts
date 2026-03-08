// React Native provides requestAnimationFrame as a runtime global, but the
// shared package tsconfig uses lib:ES2020 (no DOM) so TypeScript doesn't know
// about it. Declared here so hooks can use it without lint/type errors.
declare function requestAnimationFrame(callback: () => void): number;
