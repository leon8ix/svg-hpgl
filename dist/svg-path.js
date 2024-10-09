"use strict";
// M224.4,410.1,204,363s44.151-25.489,47.337,3.186,23.669,18.662,23.669,18L254.893,423.3
Object.defineProperty(exports, "__esModule", { value: true });
exports.parsePath = parsePath;
exports.parsePathSyntax = parsePathSyntax;
exports.keyPathInstruction = keyPathInstruction;
const cmdLengths = { M: 2, L: 2, H: 1, V: 1, C: 6, S: 4, Q: 4, T: 2, A: 7, Z: 0 };
/** All-in-one SVG path parsing function, returns `readable`, `absolute` path commands */
function parsePath(d) {
    return toAbsolute(parsePathSyntax(d).map(ins => keyPathInstruction(ins)));
}
/** Basic decoding of path syntax to raw instructions */
function parsePathSyntax(d) {
    const pathSeq = [];
    let cmd = 'M';
    let rel = false;
    let token = '';
    let isFloat = false;
    const vals = [];
    function finishToken() {
        if (!token.length)
            return;
        const num = parseFloat(token);
        if (typeof num === 'number' && !isNaN(num))
            vals.push(num);
        token = '';
        isFloat = false;
    }
    function finishCommand() {
        finishToken();
        const cmdLength = cmdLengths[cmd];
        if (cmdLength) {
            if (!vals.length)
                return;
            const cmdCount = Math.floor(vals.length / cmdLength);
            for (let i = 0; i < cmdCount; i++) {
                const firstValI = i * cmdLength;
                const lastValI = firstValI + cmdLength;
                pathSeq.push({ cmd, rel, vals: vals.slice(firstValI, lastValI) });
            }
        }
        else if (cmdLength === 0) {
            pathSeq.push({ cmd, rel, vals: [] });
        }
        vals.length = 0;
    }
    // TODO: after M with two vals, ther is an implicit L :/
    for (const c of d) {
        if (isLetter(c)) {
            finishCommand();
            const upperCmd = c.toUpperCase();
            if (!(upperCmd in cmdLengths))
                continue;
            cmd = upperCmd;
            rel = isLowercase(c);
        }
        else if (c === ',' || c === ' ') {
            finishToken();
        }
        else if (c === '.') {
            if (isFloat)
                finishToken();
            token += c;
            isFloat = true;
        }
        else if (c === '-') {
            finishToken();
            token += c;
        }
        else if (isDigit(c)) {
            token += c;
        }
    }
    finishCommand();
    return pathSeq;
}
function isLetter(c) {
    return c.toLowerCase() !== c.toUpperCase();
}
function isLowercase(c) {
    return c !== c.toUpperCase();
}
function isDigit(c) {
    return c === String(parseInt(c));
}
function keyPathInstruction({ cmd, rel, vals }) {
    switch (cmd) {
        case 'M':
            return mapArrayIndex(vals, ['x', 'y'], 0, { cmd, rel });
        case 'L':
            return mapArrayIndex(vals, ['x', 'y'], 0, { cmd, rel });
        case 'H':
            return mapArrayIndex(vals, ['x'], 0, { cmd, rel });
        case 'V':
            return mapArrayIndex(vals, ['y'], 0, { cmd, rel });
        case 'C':
            return mapArrayIndex(vals, ['x1', 'y1', 'x2', 'y2', 'x', 'y'], 0, { cmd, rel });
        case 'S':
            return mapArrayIndex(vals, ['x2', 'y2', 'x', 'y'], 0, { cmd, rel });
        case 'Q':
            return mapArrayIndex(vals, ['x1', 'y1', 'x', 'y'], 0, { cmd, rel });
        case 'T':
            return mapArrayIndex(vals, ['x', 'y'], 0, { cmd, rel });
        case 'A':
            return {
                cmd,
                rel,
                rx: vals[0] ?? 0,
                ry: vals[1] ?? 0,
                xAxisRotation: vals[2] ?? 0,
                largeArcFlag: vals[3] ? 1 : 0,
                sweepFlag: vals[4] ? 1 : 0,
                x: vals[5] ?? 0,
                y: vals[6] ?? 0,
            };
        case 'Z':
            return { cmd, rel: false };
    }
}
function mapArrayIndex(arr, keys, fallback, baseObj) {
    const obj = baseObj || {};
    // @ts-expect-error
    keys.forEach((key, i) => (obj[key] = arr[i] ?? fallback));
    return obj;
}
/** Transforms all commands to absolute, modifies original objects and returns same ref */
function toAbsolute(instructions) {
    let currX = 0;
    let currY = 0;
    function updateCurr(ins) {
        if ('x' in ins)
            currX = ins.x;
        if ('y' in ins)
            currY = ins.y;
    }
    instructions.forEach(ins => {
        if (!ins.rel)
            return updateCurr(ins);
        ins.rel = false;
        const keys = Object.keys(ins);
        // @ts-expect-error
        keys.filter(key => key.startsWith('x')).forEach(key => (ins[key] += currX));
        // @ts-expect-error
        keys.filter(key => key.startsWith('y')).forEach(key => (ins[key] += currY));
        updateCurr(ins);
    });
    return instructions;
}
//# sourceMappingURL=svg-path.js.map