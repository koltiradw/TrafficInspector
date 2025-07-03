import fs from "fs-extra";
import path from "path";

/**
 * @typedef {Object} CopyParams
 * @property {string} from - The starting value of the range.
 * @property {string} to - The ending value of the range.
 */

/**
 * @param {CopyParams|CopyParams[]} filepaths
 * @param {((msg, level) => {}) | undefined} log
 *
 * @example
 * copy({ from: './index.html', to: 'static/index.html' });
 * processRange([{ from: './1.index.html', to: 'static/1.index.html' }, { from: './2.index.html', to: 'static/2.index.html' }]);
 * */
export const copy = (filepaths, log) => ({
	name: "copy",
	setup(build) {
		build.onEnd(() => {
			/**
			 * @param {string} from - filepath to copy
			 * @param {string} to - filepath to copy to
			 * */
			const _copy = (from, to) => {
				try {
					const srcPath = path.resolve(from);
					const destPath = path.resolve(to);
					fs.copy(srcPath, destPath, {
						overwrite: true,
						errorOnExist: false,
					});

					if (log) {
						log(`📄 Copied ${from} to ${to}`, "info");
					} else {
						console.log(`📄 Copied ${from} to ${to}`);
					}
				} catch (err) {
					if (log) {
						log("❌ Failed to copy: " + String(err), "error");
					} else {
						console.error("❌ Failed to copy:", err);
					}
				}
			};

			if (Array.isArray(filepaths)) {
				filepaths.forEach(({ from, to }) => _copy(from, to));
			} else {
				_copy(filepaths.from, filepaths.to);
			}
		});
	},
});
