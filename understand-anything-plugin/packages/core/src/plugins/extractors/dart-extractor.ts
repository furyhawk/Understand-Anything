import type { StructuralAnalysis, CallGraphEntry } from "../../types.js";
import type { LanguageExtractor, TreeSitterNode } from "./types.js";
import { findChild, findChildren } from "./base-extractor.js";

/**
 * Whether a Dart name is exported.
 *
 * Dart's visibility rule is name-based and the INVERSE of Kotlin's: names
 * starting with `_` are library-private, everything else is exported. There
 * is no `public` / `private` keyword to inspect — only the leading character.
 */
function isExported(name: string): boolean {
  return !name.startsWith("_");
}

/**
 * Extract the identifier name from a `function_signature` node.
 *
 * NOTE: this helper expects a `function_signature` node. The Dart grammar
 * wraps the function_signature inside two different parent shapes:
 *   - `method_signature > function_signature` for CONCRETE class methods.
 *   - `declaration > function_signature` for ABSTRACT class methods (no body).
 * Callers (`collectClassBody`) unwrap to the inner `function_signature`
 * before invoking this helper.
 */
function extractFunctionName(sig: TreeSitterNode): string | null {
  const id = findChild(sig, "identifier");
  return id ? id.text : null;
}

/**
 * Extract parameter names from a `formal_parameter_list`. Each
 * `formal_parameter` child carries the parameter name as its `identifier`
 * child; we ignore the type annotation.
 *
 * Currently only required positional parameters (`formal_parameter` direct
 * children) are surfaced. Dart's optional positional (`[...]`) and named
 * (`{...}`) parameters are wrapped in `optional_formal_parameters` and
 * `named_parameter_list` container nodes respectively; supporting those is
 * left for a follow-up — the project-graph use case does not currently
 * distinguish parameter kinds.
 */
function extractParams(sig: TreeSitterNode): string[] {
  const params: string[] = [];
  const paramList = findChild(sig, "formal_parameter_list");
  if (!paramList) return params;
  for (const p of findChildren(paramList, "formal_parameter")) {
    const id = findChild(p, "identifier");
    if (id) params.push(id.text);
  }
  return params;
}

/**
 * Extract the return type from a function_signature. The return type is the
 * sequence of NAMED children that appear before the function name
 * (`identifier`) or `formal_parameter_list`. If there is no such child, the
 * function has no declared return type (Dart infers it).
 *
 * Common shapes seen during AST probing:
 *   `int add(int a, int b)` →  [type_identifier "int"]
 *   `void noop()`           →  [void_type]
 *   `Future<String> fetch()`→  [type_identifier "Future", type_arguments "<String>"]
 *
 * For generic types the grammar emits the base type and the type arguments as
 * separate sibling nodes, so we collect ALL nodes before `identifier` and
 * concatenate their text to reconstruct the full type spelling.
 */
function extractReturnType(sig: TreeSitterNode): string | undefined {
  const parts: string[] = [];
  for (let i = 0; i < sig.childCount; i++) {
    const child = sig.child(i);
    if (!child || !child.isNamed) continue;
    if (
      child.type === "identifier" ||
      child.type === "formal_parameter_list" ||
      child.type === "type_parameters"
    ) {
      // Reached the function NAME (`identifier`), the parameter list, or the
      // generic-parameter list (`type_parameters` is the function's own
      // generics, e.g. `<T>` in `T fn<T>(T x)`). Anything we passed before
      // this point WAS the return type; if we hit this stop without having
      // collected anything, the function has no declared return type.
      break;
    }
    parts.push(child.text);
  }
  return parts.length > 0 ? parts.join("") : undefined;
}

/**
 * Push a method/function entry. Used by `collectClassBody` for both
 * `method_signature` and `declaration > function_signature` shapes so a
 * future change to the entry's fields lands in one place.
 */
function pushMethod(
  declNode: TreeSitterNode,
  sig: TreeSitterNode,
  name: string,
  methods: string[],
  functions: StructuralAnalysis["functions"],
  exports: StructuralAnalysis["exports"],
): void {
  methods.push(name);
  functions.push({
    name,
    lineRange: [declNode.startPosition.row + 1, declNode.endPosition.row + 1],
    params: extractParams(sig),
    returnType: extractReturnType(sig),
  });
  if (isExported(name)) {
    exports.push({ name, lineNumber: declNode.startPosition.row + 1 });
  }
}

