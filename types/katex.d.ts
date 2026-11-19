declare module 'katex' {
  interface KatexOptions {
    throwOnError?: boolean;
    output?: 'html' | 'mathml' | 'htmlAndMathml';
    strict?: boolean | 'ignore' | 'warn' | 'error';
    displayMode?: boolean;
  }
  const katex: { renderToString(tex: string, options?: KatexOptions): string };
  export default katex;
}
