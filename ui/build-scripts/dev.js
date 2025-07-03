import * as esbuild from "esbuild";
import CssModulesPlugin from "esbuild-css-modules-plugin";

import fs from "node:fs";
import path from "node:path";
import http from "node:http";

import { copy } from "./build-plugins.js";

const connections = new Set();
const changedFiles = new Set();

const debounce = (cb, timeout, instantCb) => {
	let lastCallArgs;
	let timeoutID;

	return (...args) => {
		lastCallArgs = args;
		if (timeoutID) {
			clearTimeout(timeoutID);
		}

		timeoutID = setTimeout(cb, timeout, ...lastCallArgs);
		instantCb?.(...lastCallArgs);
	};
};

const log = (msg, icon = "", sev = "info") => {
	let str = "[dev server]\t";

	if (icon.length > 0) {
		str += `${icon} ${msg}`;
	} else {
		str += msg;
	}

	console[sev](str);
};

const logRank = {
	debug: 0,
	info: 1,
	log: 1,
	table: 1,
	warning: 2,
	error: 3,
};

const makeLogger =
	(logLevel) =>
	(msg, icon = "", sev = "info") => {
		if (logRank[logLevel] <= logRank[sev]) {
			log(msg, icon, sev);
		}
	};

const logger = makeLogger("info");

// Start esbuild's server on a random local port
let ctx = await esbuild.context({
	format: "esm",
	platform: "browser",
	bundle: true,
	minify: false,
	outfile: "dev/index.js",
	entryPoints: ["src/index.js"],
	tsconfig: "tsconfig.json",
	jsx: "automatic",
	jsxDev: true,
	target: ["chrome120", "firefox130"],
	treeShaking: true,
	sourcemap: true,
	plugins: [
		copy(
			[
				{ from: "build-templates/index.dev.html", to: "dev/index.html" },
				{ from: "assets", to: "dev/assets" },
			],
			(msg, level) => logger(`[copy-plugin]\t${msg}`, "", level)
		),
		CssModulesPlugin({
			inject: false,
			localsConvention: "camelCase",
			pattern: "[local]___[hash]",
		}),
	],
});

const WATCH_DIR = path.join(import.meta.dirname, "..", "src");
const SERVE_DIR = path.join(path.dirname("."), "dev");
const INDEX = path.join(SERVE_DIR, "index.html");

const getContentType = (ext) => {
	const types = {
		".js": "application/javascript",
		".css": "text/css",
		".html": "text/html",
		".png": "image/png",
		".jpg": "image/jpeg",
		".svg": "image/svg+xml",
		".json": "application/json",
	};
	return types[ext] || "application/octet-stream";
};

const onFileChange = async () => {
	await ctx.cancel();
	logger("changed files: " + String(changedFiles));
	logger("rebuiliding...", "⌛");

	try {
		await this.ctx.rebuild();
	} catch {
		// empty handle
		// https://github.com/evanw/esbuild/issues/4218
	}
	logger("build complete!", "☑");
	let isCssOnly = Array.from(changedFiles).every((file) => file.endsWith(".css"));
	const event = isCssOnly ? "update" : "reload";

	changedFiles.clear();

	logger("sending notification to connected clients...", "⌛");
	connections.forEach((_res) => {
		_res.write(`event: ${event}\n`);
		_res.write("data:\n\n"); // SSE spec requires a `data` field to trigger an event disptach in browser
	});

	if (event === "reload") {
		connections.clear();
	}
};

const debouncedFileChangeCb = debounce(onFileChange, 500, (_, file) => changedFiles.add(file));
const ctrlFileWatch = new AbortController();

logger("building project...", "⌛");
const res = await ctx.rebuild();
logger("project built!", "☑");

fs.watch(WATCH_DIR, { recursive: true, signal: ctrlFileWatch.signal }, debouncedFileChangeCb);
logger("watching for changes at: " + WATCH_DIR, "🔎");

// Then start a proxy server on port 3000
const server = http.createServer();
server
	.on("request", (req, res) => {
		logger("requested " + req.url, undefined, "debug");

		if (/^(\\|\/)esbuild/.test(req.url)) {
			res.writeHead(200, {
				"Content-Type": "text/event-stream",
				"Cache-Control": "no-cache",
				Connection: "keep-alive",
			});
			// Set a retry interval of 10 seconds
			res.write("retry: 10000\n\n");

			connections.add(res);

			req.on("close", () => {
				res.end();
				connections.delete(res);
			});

			return;
		}

		if (/^(\\|\/)api/.test(req.url)) {
			res.writeHead(501, { "Content-Type": "application/json" });
			res.end(
				JSON.stringify({
					detail: "/api is not available in local development mode",
				})
			);

			return;
		}

		let pathname = req.url.replace(/\?version=\d+/, ""); // stripping of / or \

		let reqFile = path.join(SERVE_DIR, pathname);

		if (!(fs.existsSync(reqFile) && fs.statSync(reqFile).isFile())) {
			// 🔁 Fallback to index.html for unknown routes (SPA style)
			reqFile = INDEX;
		}

		const ext = path.extname(reqFile).toLowerCase();
		const contentType = getContentType(ext);

		fs.readFile(reqFile, (err, data) => {
			if (err) {
				res.writeHead(500, { "Content-Type": "text/plain", Content: err });
				res.end(`500 - Could not load ${reqFile}`);
			} else {
				res.writeHead(200, { "Content-Type": contentType });
				res.end(data);
			}
		});
	})
	.listen(3000, () => {
		logger("proxy server running at http://localhost:3000", "✅");
	});

process.on("SIGINT", () => {
	ctrlFileWatch.abort();
	server.close();
});
