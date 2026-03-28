import type { LanguageConfig } from "../types.js";

export const cppConfig = {
  id: "cpp",
  displayName: "C/C++",
  extensions: [".cpp", ".cc", ".cxx", ".c", ".h", ".hpp", ".hxx"],
  concepts: [
    "templates",
    "RAII",
    "smart pointers",
    "move semantics",
    "operator overloading",
    "virtual functions",
    "namespaces",
    "constexpr",
    "lambda expressions",
    "STL containers",
  ],
  filePatterns: {
    entryPoints: ["main.cpp", "main.c", "src/main.cpp"],
    barrels: [],
    tests: ["*_test.cpp", "*_test.cc", "test_*.cpp"],
    config: ["CMakeLists.txt", "Makefile", "meson.build"],
  },
} satisfies LanguageConfig;
