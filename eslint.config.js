import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import tseslint from 'typescript-eslint';

const correctnessRules = {
  'eqeqeq': ['error', 'always', { null: 'ignore' }],
  'no-async-promise-executor': 'error',
  'no-case-declarations': 'error',
  'no-compare-neg-zero': 'error',
  'no-cond-assign': ['error', 'except-parens'],
  'no-constant-binary-expression': 'error',
  'no-debugger': 'error',
  'no-duplicate-case': 'error',
  'no-duplicate-imports': 'error',
  'no-fallthrough': 'error',
  'no-irregular-whitespace': 'error',
  'no-loss-of-precision': 'error',
  'no-promise-executor-return': 'error',
  'no-prototype-builtins': 'error',
  'no-self-assign': 'error',
  'no-unsafe-finally': 'error',
  'no-unsafe-optional-chaining': 'error',
  'no-useless-catch': 'error',
  'use-isnan': 'error',
  'valid-typeof': 'error',
};

export default tseslint.config(
  {
    name: 'omi/ignores',
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/coverage/**',
      'src-tauri/gen/**',
      'src-tauri/target/**',
      'server/src/generated/**',
      'src/i18n/helpDetailed.generated.ts',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    name: 'omi/browser',
    files: ['src/**/*.{ts,tsx,mts,cts}'],
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.es2024,
      },
    },
  },
  {
    name: 'omi/node',
    files: [
      '*.{js,mjs,cjs,ts,mts,cts}',
      'scripts/**/*.{js,mjs,cjs,ts,mts,cts}',
      'server/**/*.{js,mjs,cjs,ts,mts,cts}',
      'tests/**/*.{js,mjs,cjs,ts,mts,cts}',
      'packages/**/*.{js,mjs,cjs,ts,mts,cts}',
    ],
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.es2024,
      },
    },
  },
  {
    name: 'omi/playwright',
    files: ['e2e/**/*.{ts,tsx,mts,cts}'],
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
        ...globals.es2024,
      },
    },
  },
  {
    name: 'omi/react-hooks',
    files: ['src/**/*.{ts,tsx}'],
    plugins: reactHooks.configs.flat.recommended.plugins,
    rules: {
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'error',
    },
  },
  {
    name: 'omi/correctness',
    files: ['**/*.{js,mjs,cjs,ts,tsx,mts,cts}'],
    languageOptions: {
      ecmaVersion: 2024,
      sourceType: 'module',
      parserOptions: {
        ecmaFeatures: { jsx: true },
      },
    },
    linterOptions: {
      reportUnusedDisableDirectives: 'error',
    },
    rules: {
      ...correctnessRules,
      'no-empty': ['error', { allowEmptyCatch: true }],
      'no-useless-assignment': 'error',
      'no-useless-escape': 'error',
      'preserve-caught-error': 'error',
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
          destructuredArrayIgnorePattern: '^_',
          varsIgnorePattern: '^_',
        },
      ],
    },
  },
  {
    name: 'omi/control-character-sanitizers',
    files: [
      'server/src/import/pdf/pdfImportService.ts',
      'server/src/services/reviewManuscriptService.ts',
      'src/services/embeddedCss.ts',
    ],
    rules: {
      // These expressions deliberately reject C0 control characters at trust
      // boundaries. The core rule otherwise remains enabled for the project.
      'no-control-regex': 'off',
    },
  },
  {
    name: 'omi/declaration-files',
    files: ['**/*.d.ts'],
    rules: {
      '@typescript-eslint/no-empty-object-type': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': 'off',
    },
  },
  {
    name: 'omi/test-fixtures',
    files: ['tests/**/*.{ts,tsx,mts,cts}'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },
);