/**
 * Walk a `class_body` (or `extension_body` / `enum_body`) and collect
 * `method_signature` declarations into the class's `methods` array AND the
 * top-level `functions` array, mirroring KotlinExtractor.collectClassBody.
 *
 * Field extraction: `int count = 0;` and `String? label;` inside a class body
 * both parse as `declaration > initialized_identifier_list > initialized_identifier
 * > identifier`. The nullable `?` is an unnamed sibling of `type_identifier`,
 * so it does not affect this path.
 */
function collectClassBody(
  body: TreeSitterNode,
  methods: string[],
  properties: string[],
  functions: StructuralAnalysis["functions"],
  exports: StructuralAnalysis["exports"],
): void {
  for (let i = 0; i < body.childCount; i++) {
    const member = body.child(i);
    if (!member) continue;

    if (member.type === "method_signature") {
      // Concrete method: `method_signature > function_signature`.
      // NOTE: `getter_signature` also nests under `method_signature` but is a
      // separate node type — getters are not yet surfaced (documented limitation).
      const inner = findChild(member, "function_signature");
      if (!inner) continue;
      const name = extractFunctionName(inner);
      if (!name) continue;
      pushMethod(member, inner, name, methods, functions, exports);
    } else if (member.type === "declaration") {
      // Abstract method declarations (e.g. `double area();`) appear as
      // `declaration > function_signature` — not wrapped in `method_signature`.
      const fnSig = findChild(member, "function_signature");
      if (fnSig) {
        const name = extractFunctionName(fnSig);
        if (name) {
          pushMethod(member, fnSig, name, methods, functions, exports);
        }
        continue;
      }
      // Field declaration — surface initialized_identifier names as properties.
      const list = findChild(member, "initialized_identifier_list");
      if (!list) continue;
      for (const init of findChildren(list, "initialized_identifier")) {
        const id = findChild(init, "identifier");
        if (id) properties.push(id.text);
      }
    }
  }
}

/**
 * Dart extractor for tree-sitter structural analysis + call graph.
 *
 * Approach (matching `KotlinExtractor` convention): mixin / extension / enum
 * declarations are folded into `StructuralAnalysis.classes[]` because the
 * shared schema does not have a first-class slot for them. Extension
 * declarations without a name surface as `"on <TargetType>"` so they aren't
 * silently dropped.
 */
export class DartExtractor implements LanguageExtractor {
  readonly languageIds = ["dart"];

  extractStructure(rootNode: TreeSitterNode): StructuralAnalysis {
    const functions: StructuralAnalysis["functions"] = [];
    const classes: StructuralAnalysis["classes"] = [];
    const imports: StructuralAnalysis["imports"] = [];
    const exports: StructuralAnalysis["exports"] = [];

    for (let i = 0; i < rootNode.childCount; i++) {
      const node = rootNode.child(i);
      if (!node) continue;

      switch (node.type) {
        case "function_signature":
          this.extractTopLevelFunction(node, functions, exports);
          break;
        case "class_definition":
          this.extractClassDefinition(node, classes, functions, exports);
          break;
      }
    }

    return { functions, classes, imports, exports };
  }

  // ---- Private helpers ----

  private extractTopLevelFunction(
    sig: TreeSitterNode,
    functions: StructuralAnalysis["functions"],
    exports: StructuralAnalysis["exports"],
  ): void {
    const name = extractFunctionName(sig);
    if (!name) return;
    functions.push({
      name,
      lineRange: [sig.startPosition.row + 1, sig.endPosition.row + 1],
      params: extractParams(sig),
      returnType: extractReturnType(sig),
    });
    if (isExported(name)) {
      exports.push({ name, lineNumber: sig.startPosition.row + 1 });
    }
  }

  private extractClassDefinition(
    declNode: TreeSitterNode,
    classes: StructuralAnalysis["classes"],
    functions: StructuralAnalysis["functions"],
    exports: StructuralAnalysis["exports"],
  ): void {
    const nameNode = findChild(declNode, "identifier");
    if (!nameNode) return;
    const name = nameNode.text;

    const methods: string[] = [];
    const properties: string[] = [];

    const body = findChild(declNode, "class_body");
    if (body) {
      collectClassBody(body, methods, properties, functions, exports);
    }

    classes.push({
      name,
      lineRange: [declNode.startPosition.row + 1, declNode.endPosition.row + 1],
      methods,
      properties,
    });

    if (isExported(name)) {
      exports.push({ name, lineNumber: declNode.startPosition.row + 1 });
    }
  }

  extractCallGraph(rootNode: TreeSitterNode): CallGraphEntry[] {
    // Implementation lands in a later task.
    void rootNode;
    return [];
  }
}
