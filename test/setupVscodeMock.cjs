const fs = require("node:fs/promises");
const path = require("node:path");
const Module = require("node:module");

class RelativePattern {
  constructor(base, pattern) {
    this.base = base;
    this.pattern = pattern;
  }
}

class Uri {
  constructor(fsPath) {
    this.fsPath = path.resolve(fsPath);
  }

  static file(filePath) {
    return new Uri(filePath);
  }
}

async function collectFiles(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await collectFiles(fullPath)));
    } else {
      files.push(fullPath);
    }
  }
  return files;
}

function globToRegExp(glob) {
  function globFragmentToRegex(fragment) {
    let normalized = fragment
      .replace(/[.+^${}()|[\]\\]/g, "\\$&")
      .replace(/\*\*\//g, "::DOUBLE_STAR_DIR::")
      .replace(/\*\*/g, "::DOUBLE_STAR::")
      .replace(/\*/g, "[^/]*")
      .replace(/::DOUBLE_STAR::/g, ".*")
      .replace(/::DOUBLE_STAR_DIR::/g, "(?:.*/)?");

    return normalized;
  }

  const groups = [];
  const grouped = glob.replace(/\{([^}]+)\}/g, (_, group) => {
    const i = groups.length;
    groups.push(group.split(",").map((item) => item.trim()));
    return `::GROUP_${i}::`;
  });

  let normalized = globFragmentToRegex(grouped);

  groups.forEach((items, index) => {
    const groupExpr = items.map((item) => globFragmentToRegex(item)).join("|");
    normalized = normalized.replace(`::GROUP_${index}::`, `(?:${groupExpr})`);
  });

  return new RegExp(`^${normalized}$`);
}

const workspace = {
  fs: {
    async createDirectory(uri) {
      await fs.mkdir(uri.fsPath, { recursive: true });
    },
    async writeFile(uri, data) {
      await fs.writeFile(uri.fsPath, data);
    },
    async readFile(uri) {
      return fs.readFile(uri.fsPath);
    },
    async stat(uri) {
      return fs.stat(uri.fsPath);
    }
  },
  async findFiles(relativePattern) {
    const root = path.resolve(relativePattern.base);
    const all = await collectFiles(root);
    const matcher = globToRegExp(relativePattern.pattern);
    return all
      .map((absPath) => ({ absPath, relPath: path.relative(root, absPath).split(path.sep).join("/") }))
      .filter(({ relPath }) => matcher.test(relPath))
      .map(({ absPath }) => Uri.file(absPath));
  }
};

const vscodeMock = {
  workspace,
  Uri,
  RelativePattern
};

const originalLoad = Module._load;
Module._load = function patchedLoad(request, parent, isMain) {
  if (request === "vscode") {
    return vscodeMock;
  }
  return originalLoad.call(this, request, parent, isMain);
};
