// Підміна "server-only" для запуску серверних модулів у скриптах
import Module from "node:module";
const orig = Module._resolveFilename;
Module._resolveFilename = function (req, ...rest) { if (req === "server-only") return new URL("./server-only.js", import.meta.url).pathname; return orig.call(this, req, ...rest); };
