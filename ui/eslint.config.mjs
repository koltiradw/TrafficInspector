import jseslint from "@eslint/js";
import tseslint from "typescript-eslint";
import jsxa11y from "eslint-plugin-jsx-a11y";
import reacteslint from "eslint-plugin-react";

export default tseslint.config(
	{
		ignores: ["*.config.{js,mjs}", "build-scripts/*", "static/*", "build/*", "dev/*"],
	},
	{
		files: ["src/**/*.js"],
		...tseslint.configs.disableTypeChecked,
	},
	{
		files: ["src/**/*.tsx"],
		plugins: { react: reacteslint, jsxa11y },
	},
	...tseslint.configs.recommendedTypeChecked,
	{
		files: ["src/**/*.{ts,tsx}"],
		languageOptions: {
			ecmaVersion: "latest",
			sourceType: "module",
			parserOptions: { ecmaFeatures: { jsx: true } },
		},
		rules: {
			"@typescript-eslint/consisent-type-definitions": 0,
			"@typescript-eslint/no-unsafe-member-access": 0,
			"@typescript-eslint/no-unsafe-argument": 0,
			"@typescript-eslint/no-unsafe-assignment": 0,
			"@typescript-eslint/no-floating-promises": 0,
			"@typescript-eslint/no-unsafe-return": 0,
			"@typescript-eslint/no-empty-function": 0,
			"@typescript-eslint/array-type": [1, { default: "array-simple", readonly: "array" }],
			"@typescript-eslint/no-unsafe-call": 0,
			"@typescript-eslint/no-require-imports": 1,
			"@typescript-eslint/unbound-method": 1,
			"@typescript-eslint/no-explicit-any": 1,
			"@typescript-eslint/no-base-to-string": 1,
			"@typescript-eslint/no-misused-promises": [1, { checksVoidReturn: { arguments: false } }],
			"@typescript-eslint/no-unnecessary-type-assertion": 1,
			"@typescript-eslint/no-redundant-type-constituents": 1,
			"@typescript-eslint/consistent-indexed-object-style": 1,
			"@typescript-eslint/consistent-type-imports": 1,
			"@typescript-eslint/no-unused-vars": [
				1,
				{
					argsIgnorePattern: "^_",
					caughtErrors: "none",
					destructuredArrayIgnorePattern: "^_",
					ignoreRestSiblings: true,
				},
			],
			"@typescript-eslint/restrict-template-expressions": [1, { allowArray: true }],
		},
	},
	{
		languageOptions: {
			parserOptions: {
				projectService: true,
				tsConfigRootDir: import.meta.dirname,
			},
		},
	}
);
