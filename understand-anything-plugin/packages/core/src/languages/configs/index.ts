import type { LanguageConfig } from "../types.js";
import { typescriptConfig } from "./typescript.js";
import { javascriptConfig } from "./javascript.js";
import { pythonConfig } from "./python.js";
import { goConfig } from "./go.js";
import { rustConfig } from "./rust.js";
import { javaConfig } from "./java.js";
import { rubyConfig } from "./ruby.js";
import { phpConfig } from "./php.js";
import { swiftConfig } from "./swift.js";
import { kotlinConfig } from "./kotlin.js";
import { cppConfig } from "./cpp.js";
import { csharpConfig } from "./csharp.js";

export const builtinLanguageConfigs: LanguageConfig[] = [
  typescriptConfig,
  javascriptConfig,
  pythonConfig,
  goConfig,
  rustConfig,
  javaConfig,
  rubyConfig,
  phpConfig,
  swiftConfig,
  kotlinConfig,
  cppConfig,
  csharpConfig,
];

export {
  typescriptConfig,
  javascriptConfig,
  pythonConfig,
  goConfig,
  rustConfig,
  javaConfig,
  rubyConfig,
  phpConfig,
  swiftConfig,
  kotlinConfig,
  cppConfig,
  csharpConfig,
};
