#!/usr/bin/env node
/* eslint-disable no-console */

const fs = require('fs');
const path = require('path');

const { CLIENT_TO_SERVER_MESSAGE_TYPES } = require('../../shared/NetworkMessageCatalog.cjs');

const ROOT_DIR = path.resolve(__dirname, '..', '..');
const ALLOWED_EXTRA_ROUTER_TYPES = Object.freeze([
  // Legacy inbound handler kept for backward compatibility cleanup.
  'explosion_created'
]);
const LEGACY_ALIASES = Object.freeze({
  equp_item: 'equip_item'
});

function readFile(relativePath) {
  const fullPath = path.join(ROOT_DIR, relativePath);
  return fs.readFileSync(fullPath, 'utf8');
}

function canonicalMessageType(type) {
  return LEGACY_ALIASES[type] || type;
}

function uniqueCanonical(values) {
  return new Set(values.map(canonicalMessageType));
}

function extractBalancedBlock(source, openBraceIndex) {
  let depth = 0;
  for (let i = openBraceIndex; i < source.length; i++) {
    const ch = source[i];
    if (ch === '{') depth++;
    if (ch === '}') {
      depth--;
      if (depth === 0) {
        return source.slice(openBraceIndex, i + 1);
      }
    }
  }
  throw new Error('Unable to extract balanced block.');
}

function extractObjectKeys(source, declarationToken) {
  const declarationIndex = source.indexOf(declarationToken);
  if (declarationIndex === -1) {
    throw new Error(`Declaration token not found: ${declarationToken}`);
  }

  const objectOpenIndex = source.indexOf('{', declarationIndex);
  if (objectOpenIndex === -1) {
    throw new Error(`Object open brace not found for: ${declarationToken}`);
  }

  const objectBlock = extractBalancedBlock(source, objectOpenIndex);
  const keyRegex = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*:/gm;
  const keys = [];
  let match;
  while ((match = keyRegex.exec(objectBlock)) !== null) {
    keys.push(match[1]);
  }
  return keys;
}

function extractSwitchCasesFromFunction(source, functionToken, switchToken) {
  const functionIndex = source.indexOf(functionToken);
  if (functionIndex === -1) {
    throw new Error(`Function token not found: ${functionToken}`);
  }

  const functionOpenIndex = source.indexOf('{', functionIndex);
  if (functionOpenIndex === -1) {
    throw new Error(`Function open brace not found: ${functionToken}`);
  }

  const functionBlock = extractBalancedBlock(source, functionOpenIndex);
  const switchIndex = functionBlock.indexOf(switchToken);
  if (switchIndex === -1) {
    throw new Error(`Switch token not found in function: ${switchToken}`);
  }

  const switchOpenIndex = functionBlock.indexOf('{', switchIndex);
  if (switchOpenIndex === -1) {
    throw new Error(`Switch open brace not found: ${switchToken}`);
  }

  const switchBlock = extractBalancedBlock(functionBlock, switchOpenIndex);
  const caseRegex = /case\s+'([^']+)'/g;
  const cases = [];
  let match;
  while ((match = caseRegex.exec(switchBlock)) !== null) {
    cases.push(match[1]);
  }
  return cases;
}

function diff(referenceSet, candidateSet) {
  const missing = [];
  for (const value of referenceSet) {
    if (!candidateSet.has(value)) {
      missing.push(value);
    }
  }
  return missing.sort();
}

function extras(candidateSet, referenceSet) {
  const additional = [];
  for (const value of candidateSet) {
    if (!referenceSet.has(value)) {
      additional.push(value);
    }
  }
  return additional.sort();
}

function main() {
  const messageRouterSource = readFile('server/core/connection/MessageRouter.cjs');
  const inputValidatorSource = readFile('server/core/InputValidator.cjs');

  const routerHandlers = extractObjectKeys(messageRouterSource, 'const handlers =');
  const validatorCases = extractSwitchCasesFromFunction(
    inputValidatorSource,
    'validate(messageType, data)',
    'switch (messageType)'
  );

  const catalogSet = uniqueCanonical(CLIENT_TO_SERVER_MESSAGE_TYPES);
  const handlerSet = uniqueCanonical(routerHandlers);
  const validatorSet = uniqueCanonical(validatorCases);

  const missingInRouter = diff(catalogSet, handlerSet);
  const missingInValidator = diff(catalogSet, validatorSet);
  const extraInRouter = extras(handlerSet, catalogSet).filter(
    (type) => !ALLOWED_EXTRA_ROUTER_TYPES.includes(type)
  );
  const extraInValidator = extras(validatorSet, catalogSet);

  const errors = [];
  if (missingInRouter.length > 0) {
    errors.push(`Missing router handlers for: ${missingInRouter.join(', ')}`);
  }
  if (missingInValidator.length > 0) {
    errors.push(`Missing validator branches for: ${missingInValidator.join(', ')}`);
  }
  if (extraInRouter.length > 0) {
    errors.push(`Router has undeclared client types: ${extraInRouter.join(', ')}`);
  }
  if (extraInValidator.length > 0) {
    errors.push(`Validator has undeclared client types: ${extraInValidator.join(', ')}`);
  }

  if (errors.length > 0) {
    console.error('[quality] network-contract-check FAILED');
    for (const error of errors) {
      console.error(`- ${error}`);
    }
    process.exit(1);
  }

  console.log('[quality] network-contract-check OK');
  console.log(`- catalog messages: ${catalogSet.size}`);
  console.log(`- router handlers: ${handlerSet.size}`);
  console.log(`- validator cases: ${validatorSet.size}`);
  const legacyExtras = extras(handlerSet, catalogSet).filter((type) =>
    ALLOWED_EXTRA_ROUTER_TYPES.includes(type)
  );
  if (legacyExtras.length > 0) {
    console.log(`- allowed legacy router types: ${legacyExtras.join(', ')}`);
  }
}

try {
  main();
} catch (error) {
  console.error(`[quality] network-contract-check ERROR: ${error.message}`);
  process.exit(1);
}
