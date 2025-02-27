import globals from "globals";
import path from "node:path";
import { fileURLToPath } from "node:url";
import js from "@eslint/js";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const compat = new FlatCompat({
    baseDirectory: __dirname,
    recommendedConfig: js.configs.recommended,
    allConfig: js.configs.all
});

export default [{
    ignores: [
        "**/node_modules/*",
        "site/*",
        "**/*.min.mjs",
        "**/schema.js",
        "**/keymap.js",
        "**/inputrules.js",
        "**/currencyRates.js",
        "**/temml.js",
    ],
}, ...compat.extends("eslint:recommended"), {
    languageOptions: {
        globals: {
            ...globals.node,
            ...globals.browser,
            BigInt: true,
        },

        ecmaVersion: 9,
        sourceType: "module",
    },

    rules: {
        "arrow-spacing": 2,

        "brace-style": [2, "1tbs", {
            allowSingleLine: true,
        }],

        camelcase: [2, {
            properties: "never",
        }],

        "comma-dangle": [2, "never"],

        "comma-spacing": [2, {
            before: false,
            after: true,
        }],

        "constructor-super": 2,
        curly: 2,
        "eol-last": 2,
        eqeqeq: [2, "allow-null"],
        "guard-for-in": 2,
        indent: "off",

        "indent-legacy": [2, 2, {
            SwitchCase: 1,
        }],

        "keyword-spacing": 2,
        "linebreak-style": [2, "unix"],

        "max-len": [2, 95, 4, {
            ignoreUrls: true,
            ignoreRegExpLiterals: true,
        }],

        "new-cap": 2,
        "no-alert": 2,
        "no-array-constructor": 2,
        "no-console": 2,
        "no-const-assign": 2,
        "no-debugger": 2,
        "no-dupe-class-members": 2,
        "no-dupe-keys": 2,
        "no-extra-bind": 2,
        "no-misleading-character-class": 0,
        "no-new": 2,
        "no-new-func": 2,
        "no-new-object": 2,
        "no-spaced-func": 2,
        "no-this-before-super": 2,
        "no-throw-literal": 2,
        "no-trailing-spaces": 2,
        "no-undef": 2,
        "no-unexpected-multiline": 2,
        "no-unreachable": 2,

        "no-unused-vars": [2, {
            args: "none",
            varsIgnorePattern: "^_*$",
        }],

        "no-useless-call": 2,
        "no-var": 2,
        "no-with": 2,
        "object-curly-spacing": [2, "always"],
        "one-var": [2, "never"],
        "prefer-const": 2,
        "prefer-spread": 0,
        semi: 0,
        "space-before-blocks": 2,
        "space-before-function-paren": [2, "never"],
        "space-infix-ops": 2,
        "space-unary-ops": 2,
        "prefer-template": 0,
        "arrow-parens": 0,
        "prefer-arrow-callback": 0,
        "valid-jsdoc": 0,
        "require-jsdoc": 0,
    },
}];