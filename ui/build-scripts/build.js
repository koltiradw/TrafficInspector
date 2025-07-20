import * as esbuild from "esbuild";
import CssModulesPlugin from "esbuild-css-modules-plugin";

import { copy } from "./internal/plugins.js";

await esbuild.build({
	format: "esm",
	platform: "browser",
	logLevel: "info",
	bundle: true,
	minify: true,
	outfile: "build/index.js",
	entryPoints: ["src/index.js"],
	tsconfig: "tsconfig.json",
	jsx: "automatic",
	jsxDev: false,
	target: ["chrome120", "firefox130"],
	treeShaking: true,
	plugins: [
		copy([
			{ from: "assets", to: "build/assets" },
			{ from: "build-templates/index.prod.html", to: "build/index.html" },
		]),
		CssModulesPlugin({
			inject: false,
			localsConvention: "camelCase",
			pattern: "[local]___[hash]",
		}),
	],
});
