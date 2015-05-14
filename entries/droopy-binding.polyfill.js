var polyfill = require("object.observe");
global.droopyBinding = {};
global.DroopyBinding = require("../src/droopyBinding");
exports.DroopyBinding = global.DroopyBinding;