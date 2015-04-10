(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);throw new Error("Cannot find module '"+o+"'")}var f=n[o]={exports:{}};t[o][0].call(f.exports,function(e){var n=t[o][1][e];return s(n?n:e)},f,f.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
(function (global){
global.droopyBinding = {};
global.droopyBinding.OnewayBinding = require("../src/onewayBinding");
exports.OnewayBinding = global.droopyBinding.OnewayBinding;
}).call(this,typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"../src/onewayBinding":5}],2:[function(require,module,exports){
var templating = {

	Placeholder: function(raw) {
		this.raw = raw;
		this.fullProperty = raw.slice(2, raw.length - 2);
	},

	getPlaceHolders: function(template, regexp) {
		var regExpPattern = regexp || /\{\{[^\}]+\}\}?/g;
		var matches = template.match(regExpPattern);
		return matches || [];
	},

	getObjectValue: function(obj, fullProperty) {
		var value = obj,
			propertyChain = fullProperty.split('.');

		for (var i = 0; i < propertyChain.length; i++) {
			var property = propertyChain[i];
			value = value[property] != null ? value[property] : "Not Found: " + fullProperty;
		}

		if(fullProperty === "_") {
			value = obj;
		}
		
		if ((typeof value === "string") && value.indexOf("/Date(") !== -1) {
			var dateValue = UTCJsonToDate(value);
			value = dateValue.toLocaleDateString();
		}

		return value;
	},

	populateTemplate: function(template, item, regexp) {
		var placeholders = this.getPlaceHolders(template, regexp) || [],
			itemHtml = template;

		for (var i = 0; i < placeholders.length; i++) {
			var placeholder = new this.Placeholder(placeholders[i]);
			placeholder.val = this.getObjectValue(item, placeholder.fullProperty);
			var pattern = placeholder.raw.replace("[", "\\[").replace("]", "\\]");
			var modifier = "g";
			itemHtml = itemHtml.replace(new RegExp(pattern, modifier), placeholder.val);
		}
		return itemHtml;
	}
};

templating.Each = {

	regExp: /\{\[[^\]]+\]\}?/g,

	populateEachTemplates: function(itemHtml, item) {
		var $itemHtml = $(itemHtml),
			eachTemplates = $itemHtml.find("[data-each]");

		eachTemplates.each(function() {
			var arrayHtml = "",
				itemTemplate = $(this).html(),
				arrayProp = $(this).data("each"),
				array = sp.templating.getObjectValue(item, arrayProp);

			if (array != null && $.isArray(array)) {
				for (var i = 0; i < array.length; i++) {
					arrayHtml += templating.populateTemplate(itemTemplate, array[i], templating.Each.regExp);
				}
			}

			$itemHtml.find($(this)).html(arrayHtml);
		});

		var temp = $itemHtml.clone().wrap("<div>");
		return temp.parent().html();
	}
};

templating.renderTemplate = function(template, item, renderEachTemplate) {
	var itemHtml = templating.populateTemplate(template, item);
	if (renderEachTemplate) {
		itemHtml = templating.Each.populateEachTemplates(itemHtml, item);
	}
	return itemHtml;
};

var UTCJsonToDate = function(jsonDate) {
	var utcStr = jsonDate.substring(jsonDate.indexOf("(") + 1);
	utcStr = utcStr.substring(0, utcStr.indexOf(")"));

	var returnDate = new Date(parseInt(utcStr, 10));
	var hourOffset = returnDate.getTimezoneOffset() / 60;
	returnDate.setHours(returnDate.getHours() + hourOffset);

	return returnDate;
};

