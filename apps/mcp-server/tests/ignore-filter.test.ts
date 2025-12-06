import ignore from "ignore";
import { describe, expect, it } from "vitest";

// Import the same patterns from src/index.ts
const UNIVERSAL_IGNORE_PATTERNS = [
	// JavaScript/Node.js
	"node_modules/",
	"package-lock.json",
	"yarn.lock",
	"pnpm-lock.yaml",
	"npm-debug.log",
	"dist/",
	"build/",
	".next/",
	".nuxt/",
	".cache/",
	"coverage/",

	// Python
	"__pycache__/",
	"*.pyc",
	"*.pyo",
	"*.pyd",
	".Python",
	"venv/",
	".venv/",
	"env/",
	"pip-log.txt",
	".pytest_cache/",
	".mypy_cache/",
	"*.egg-info/",
	".tox/",

	// Java/Kotlin
	"target/",
	"*.class",
	"*.jar",
	"*.war",
	".gradle/",
	"build/",
	".mvn/",

	// C/C++
	"*.o",
	"*.obj",
	"*.exe",
	"*.dll",
	"*.so",
	"*.dylib",
	"*.a",
	"*.lib",

	// Rust
	"target/",
	"Cargo.lock",

	// Go
	"vendor/",
	"*.test",
	"*.out",

	// Ruby
	"Gemfile.lock",
	".bundle/",
	"vendor/bundle/",

	// PHP
	"vendor/",
	"composer.lock",

	// .NET
	"bin/",
	"obj/",
	"*.dll",
	"*.exe",
	"*.pdb",

	// Build outputs (general)
	"out/",
	"output/",
	"release/",
	"debug/",

	// IDE/Editor files
	".vscode/",
	".idea/",
	"*.swp",
	"*.swo",
	"*~",
	".DS_Store",
	"Thumbs.db",

	// VCS
	".git/",
	".svn/",
	".hg/",

	// Logs
	"*.log",
	"logs/",
];

