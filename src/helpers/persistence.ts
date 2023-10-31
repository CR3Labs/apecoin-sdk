import fs from 'fs-extra';
import path from 'path';

/**
 * Read a file and parse as JSON.
 * @param {string} filename
 */
export async function loadJSON(filename: string) {
    return (await fs.promises.readFile(path.join(__dirname, filename))).toString();
}

/**
 * Write a file to `/.out`.
 * @param {string} filename
 * @param {*} data
 */
export async function persistOutput<T extends string | NodeJS.ArrayBufferView>(filename: string, data: T) {
    await fs.outputFile(path.join(__dirname, `.out`, filename), data);
}

/**
 * Read a file from `/.out`.
 * @param {string} filename
 */
export async function readFromOutput(filename: string) {
    return JSON.parse((await fs.promises.readFile(path.join(__dirname, `.out`, filename))).toString());
}