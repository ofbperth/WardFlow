import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import ts from "typescript";

export function loadSource(relative, overrides = {}, cache = new Map()) {
  const filename = path.resolve(relative);
  if (cache.has(filename)) return cache.get(filename).exports;
  const loaded = { exports: {} };
  cache.set(filename, loaded);
  const nativeRequire = createRequire(filename);
  const requireSource = name => {
    if (Object.hasOwn(overrides, name)) return overrides[name];
    if (name.startsWith("@/")) return loadSource(`src/${name.slice(2)}${name.endsWith(".mjs") ? "" : ".ts"}`, overrides, cache);
    if (name.startsWith(".") && name.endsWith(".mjs")) return nativeRequire(name);
    if (name.startsWith(".")) return loadSource(path.resolve(path.dirname(filename), name + ".ts"), overrides, cache);
    return nativeRequire(name);
  };
  const compiled = ts.transpileModule(readFileSync(filename, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText;
  new Function("require", "module", "exports", compiled)(requireSource, loaded, loaded.exports);
  return loaded.exports;
}