describe("Ignore Filter", () => {
	describe("JavaScript/Node.js patterns", () => {
		it("should ignore node_modules", () => {
			const ig = ignore().add(UNIVERSAL_IGNORE_PATTERNS);
			expect(ig.ignores("node_modules/express/index.js")).toBe(true);
			expect(ig.ignores("src/node_modules/test.js")).toBe(true);
		});

		it("should ignore lock files", () => {
			const ig = ignore().add(UNIVERSAL_IGNORE_PATTERNS);
			expect(ig.ignores("package-lock.json")).toBe(true);
			expect(ig.ignores("yarn.lock")).toBe(true);
			expect(ig.ignores("pnpm-lock.yaml")).toBe(true);
		});

		it("should ignore build directories", () => {
			const ig = ignore().add(UNIVERSAL_IGNORE_PATTERNS);
			expect(ig.ignores("dist/bundle.js")).toBe(true);
			expect(ig.ignores("build/output.js")).toBe(true);
			expect(ig.ignores(".next/server.js")).toBe(true);
			expect(ig.ignores("coverage/index.html")).toBe(true);
		});

		it("should NOT ignore source files", () => {
			const ig = ignore().add(UNIVERSAL_IGNORE_PATTERNS);
			expect(ig.ignores("src/index.ts")).toBe(false);
			expect(ig.ignores("lib/utils.js")).toBe(false);
		});
	});

	describe("Python patterns", () => {
		it("should ignore __pycache__", () => {
			const ig = ignore().add(UNIVERSAL_IGNORE_PATTERNS);
			expect(ig.ignores("__pycache__/module.pyc")).toBe(true);
			expect(ig.ignores("tests/__pycache__/test.pyc")).toBe(true);
		});

		it("should ignore .pyc files", () => {
			const ig = ignore().add(UNIVERSAL_IGNORE_PATTERNS);
			expect(ig.ignores("module.pyc")).toBe(true);
			expect(ig.ignores("src/utils.pyc")).toBe(true);
		});

		it("should ignore virtual environments", () => {
			const ig = ignore().add(UNIVERSAL_IGNORE_PATTERNS);
			expect(ig.ignores("venv/lib/python3.9/site-packages")).toBe(true);
			expect(ig.ignores(".venv/bin/python")).toBe(true);
			expect(ig.ignores("env/activate")).toBe(true);
		});

		it("should ignore test/cache directories", () => {
			const ig = ignore().add(UNIVERSAL_IGNORE_PATTERNS);
			expect(ig.ignores(".pytest_cache/session.json")).toBe(true);
			expect(ig.ignores(".mypy_cache/3.9/module.data.json")).toBe(true);
		});

		it("should NOT ignore .py files", () => {
			const ig = ignore().add(UNIVERSAL_IGNORE_PATTERNS);
			expect(ig.ignores("src/main.py")).toBe(false);
			expect(ig.ignores("tests/test_module.py")).toBe(false);
		});
	});

	describe("Java/Kotlin patterns", () => {
		it("should ignore target directory", () => {
			const ig = ignore().add(UNIVERSAL_IGNORE_PATTERNS);
			expect(ig.ignores("target/classes/Main.class")).toBe(true);
		});

		it("should ignore compiled classes", () => {
			const ig = ignore().add(UNIVERSAL_IGNORE_PATTERNS);
			expect(ig.ignores("Main.class")).toBe(true);
			expect(ig.ignores("com/example/App.class")).toBe(true);
		});

		it("should ignore JARs and WARs", () => {
			const ig = ignore().add(UNIVERSAL_IGNORE_PATTERNS);
			expect(ig.ignores("app.jar")).toBe(true);
			expect(ig.ignores("webapp.war")).toBe(true);
		});

		it("should NOT ignore .java/.kt source files", () => {
			const ig = ignore().add(UNIVERSAL_IGNORE_PATTERNS);
			expect(ig.ignores("src/Main.java")).toBe(false);
			expect(ig.ignores("src/App.kt")).toBe(false);
		});
	});

	describe("C/C++ patterns", () => {
		it("should ignore object files", () => {
			const ig = ignore().add(UNIVERSAL_IGNORE_PATTERNS);
			expect(ig.ignores("main.o")).toBe(true);
			expect(ig.ignores("module.obj")).toBe(true);
		});

		it("should ignore compiled binaries", () => {
			const ig = ignore().add(UNIVERSAL_IGNORE_PATTERNS);
			expect(ig.ignores("app.exe")).toBe(true);
			expect(ig.ignores("libutils.so")).toBe(true);
			expect(ig.ignores("library.dll")).toBe(true);
			expect(ig.ignores("libstatic.a")).toBe(true);
		});

		it("should NOT ignore source files", () => {
			const ig = ignore().add(UNIVERSAL_IGNORE_PATTERNS);
			expect(ig.ignores("src/main.c")).toBe(false);
			expect(ig.ignores("include/header.h")).toBe(false);
			expect(ig.ignores("src/app.cpp")).toBe(false);
		});
	});

	describe("Rust patterns", () => {
		it("should ignore target directory", () => {
			const ig = ignore().add(UNIVERSAL_IGNORE_PATTERNS);
			expect(ig.ignores("target/debug/app")).toBe(true);
			expect(ig.ignores("target/release/binary")).toBe(true);
		});

		it("should ignore Cargo.lock", () => {
			const ig = ignore().add(UNIVERSAL_IGNORE_PATTERNS);
			expect(ig.ignores("Cargo.lock")).toBe(true);
		});

		it("should NOT ignore .rs files or Cargo.toml", () => {
			const ig = ignore().add(UNIVERSAL_IGNORE_PATTERNS);
			expect(ig.ignores("src/main.rs")).toBe(false);
			expect(ig.ignores("Cargo.toml")).toBe(false);
		});
	});

	describe("Go patterns", () => {
		it("should ignore vendor directory", () => {
			const ig = ignore().add(UNIVERSAL_IGNORE_PATTERNS);
			expect(ig.ignores("vendor/github.com/pkg/lib.go")).toBe(true);
		});

		it("should ignore test binaries", () => {
			const ig = ignore().add(UNIVERSAL_IGNORE_PATTERNS);
			expect(ig.ignores("main.test")).toBe(true);
			expect(ig.ignores("app.out")).toBe(true);
		});

		it("should NOT ignore .go files", () => {
			const ig = ignore().add(UNIVERSAL_IGNORE_PATTERNS);
			expect(ig.ignores("main.go")).toBe(false);
			expect(ig.ignores("pkg/utils/helper.go")).toBe(false);
		});
	});

	describe("Ruby patterns", () => {
		it("should ignore Gemfile.lock", () => {
			const ig = ignore().add(UNIVERSAL_IGNORE_PATTERNS);
			expect(ig.ignores("Gemfile.lock")).toBe(true);
		});

		it("should ignore bundle directory", () => {
			const ig = ignore().add(UNIVERSAL_IGNORE_PATTERNS);
			expect(ig.ignores(".bundle/config")).toBe(true);
			expect(ig.ignores("vendor/bundle/ruby/3.0/gems")).toBe(true);
		});

		it("should NOT ignore .rb files", () => {
			const ig = ignore().add(UNIVERSAL_IGNORE_PATTERNS);
			expect(ig.ignores("app/models/user.rb")).toBe(false);
			expect(ig.ignores("Gemfile")).toBe(false);
		});
	});

	describe("PHP patterns", () => {
		it("should ignore vendor directory", () => {
			const ig = ignore().add(UNIVERSAL_IGNORE_PATTERNS);
			expect(ig.ignores("vendor/autoload.php")).toBe(true);
			expect(ig.ignores("vendor/composer/installed.json")).toBe(true);
		});

		it("should ignore composer.lock", () => {
			const ig = ignore().add(UNIVERSAL_IGNORE_PATTERNS);
			expect(ig.ignores("composer.lock")).toBe(true);
		});

		it("should NOT ignore .php files", () => {
			const ig = ignore().add(UNIVERSAL_IGNORE_PATTERNS);
			expect(ig.ignores("src/Controller/UserController.php")).toBe(false);
			expect(ig.ignores("composer.json")).toBe(false);
		});
	});

	describe(".NET patterns", () => {
		it("should ignore bin and obj directories", () => {
			const ig = ignore().add(UNIVERSAL_IGNORE_PATTERNS);
			expect(ig.ignores("bin/Debug/App.dll")).toBe(true);
			expect(ig.ignores("obj/Release/App.pdb")).toBe(true);
		});

		it("should NOT ignore .cs files", () => {
			const ig = ignore().add(UNIVERSAL_IGNORE_PATTERNS);
			expect(ig.ignores("src/Program.cs")).toBe(false);
			expect(ig.ignores("Models/User.cs")).toBe(false);
		});
	});

	describe("IDE and OS patterns", () => {
		it("should ignore IDE directories", () => {
			const ig = ignore().add(UNIVERSAL_IGNORE_PATTERNS);
			expect(ig.ignores(".vscode/settings.json")).toBe(true);
			expect(ig.ignores(".idea/workspace.xml")).toBe(true);
		});

		it("should ignore editor swap files", () => {
			const ig = ignore().add(UNIVERSAL_IGNORE_PATTERNS);
			expect(ig.ignores("file.swp")).toBe(true);
			expect(ig.ignores("file.swo")).toBe(true);
			expect(ig.ignores("file~")).toBe(true);
		});

		it("should ignore OS files", () => {
			const ig = ignore().add(UNIVERSAL_IGNORE_PATTERNS);
			expect(ig.ignores(".DS_Store")).toBe(true);
			expect(ig.ignores("Thumbs.db")).toBe(true);
		});
	});

	describe("VCS patterns", () => {
		it("should ignore .git directory", () => {
			const ig = ignore().add(UNIVERSAL_IGNORE_PATTERNS);
			expect(ig.ignores(".git/config")).toBe(true);
			expect(ig.ignores(".git/objects/abc123")).toBe(true);
		});

		it("should ignore other VCS directories", () => {
			const ig = ignore().add(UNIVERSAL_IGNORE_PATTERNS);
			expect(ig.ignores(".svn/entries")).toBe(true);
			expect(ig.ignores(".hg/hgrc")).toBe(true);
		});
	});

	describe("Log patterns", () => {
		it("should ignore log files", () => {
			const ig = ignore().add(UNIVERSAL_IGNORE_PATTERNS);
			expect(ig.ignores("app.log")).toBe(true);
			expect(ig.ignores("error.log")).toBe(true);
			expect(ig.ignores("logs/debug.log")).toBe(true);
		});

		it("should ignore logs directory", () => {
			const ig = ignore().add(UNIVERSAL_IGNORE_PATTERNS);
			expect(ig.ignores("logs/access.txt")).toBe(true);
		});
	});

	describe("Cross-platform path handling", () => {
		it("should handle Windows-style paths", () => {
			const ig = ignore().add(UNIVERSAL_IGNORE_PATTERNS);
			const normalizedPath = "node_modules\\express\\index.js".replace(
				/\\/g,
				"/",
			);
			expect(ig.ignores(normalizedPath)).toBe(true);
		});

		it("should handle Unix-style paths", () => {
			const ig = ignore().add(UNIVERSAL_IGNORE_PATTERNS);
			expect(ig.ignores("node_modules/express/index.js")).toBe(true);
		});
	});
});