module.exports = templating;
},{}],3:[function(require,module,exports){
var templating = require("droopy-templating");

var ArrayBinding = function(element, fullProperty) {
	this.element = element;
	this.original = element.innerHTML;
	this.fullProperty = fullProperty;
};

ArrayBinding.prototype.update = function(scope) {
	var self = this;
	var arrayHtml = "";
	var array = templating.getObjectValue(scope, self.fullProperty);

	if (array && Array.isArray(array)) {
		for (var i = 0; i < array.length; i++) {
			arrayHtml += templating.populateTemplate(self.original, array[i], templating.Each.regExp);
		}
	}
	self.element.innerHTML = arrayHtml;
};

module.exports = ArrayBinding;
},{"droopy-templating":2}],4:[function(require,module,exports){
var templating = require("droopy-templating");

var NodeBinding = function(node, placeholder) {
	this.node = node;
	this.original = node.nodeValue;
	this.raw = placeholder;
	this.fullProperty = this.raw.slice(2, this.raw.length - 2);
};

NodeBinding.prototype.update = function(model) {
	var self = this;
	var html = templating.renderTemplate(self.original, model);
	self.node.nodeValue = html;
};

module.exports = NodeBinding;
},{"droopy-templating":2}],5:[function(require,module,exports){
var templating = require("droopy-templating");
var NodeBinding = require("./nodeBinding");
var ArrayBinding = require("./arrayBinding");

var OnewayBinding = function(containerId, model, shouldInit) {
	this.model = model;
	this.container = document.getElementById(containerId);

	//Get all bindings
	this.bindings = this.getBindings(this.container);

	if (shouldInit !== false) {
		this.init();
	}
};

OnewayBinding.prototype.init = function() {
	var self = this;
	self.updateBindings();
	self.recursiveObserve(self.model, "", function(changes, propChain) {
		self.handleObjectChange(changes, propChain);
	});
};

OnewayBinding.prototype.recursiveObserve = function(obj, propChain, callback) {
	var self = this;
	// Make sure its an array or object
	if (!Array.isArray(obj) && typeof obj !== "object") return;

	if (Array.isArray(obj)) {
		if (Array.observe) {
			Array.observe(obj, function(changes) {
				self.handleArrayChange(changes, propChain);
			});			
		} else {
			Object.observe(obj, function(changes) {
				self.handleArrayChange(changes, propChain);
			});	
		}
		// Recursively observe any array items
		obj.forEach(function(arrayItem, i){
			self.recursiveObserve(arrayItem, "", function(changes) { 
				self.handleArrayChange.call(self, changes, propChain);
			});
		});

	} else {
		Object.observe(obj, function(changes) {
			callback(changes, propChain);
		});
		
		// Recursively observe any child objects
		Object.keys(obj).forEach(function(propName) {
			var newPropChain = propChain;
			if (newPropChain) {
				newPropChain += "." + propName;
			} else {
				newPropChain = propName;
			}
			self.recursiveObserve(obj[propName], newPropChain, callback);
		});
	}
	
};

OnewayBinding.prototype.handleArrayChange = function(changes, propChain) {
	var self = this;

	// Re-observe any new objects
	changes.forEach(function(change){
		//If its an array change, and an update, its a new index assignment so re-observe
		if (Array.isArray(change.object) && change.type === "update") {
			self.recursiveObserve(change.object[change.name], "", function(changes) { 
				self.handleArrayChange.call(self, changes, propChain);
			});
		} 
		// If its a push or a pop it will come through as splice
		else if (Array.isArray(change.object) && change.type === "splice") {
			// If its a push, addedCount will be 1
			if (change.addedCount > 0) {
				// start observing the new array item
				self.recursiveObserve(change.object[change.index], "", function(changes) { 
					self.handleArrayChange.call(self, changes, propChain);
				});
			}
			// If its a pop we really don't care here because there is nothing to re-observe
		}
	});
	// Rerender data-each bindings that are tied to the array
	self.bindings.forEach(function(binding) {
		if (binding.fullProperty === propChain) {
			binding.update(self.model);
		}
	});
};

OnewayBinding.prototype.handleObjectChange = function(changes, propChain) {
	var self = this;
	changes.forEach(function(change) {
		// Get the property chain string to tie back to UI placeholder
		var changedProp = change.name;
		if (propChain) {
			changedProp = propChain + "." + change.name;
		}

		// Check each binding to see if it cares, update if it does
		self.bindings.forEach(function(binding) {
			// starts with prop chain to allow whole child object to be updated
			if (binding.fullProperty.indexOf(changedProp) === 0) {
				binding.update(self.model);
			}
		});

		// If object gets overwritten, need to re-observe it
		if (change.type === "update") {
			self.recursiveObserve(change.object[change.name], changedProp, function(changes, propChain) {
				self.handleObjectChange(changes, propChain);
			});
		}
	});
};

OnewayBinding.prototype.updateBindings = function() {
	var self = this;
	self.bindings.forEach(function(binding) {
		binding.update(self.model);
	});
};

OnewayBinding.prototype.updateModel = function(newModel) {
	this.model = newModel;
	this.init();
};

OnewayBinding.prototype.getBindings = function(element) {
	var self = this;
	var bindings = [];
	var placeholders = [];
	var i = 0;
	// 1. Look for attribute bindings and array bindings on the current element
	if (element.attributes) {
		for (i = 0; i < element.attributes.length; i++) {
			if (element.attributes[i].nodeName === "data-each") {
				bindings.push(new ArrayBinding(element, element.attributes[i].nodeValue));
			} else {
				var attributeBindings = templating.getPlaceHolders(element.attributes[i].nodeValue)
					.map(function(placeholder) {
						return new NodeBinding(element.attributes[i], placeholder);
					});
				bindings = bindings.concat(attributeBindings);				
			}
		}
	}
	// 2.a If the element has children, it won't have a text binding. Recurse on children
	if (element.childNodes && element.childNodes.length) {
		//recursive call for each childnode
		for (i = 0; i < element.childNodes.length; i++) {
			bindings = bindings.concat(self.getBindings(element.childNodes[i]));
		}
	} else {
		// 2.b The element doesn't have children so look for a text binding
		placeholders = templating.getPlaceHolders(element.textContent);
		var textBindings = placeholders.map(function(placeholder) {
			return new NodeBinding(element, placeholder);
		});
		bindings = bindings.concat(textBindings);
	}
	return bindings;
};

module.exports = OnewayBinding;
},{"./arrayBinding":3,"./nodeBinding":4,"droopy-templating":2}]},{},[1])