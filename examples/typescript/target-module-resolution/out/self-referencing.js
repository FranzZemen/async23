"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.selfReferencing = void 0;
const exported_1 = require("target-module-resolution/exported");
function selfReferencing() {
    (0, exported_1.helloWorld)();
    return 'Self referencing';
}
exports.selfReferencing = selfReferencing;
//# sourceMappingURL=self-referencing.js.map