import { describe, it, expect } from "vitest";
import { LanguageRegistry } from "../languages/language-registry.js";
import { typescriptConfig } from "../languages/configs/typescript.js";
import { pythonConfig } from "../languages/configs/python.js";

describe("LanguageRegistry", () => {
  it("registers and retrieves a language config by id", () => {
    const registry = new LanguageRegistry();
    registry.register(typescriptConfig);
    expect(registry.getById("typescript")).toEqual(typescriptConfig);
  });

  it("retrieves config by file extension", () => {
    const registry = new LanguageRegistry();
    registry.register(typescriptConfig);
    expect(registry.getByExtension(".ts")?.id).toBe("typescript");
    expect(registry.getByExtension(".tsx")?.id).toBe("typescript");
  });

  it("retrieves config for a file path", () => {
    const registry = new LanguageRegistry();
    registry.register(typescriptConfig);
    registry.register(pythonConfig);
    expect(registry.getForFile("src/index.ts")?.id).toBe("typescript");
    expect(registry.getForFile("app/models.py")?.id).toBe("python");
  });

  it("returns null for unknown extensions", () => {
    const registry = new LanguageRegistry();
    registry.register(typescriptConfig);
    expect(registry.getByExtension(".xyz")).toBeNull();
    expect(registry.getForFile("file.unknown")).toBeNull();
  });

  it("returns null for files without extensions", () => {
    const registry = new LanguageRegistry();
    expect(registry.getForFile("Makefile")).toBeNull();
  });

  it("lists all registered languages", () => {
    const registry = new LanguageRegistry();
    registry.register(typescriptConfig);
    registry.register(pythonConfig);
    const all = registry.getAllLanguages();
    expect(all).toHaveLength(2);
    expect(all.map(c => c.id)).toContain("typescript");
    expect(all.map(c => c.id)).toContain("python");
  });

  describe("createDefault", () => {
    it("registers all 12 built-in language configs", () => {
      const registry = LanguageRegistry.createDefault();
      const all = registry.getAllLanguages();
      expect(all.length).toBe(12);
    });

    it("maps all expected extensions", () => {
      const registry = LanguageRegistry.createDefault();
      expect(registry.getByExtension(".ts")?.id).toBe("typescript");
      expect(registry.getByExtension(".py")?.id).toBe("python");
      expect(registry.getByExtension(".go")?.id).toBe("go");
      expect(registry.getByExtension(".rs")?.id).toBe("rust");
      expect(registry.getByExtension(".java")?.id).toBe("java");
      expect(registry.getByExtension(".rb")?.id).toBe("ruby");
      expect(registry.getByExtension(".php")?.id).toBe("php");
      expect(registry.getByExtension(".swift")?.id).toBe("swift");
      expect(registry.getByExtension(".kt")?.id).toBe("kotlin");
      expect(registry.getByExtension(".cs")?.id).toBe("csharp");
      expect(registry.getByExtension(".cpp")?.id).toBe("cpp");
      expect(registry.getByExtension(".js")?.id).toBe("javascript");
    });

    it("has no duplicate extension mappings across configs", () => {
      const registry = LanguageRegistry.createDefault();
      const all = registry.getAllLanguages();
      const allExtensions: string[] = [];
      for (const config of all) {
        allExtensions.push(...config.extensions);
      }
      const unique = new Set(allExtensions);
      expect(unique.size).toBe(allExtensions.length);
    });

    it("every config has at least one concept", () => {
      const registry = LanguageRegistry.createDefault();
      for (const config of registry.getAllLanguages()) {
        expect(config.concepts.length).toBeGreaterThan(0);
      }
    });
  });
});
