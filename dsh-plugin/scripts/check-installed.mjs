import { readFile, readdir } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const sourceRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const profileRoot = resolve(
  process.env.DSH_PROFILE_DIR || resolve(homedir(), ".dsh/profiles/web"),
);
const installedRoot = resolve(profileRoot, "node_modules/dsh-reca-toolkit");

async function filesUnder(directory) {
  const result = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) result.push(...await filesUnder(path));
    else if (entry.isFile()) result.push(path);
  }
  return result;
}

const sourceFiles = [
  ...await filesUnder(resolve(sourceRoot, "src")),
  resolve(sourceRoot, "lib/client.js"),
];
const expectedRuntimePaths = new Set(
  sourceFiles.map((path) => relative(sourceRoot, path)),
);

const installedRuntimeFiles = [
  ...await filesUnder(resolve(installedRoot, "src")),
  resolve(installedRoot, "lib/client.js"),
];
const extraRuntimePaths = installedRuntimeFiles
  .map((path) => relative(installedRoot, path))
  .filter((path) => !expectedRuntimePaths.has(path));
if (extraRuntimePaths.length > 0) {
  throw new Error(
    `installed plugin contains stale runtime files (${extraRuntimePaths.join(", ")}); run scripts/install_dsh_plugin.sh from the repository root`,
  );
}

for (const sourcePath of sourceFiles) {
  const path = relative(sourceRoot, sourcePath);
  const installedPath = resolve(installedRoot, path);
  let installed;
  try {
    installed = await readFile(installedPath);
  } catch (error) {
    throw new Error(`installed plugin is missing ${path}; run scripts/install_dsh_plugin.sh from the repository root`, { cause: error });
  }
  const expected = await readFile(sourcePath);
  if (!installed.equals(expected)) {
    throw new Error(`installed plugin differs at ${path}; run scripts/install_dsh_plugin.sh from the repository root`);
  }
}

console.log(`ok - installed DSH plugin matches ${sourceFiles.length} runtime source files`);
