const fs = require('fs');
const path = require('path');
const Module = require('module');
const ts = require('typescript');

const projectRoot = path.resolve(__dirname, '..');
const srcRoot = path.join(projectRoot, 'src');

const originalResolveFilename = Module._resolveFilename;
Module._resolveFilename = function (request, parent, isMain, options) {
  let resolvedRequest = request;
  if (request.startsWith('@/')) {
    resolvedRequest = path.join(srcRoot, request.slice(2));
  }

  // Try resolving with .ts or /index.ts if needed
  if (
    resolvedRequest.startsWith('.') ||
    path.isAbsolute(resolvedRequest)
  ) {
    const baseDir = parent ? path.dirname(parent.filename) : projectRoot;
    const candidateBase = path.isAbsolute(resolvedRequest)
      ? resolvedRequest
      : path.resolve(baseDir, resolvedRequest);

    const candidates = [
      candidateBase,
      `${candidateBase}.ts`,
      `${candidateBase}.tsx`,
      path.join(candidateBase, 'index.ts'),
      path.join(candidateBase, 'index.tsx'),
    ];

    for (const c of candidates) {
      if (fs.existsSync(c) && fs.statSync(c).isFile()) {
        return c;
      }
    }
  }

  return originalResolveFilename.call(
    this,
    resolvedRequest,
    parent,
    isMain,
    options
  );
};

require.extensions['.ts'] = function (module, filename) {
  const source = fs.readFileSync(filename, 'utf8');
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
      esModuleInterop: true,
      jsx: ts.JsxEmit.ReactJSX,
    },
    fileName: filename,
  });
  module._compile(outputText, filename);
};

require('./verify-platform.ts');
