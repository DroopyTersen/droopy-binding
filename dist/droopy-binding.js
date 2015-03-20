(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);throw new Error("Cannot find module '"+o+"'")}var f=n[o]={exports:{}};t[o][0].call(f.exports,function(e){var n=t[o][1][e];return s(n?n:e)},f,f.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
(function (global){
global.droopyBinding = {};
global.droopyBinding.OnewayBinding = require("../src/onewayBinding");
exports.OnewayBinding = global.droopyBinding.OnewayBinding;
}).call(this,typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"../src/onewayBinding":4}],2:[function(require,module,exports){
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
},{"droopy-templating":2}],4:[function(require,module,exports){
var templating = require("droopy-templating");
var NodeBinding = require("./nodeBinding");

var OnewayBinding = function(containerId, model) {
	this.model = model;
	this.container = document.getElementById(containerId);

	//Get all bindings
	this.bindings = this.getBindings(this.container);
};

OnewayBinding.prototype.init = function() {
	var self = this;
	self.updateBindings();
	deepObserve(self.model, function(changes, propChain) {
		self.handleModelChange(changes, propChain);
	});
};

function deepObserve(observable, onChange) {
	innerObserve(observable, "", onChange);

	function innerObserve(obj, propChain, callback) {
		// Make sure its an array or object
		if (!Array.isArray(obj) && typeof obj !== "object") return;

		// Observe the current level
		// TODO: add array support
		//var nativeObserve = Array.isArray(obj) ? Array.observe : Object.observe;
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
			innerObserve(obj[propName], newPropChain, callback);
		});
	}
}


OnewayBinding.prototype.handleModelChange = function(changes, propChain) {
	var self = this;
	changes.forEach(function(change) {
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
	// 1. Look for attribute bindings on the current element
	if (element.attributes) {
		for (i = 0; i < element.attributes.length; i++) {
			var attributeBindings = templating.getPlaceHolders(element.attributes[i].nodeValue)
				.map(function(placeholder) {
					return new NodeBinding(element.attributes[i], placeholder);
				});
			bindings = bindings.concat(attributeBindings);
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
},{"./nodeBinding":3,"droopy-templating":2}]},{},[1])