import { describe, it, expect, beforeAll } from "vitest";
import { createRequire } from "node:module";
import { DartExtractor } from "../dart-extractor.js";

const require = createRequire(import.meta.url);

let Parser: any;
let Language: any;
let dartLang: any;

beforeAll(async () => {
  const mod = await import("web-tree-sitter");
  Parser = mod.Parser;
  Language = mod.Language;
  await Parser.init();
  const wasmPath = require.resolve(
    "@understand-anything/tree-sitter-dart-wasm/tree-sitter-dart.wasm",
  );
  dartLang = await Language.load(wasmPath);
});

function parse(code: string) {
  const parser = new Parser();
  parser.setLanguage(dartLang);
  const tree = parser.parse(code);
  const root = tree.rootNode;
  return { tree, parser, root };
}

describe("DartExtractor", () => {
  const extractor = new DartExtractor();

  it("has correct languageIds", () => {
    expect(extractor.languageIds).toEqual(["dart"]);
  });

  describe("extractStructure - functions", () => {
    it("extracts a simple top-level function with params and return type", () => {
      const { tree, parser, root } = parse(`int add(int a, int b) => a + b;\n`);
      const result = extractor.extractStructure(root);

      expect(result.functions).toHaveLength(1);
      expect(result.functions[0].name).toBe("add");
      expect(result.functions[0].params).toEqual(["a", "b"]);
      expect(result.functions[0].returnType).toBe("int");

      tree.delete();
      parser.delete();
    });

    it("extracts a function with no params and void return type", () => {
      const { tree, parser, root } = parse(`void noop() {}\n`);
      const result = extractor.extractStructure(root);

      expect(result.functions).toHaveLength(1);
      expect(result.functions[0].name).toBe("noop");
      expect(result.functions[0].params).toEqual([]);
      expect(result.functions[0].returnType).toBe("void");

      tree.delete();
      parser.delete();
    });

    it("extracts an async function with a generic return type", () => {
      const { tree, parser, root } = parse(`Future<String> fetch(String url) async { return ""; }\n`);
      const result = extractor.extractStructure(root);

      expect(result.functions).toHaveLength(1);
      expect(result.functions[0].name).toBe("fetch");
      expect(result.functions[0].params).toEqual(["url"]);
      expect(result.functions[0].returnType).toBe("Future<String>");

      tree.delete();
      parser.delete();
    });
  });

  describe("extractStructure - classes", () => {
    it("extracts a class with fields and methods", () => {
      const { tree, parser, root } = parse(`class Counter {
  int count = 0;
  String? label;
  void increment() { count++; }
  int get value => count;
}
`);
      const result = extractor.extractStructure(root);

      expect(result.classes).toHaveLength(1);
      expect(result.classes[0].name).toBe("Counter");
      expect(result.classes[0].methods).toContain("increment");
      // method declarations land in functions[] too (matching Kotlin convention)
      expect(result.functions.map((f) => f.name)).toContain("increment");
      // Field extraction: `int count = 0;` and `String? label;` both parse as
      // declaration > initialized_identifier_list > initialized_identifier > identifier
      expect(result.classes[0].properties).toEqual(
        expect.arrayContaining(["count", "label"]),
      );
      // Getters appear as `method_signature > getter_signature`, a separate node
      // type from `function_signature` — not yet surfaced (documented limitation).
      expect(result.classes[0].methods).not.toContain("value");

      tree.delete();
      parser.delete();
    });

    it("extracts an empty class", () => {
      const { tree, parser, root } = parse(`class Empty {}\n`);
      const result = extractor.extractStructure(root);

      expect(result.classes).toHaveLength(1);
      expect(result.classes[0].name).toBe("Empty");
      expect(result.classes[0].methods).toEqual([]);

      tree.delete();
      parser.delete();
    });

    it("extracts an abstract class with method requirements", () => {
      const { tree, parser, root } = parse(`abstract class Shape {
  double area();
}
`);
      const result = extractor.extractStructure(root);

      expect(result.classes).toHaveLength(1);
      expect(result.classes[0].name).toBe("Shape");
      expect(result.classes[0].methods).toContain("area");

      tree.delete();
      parser.delete();
    });

    it("extracts a class with extends + with + implements clauses", () => {
      const { tree, parser, root } = parse(`class Square extends Shape with Comparable<Square> implements Cloneable {
  double side;
  Square(this.side);
  double area() => side * side;
}
`);
      const result = extractor.extractStructure(root);

      expect(result.classes).toHaveLength(1);
      expect(result.classes[0].name).toBe("Square");
      expect(result.classes[0].methods).toContain("area");

      tree.delete();
      parser.delete();
    });
  });
});
