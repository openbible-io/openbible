import globals from "globals";
import tseslint from "typescript-eslint";

export default [
	{files: ["**/*.{js,mjs,cjs,ts}"]},
	{languageOptions: { globals: globals.browser }},
	...tseslint.configs.recommended,
	{
		rules: {
			'@typescript-eslint/ban-types': 'off',
			'@typescript-eslint/no-explicit-any': 'off',
			'semi': 'error'
		}
	}
];
