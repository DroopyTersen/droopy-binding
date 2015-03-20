var polyfill = require("object.observe");
global.droopyBinding = {};
global.droopyBinding.OnewayBinding = require("../src/onewayBinding");
exports.OnewayBinding = global.droopyBinding.OnewayBinding;
