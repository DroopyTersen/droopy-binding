(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);throw new Error("Cannot find module '"+o+"'")}var f=n[o]={exports:{}};t[o][0].call(f.exports,function(e){var n=t[o][1][e];return s(n?n:e)},f,f.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
(function (global){
global.droopyBinding = {};
global.DroopyBinding = require("../src/droopyBinding");
exports.DroopyBinding = global.DroopyBinding;
}).call(this,typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"../src/droopyBinding":5}],2:[function(require,module,exports){
var EventAggregator = function() {
	this.eventKeys = {};
	this.lastSubscriptionId = -1;
};

EventAggregator.prototype.on = function(key, callback) {
	if (typeof callback === "function") {
		if (!this.eventKeys[key]) {
			this.eventKeys[key] = {
				subscriptions: {}
			};
		}
		var token = (++this.lastSubscriptionId).toString();
		this.eventKeys[key].subscriptions[token] = callback;
		return token;
	} else {
		return false;
	}
};

EventAggregator.prototype.off = function(key, tokenOrCallback) {
	if (typeof tokenOrCallback === 'function') {
		//Callback reference was passed in so find the subscription with the matching function
		if (this.eventKeys[key]) {
			var eventSubscriptions = this.eventKeys[key].subscriptions;
			var matchingId = null;
			//foreach subscription see if the functions match and save the key if yes
			for (var subscriptionId in eventSubscriptions) {
				if (eventSubscriptions.hasOwnProperty(subscriptionId)) {
					if (eventSubscriptions[subscriptionId] === tokenOrCallback) {
						matchingId = subscriptionId;
					}
				}
			}
			if (matchingId !== null) {
				delete eventSubscriptions[matchingId];
			}
		}
	} else {
		//Token was passed in
		if (this.eventKeys[key] && this.eventKeys[key].subscriptions[tokenOrCallback]) {
			delete this.eventKeys[key].subscriptions[tokenOrCallback];
		}
	}
};

EventAggregator.prototype.trigger = function(key) {
	var self = this;
	if (self.eventKeys[key]) {
		var values = Array.prototype.slice.call(arguments, 1);
		//If passing less than values pass them individually
		var a1 = values[0],
			a2 = values[1],
			a3 = values[2];
		//Else if passing more than 3 values group as an args array
		if (values.length > 3) {
			a1 = values;
		}

		var subscriptions = self.eventKeys[key].subscriptions;
		setTimeout(function() {
			for (var token in subscriptions) {
				if (subscriptions.hasOwnProperty(token)) {
					subscriptions[token](a1, a2, a3);
				}
			}
		}, 0);
	}
};

module.exports = EventAggregator;
},{}],3:[function(require,module,exports){
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
},{}],4:[function(require,module,exports){
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
},{"droopy-templating":3}],5:[function(require,module,exports){
var templating = require("droopy-templating");
var NodeBinding = require("./nodeBinding");
var ArrayBinding = require("./arrayBinding");

var DroopyBinding = function(containerId, model, shouldInit) {
	this.model = model;
	this.container = document.getElementById(containerId);

	//Get all bindings
	this.bindings = this.getBindings(this.container);

	if (shouldInit !== false) {
		this.init();
	}
};

DroopyBinding.prototype.init = function() {
	var self = this;
	self.updateBindings();
	self.recursiveObserve(self.model, "", function(changes, propChain) {
		self.handleObjectChange(changes, propChain);
	});
};

DroopyBinding.prototype.recursiveObserve = function(obj, propChain, callback) {
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

DroopyBinding.prototype.handleArrayChange = function(changes, propChain) {
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

DroopyBinding.prototype.handleObjectChange = function(changes, propChain) {
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

DroopyBinding.prototype.updateBindings = function() {
	var self = this;
	self.bindings.forEach(function(binding) {
		binding.update(self.model);
	});
};

DroopyBinding.prototype.updateModelProperty = function(fullProperty, newValue) {
	//start with the model
	var propertyChain = fullProperty.split('.');
	var parentObj = this.model;
	var property = fullProperty;
	//traverse the property chain, except for last one
	for (var i = 0; i < propertyChain.length - 1; i++) {
		if (parentObj[propertyChain[i]] != null) {
			property = propertyChain[i];
			parentObj = parentObj[property];
		} 
	}
	//if its an underscore, its referencing the model scope
	if(fullProperty === "_") {
		parentObj = newValue;
	} else {
		property = propertyChain[propertyChain.length - 1];
		parentObj[property] = newValue;
	}
};

DroopyBinding.prototype.updateModel = function(newModel) {
	this.model = newModel;
	this.init();
};

DroopyBinding.prototype.getBindings = function(element) {
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
						var binding = new NodeBinding(element.attributes[i], placeholder, element);
						binding.on("input-change", self.updateModelProperty.bind(self));
						return binding;
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

module.exports = DroopyBinding;
},{"./arrayBinding":4,"./nodeBinding":6,"droopy-templating":3}],6:[function(require,module,exports){
var templating = require("droopy-templating");
var Eventable = require("droopy-events");

var NodeBinding = function(node, placeholder, element) {
	Eventable.call(this);
	this.node = node;
	this.original = node.nodeValue;
	this.raw = placeholder;
	this.fullProperty = this.raw.slice(2, this.raw.length - 2);
	//if no element was passed in, it is a text binding, otherwise attribute
	this.element = element || node; 
	this.setupTwoWay();
};

NodeBinding.prototype = new Eventable();

NodeBinding.prototype.setupTwoWay = function() {
	if (this.node.nodeName === "value" && this.element) {
		if (this.element.tagName.toLowerCase() === "input") {
			this.element.addEventListener("input", this.onInputChange.bind(this));
		}
		if (this.element.tagName.toLowerCase() === "select") {
			this.element.addEventListener("change", this.onInputChange.bind(this));
		}
	}
};

NodeBinding.prototype.onInputChange = function() {
	//called with bind, so 'this' is actually this
	this.trigger("input-change", this.fullProperty, this.element.value );
};

NodeBinding.prototype.update = function(model) {
	var self = this;
	var html = templating.renderTemplate(self.original, model);
	self.node.nodeValue = html;
	if (self.node.nodeName === "value" && self.element) {
		self.element.value = html;
	}
};

module.exports = NodeBinding;
},{"droopy-events":2,"droopy-templating":3}]},{},[1])
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIkM6XFxnaXR3aXBcXGRyb29weS1iaW5kaW5nXFxub2RlX21vZHVsZXNcXGd1bHAtYnJvd3NlcmlmeVxcbm9kZV9tb2R1bGVzXFxicm93c2VyaWZ5XFxub2RlX21vZHVsZXNcXGJyb3dzZXItcGFja1xcX3ByZWx1ZGUuanMiLCJDOi9naXR3aXAvZHJvb3B5LWJpbmRpbmcvZW50cmllcy9mYWtlX2VmNDRjMGFjLmpzIiwiQzovZ2l0d2lwL2Ryb29weS1iaW5kaW5nL25vZGVfbW9kdWxlcy9kcm9vcHktZXZlbnRzL0V2ZW50QWdncmVnYXRvci5qcyIsIkM6L2dpdHdpcC9kcm9vcHktYmluZGluZy9ub2RlX21vZHVsZXMvZHJvb3B5LXRlbXBsYXRpbmcvZHJvb3B5LXRlbXBsYXRpbmcuanMiLCJDOi9naXR3aXAvZHJvb3B5LWJpbmRpbmcvc3JjL2FycmF5QmluZGluZy5qcyIsIkM6L2dpdHdpcC9kcm9vcHktYmluZGluZy9zcmMvZHJvb3B5QmluZGluZy5qcyIsIkM6L2dpdHdpcC9kcm9vcHktYmluZGluZy9zcmMvbm9kZUJpbmRpbmcuanMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7QUNBQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ0pBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDdEVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2hHQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNyQkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNqTUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBIiwiZmlsZSI6ImdlbmVyYXRlZC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzQ29udGVudCI6WyIoZnVuY3Rpb24gZSh0LG4scil7ZnVuY3Rpb24gcyhvLHUpe2lmKCFuW29dKXtpZighdFtvXSl7dmFyIGE9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtpZighdSYmYSlyZXR1cm4gYShvLCEwKTtpZihpKXJldHVybiBpKG8sITApO3Rocm93IG5ldyBFcnJvcihcIkNhbm5vdCBmaW5kIG1vZHVsZSAnXCIrbytcIidcIil9dmFyIGY9bltvXT17ZXhwb3J0czp7fX07dFtvXVswXS5jYWxsKGYuZXhwb3J0cyxmdW5jdGlvbihlKXt2YXIgbj10W29dWzFdW2VdO3JldHVybiBzKG4/bjplKX0sZixmLmV4cG9ydHMsZSx0LG4scil9cmV0dXJuIG5bb10uZXhwb3J0c312YXIgaT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2Zvcih2YXIgbz0wO288ci5sZW5ndGg7bysrKXMocltvXSk7cmV0dXJuIHN9KSIsIihmdW5jdGlvbiAoZ2xvYmFsKXtcbmdsb2JhbC5kcm9vcHlCaW5kaW5nID0ge307XHJcbmdsb2JhbC5Ecm9vcHlCaW5kaW5nID0gcmVxdWlyZShcIi4uL3NyYy9kcm9vcHlCaW5kaW5nXCIpO1xyXG5leHBvcnRzLkRyb29weUJpbmRpbmcgPSBnbG9iYWwuRHJvb3B5QmluZGluZztcbn0pLmNhbGwodGhpcyx0eXBlb2Ygc2VsZiAhPT0gXCJ1bmRlZmluZWRcIiA/IHNlbGYgOiB0eXBlb2Ygd2luZG93ICE9PSBcInVuZGVmaW5lZFwiID8gd2luZG93IDoge30pIiwidmFyIEV2ZW50QWdncmVnYXRvciA9IGZ1bmN0aW9uKCkge1xyXG5cdHRoaXMuZXZlbnRLZXlzID0ge307XHJcblx0dGhpcy5sYXN0U3Vic2NyaXB0aW9uSWQgPSAtMTtcclxufTtcclxuXHJcbkV2ZW50QWdncmVnYXRvci5wcm90b3R5cGUub24gPSBmdW5jdGlvbihrZXksIGNhbGxiYWNrKSB7XHJcblx0aWYgKHR5cGVvZiBjYWxsYmFjayA9PT0gXCJmdW5jdGlvblwiKSB7XHJcblx0XHRpZiAoIXRoaXMuZXZlbnRLZXlzW2tleV0pIHtcclxuXHRcdFx0dGhpcy5ldmVudEtleXNba2V5XSA9IHtcclxuXHRcdFx0XHRzdWJzY3JpcHRpb25zOiB7fVxyXG5cdFx0XHR9O1xyXG5cdFx0fVxyXG5cdFx0dmFyIHRva2VuID0gKCsrdGhpcy5sYXN0U3Vic2NyaXB0aW9uSWQpLnRvU3RyaW5nKCk7XHJcblx0XHR0aGlzLmV2ZW50S2V5c1trZXldLnN1YnNjcmlwdGlvbnNbdG9rZW5dID0gY2FsbGJhY2s7XHJcblx0XHRyZXR1cm4gdG9rZW47XHJcblx0fSBlbHNlIHtcclxuXHRcdHJldHVybiBmYWxzZTtcclxuXHR9XHJcbn07XHJcblxyXG5FdmVudEFnZ3JlZ2F0b3IucHJvdG90eXBlLm9mZiA9IGZ1bmN0aW9uKGtleSwgdG9rZW5PckNhbGxiYWNrKSB7XHJcblx0aWYgKHR5cGVvZiB0b2tlbk9yQ2FsbGJhY2sgPT09ICdmdW5jdGlvbicpIHtcclxuXHRcdC8vQ2FsbGJhY2sgcmVmZXJlbmNlIHdhcyBwYXNzZWQgaW4gc28gZmluZCB0aGUgc3Vic2NyaXB0aW9uIHdpdGggdGhlIG1hdGNoaW5nIGZ1bmN0aW9uXHJcblx0XHRpZiAodGhpcy5ldmVudEtleXNba2V5XSkge1xyXG5cdFx0XHR2YXIgZXZlbnRTdWJzY3JpcHRpb25zID0gdGhpcy5ldmVudEtleXNba2V5XS5zdWJzY3JpcHRpb25zO1xyXG5cdFx0XHR2YXIgbWF0Y2hpbmdJZCA9IG51bGw7XHJcblx0XHRcdC8vZm9yZWFjaCBzdWJzY3JpcHRpb24gc2VlIGlmIHRoZSBmdW5jdGlvbnMgbWF0Y2ggYW5kIHNhdmUgdGhlIGtleSBpZiB5ZXNcclxuXHRcdFx0Zm9yICh2YXIgc3Vic2NyaXB0aW9uSWQgaW4gZXZlbnRTdWJzY3JpcHRpb25zKSB7XHJcblx0XHRcdFx0aWYgKGV2ZW50U3Vic2NyaXB0aW9ucy5oYXNPd25Qcm9wZXJ0eShzdWJzY3JpcHRpb25JZCkpIHtcclxuXHRcdFx0XHRcdGlmIChldmVudFN1YnNjcmlwdGlvbnNbc3Vic2NyaXB0aW9uSWRdID09PSB0b2tlbk9yQ2FsbGJhY2spIHtcclxuXHRcdFx0XHRcdFx0bWF0Y2hpbmdJZCA9IHN1YnNjcmlwdGlvbklkO1xyXG5cdFx0XHRcdFx0fVxyXG5cdFx0XHRcdH1cclxuXHRcdFx0fVxyXG5cdFx0XHRpZiAobWF0Y2hpbmdJZCAhPT0gbnVsbCkge1xyXG5cdFx0XHRcdGRlbGV0ZSBldmVudFN1YnNjcmlwdGlvbnNbbWF0Y2hpbmdJZF07XHJcblx0XHRcdH1cclxuXHRcdH1cclxuXHR9IGVsc2Uge1xyXG5cdFx0Ly9Ub2tlbiB3YXMgcGFzc2VkIGluXHJcblx0XHRpZiAodGhpcy5ldmVudEtleXNba2V5XSAmJiB0aGlzLmV2ZW50S2V5c1trZXldLnN1YnNjcmlwdGlvbnNbdG9rZW5PckNhbGxiYWNrXSkge1xyXG5cdFx0XHRkZWxldGUgdGhpcy5ldmVudEtleXNba2V5XS5zdWJzY3JpcHRpb25zW3Rva2VuT3JDYWxsYmFja107XHJcblx0XHR9XHJcblx0fVxyXG59O1xyXG5cclxuRXZlbnRBZ2dyZWdhdG9yLnByb3RvdHlwZS50cmlnZ2VyID0gZnVuY3Rpb24oa2V5KSB7XHJcblx0dmFyIHNlbGYgPSB0aGlzO1xyXG5cdGlmIChzZWxmLmV2ZW50S2V5c1trZXldKSB7XHJcblx0XHR2YXIgdmFsdWVzID0gQXJyYXkucHJvdG90eXBlLnNsaWNlLmNhbGwoYXJndW1lbnRzLCAxKTtcclxuXHRcdC8vSWYgcGFzc2luZyBsZXNzIHRoYW4gdmFsdWVzIHBhc3MgdGhlbSBpbmRpdmlkdWFsbHlcclxuXHRcdHZhciBhMSA9IHZhbHVlc1swXSxcclxuXHRcdFx0YTIgPSB2YWx1ZXNbMV0sXHJcblx0XHRcdGEzID0gdmFsdWVzWzJdO1xyXG5cdFx0Ly9FbHNlIGlmIHBhc3NpbmcgbW9yZSB0aGFuIDMgdmFsdWVzIGdyb3VwIGFzIGFuIGFyZ3MgYXJyYXlcclxuXHRcdGlmICh2YWx1ZXMubGVuZ3RoID4gMykge1xyXG5cdFx0XHRhMSA9IHZhbHVlcztcclxuXHRcdH1cclxuXHJcblx0XHR2YXIgc3Vic2NyaXB0aW9ucyA9IHNlbGYuZXZlbnRLZXlzW2tleV0uc3Vic2NyaXB0aW9ucztcclxuXHRcdHNldFRpbWVvdXQoZnVuY3Rpb24oKSB7XHJcblx0XHRcdGZvciAodmFyIHRva2VuIGluIHN1YnNjcmlwdGlvbnMpIHtcclxuXHRcdFx0XHRpZiAoc3Vic2NyaXB0aW9ucy5oYXNPd25Qcm9wZXJ0eSh0b2tlbikpIHtcclxuXHRcdFx0XHRcdHN1YnNjcmlwdGlvbnNbdG9rZW5dKGExLCBhMiwgYTMpO1xyXG5cdFx0XHRcdH1cclxuXHRcdFx0fVxyXG5cdFx0fSwgMCk7XHJcblx0fVxyXG59O1xyXG5cclxubW9kdWxlLmV4cG9ydHMgPSBFdmVudEFnZ3JlZ2F0b3I7IiwidmFyIHRlbXBsYXRpbmcgPSB7XHJcblxyXG5cdFBsYWNlaG9sZGVyOiBmdW5jdGlvbihyYXcpIHtcclxuXHRcdHRoaXMucmF3ID0gcmF3O1xyXG5cdFx0dGhpcy5mdWxsUHJvcGVydHkgPSByYXcuc2xpY2UoMiwgcmF3Lmxlbmd0aCAtIDIpO1xyXG5cdH0sXHJcblxyXG5cdGdldFBsYWNlSG9sZGVyczogZnVuY3Rpb24odGVtcGxhdGUsIHJlZ2V4cCkge1xyXG5cdFx0dmFyIHJlZ0V4cFBhdHRlcm4gPSByZWdleHAgfHwgL1xce1xce1teXFx9XStcXH1cXH0/L2c7XHJcblx0XHR2YXIgbWF0Y2hlcyA9IHRlbXBsYXRlLm1hdGNoKHJlZ0V4cFBhdHRlcm4pO1xyXG5cdFx0cmV0dXJuIG1hdGNoZXMgfHwgW107XHJcblx0fSxcclxuXHJcblx0Z2V0T2JqZWN0VmFsdWU6IGZ1bmN0aW9uKG9iaiwgZnVsbFByb3BlcnR5KSB7XHJcblx0XHR2YXIgdmFsdWUgPSBvYmosXHJcblx0XHRcdHByb3BlcnR5Q2hhaW4gPSBmdWxsUHJvcGVydHkuc3BsaXQoJy4nKTtcclxuXHJcblx0XHRmb3IgKHZhciBpID0gMDsgaSA8IHByb3BlcnR5Q2hhaW4ubGVuZ3RoOyBpKyspIHtcclxuXHRcdFx0dmFyIHByb3BlcnR5ID0gcHJvcGVydHlDaGFpbltpXTtcclxuXHRcdFx0dmFsdWUgPSB2YWx1ZVtwcm9wZXJ0eV0gIT0gbnVsbCA/IHZhbHVlW3Byb3BlcnR5XSA6IFwiTm90IEZvdW5kOiBcIiArIGZ1bGxQcm9wZXJ0eTtcclxuXHRcdH1cclxuXHJcblx0XHRpZihmdWxsUHJvcGVydHkgPT09IFwiX1wiKSB7XHJcblx0XHRcdHZhbHVlID0gb2JqO1xyXG5cdFx0fVxyXG5cdFx0XHJcblx0XHRpZiAoKHR5cGVvZiB2YWx1ZSA9PT0gXCJzdHJpbmdcIikgJiYgdmFsdWUuaW5kZXhPZihcIi9EYXRlKFwiKSAhPT0gLTEpIHtcclxuXHRcdFx0dmFyIGRhdGVWYWx1ZSA9IFVUQ0pzb25Ub0RhdGUodmFsdWUpO1xyXG5cdFx0XHR2YWx1ZSA9IGRhdGVWYWx1ZS50b0xvY2FsZURhdGVTdHJpbmcoKTtcclxuXHRcdH1cclxuXHJcblx0XHRyZXR1cm4gdmFsdWU7XHJcblx0fSxcclxuXHJcblx0cG9wdWxhdGVUZW1wbGF0ZTogZnVuY3Rpb24odGVtcGxhdGUsIGl0ZW0sIHJlZ2V4cCkge1xyXG5cdFx0dmFyIHBsYWNlaG9sZGVycyA9IHRoaXMuZ2V0UGxhY2VIb2xkZXJzKHRlbXBsYXRlLCByZWdleHApIHx8IFtdLFxyXG5cdFx0XHRpdGVtSHRtbCA9IHRlbXBsYXRlO1xyXG5cclxuXHRcdGZvciAodmFyIGkgPSAwOyBpIDwgcGxhY2Vob2xkZXJzLmxlbmd0aDsgaSsrKSB7XHJcblx0XHRcdHZhciBwbGFjZWhvbGRlciA9IG5ldyB0aGlzLlBsYWNlaG9sZGVyKHBsYWNlaG9sZGVyc1tpXSk7XHJcblx0XHRcdHBsYWNlaG9sZGVyLnZhbCA9IHRoaXMuZ2V0T2JqZWN0VmFsdWUoaXRlbSwgcGxhY2Vob2xkZXIuZnVsbFByb3BlcnR5KTtcclxuXHRcdFx0dmFyIHBhdHRlcm4gPSBwbGFjZWhvbGRlci5yYXcucmVwbGFjZShcIltcIiwgXCJcXFxcW1wiKS5yZXBsYWNlKFwiXVwiLCBcIlxcXFxdXCIpO1xyXG5cdFx0XHR2YXIgbW9kaWZpZXIgPSBcImdcIjtcclxuXHRcdFx0aXRlbUh0bWwgPSBpdGVtSHRtbC5yZXBsYWNlKG5ldyBSZWdFeHAocGF0dGVybiwgbW9kaWZpZXIpLCBwbGFjZWhvbGRlci52YWwpO1xyXG5cdFx0fVxyXG5cdFx0cmV0dXJuIGl0ZW1IdG1sO1xyXG5cdH1cclxufTtcclxuXHJcbnRlbXBsYXRpbmcuRWFjaCA9IHtcclxuXHJcblx0cmVnRXhwOiAvXFx7XFxbW15cXF1dK1xcXVxcfT8vZyxcclxuXHJcblx0cG9wdWxhdGVFYWNoVGVtcGxhdGVzOiBmdW5jdGlvbihpdGVtSHRtbCwgaXRlbSkge1xyXG5cdFx0dmFyICRpdGVtSHRtbCA9ICQoaXRlbUh0bWwpLFxyXG5cdFx0XHRlYWNoVGVtcGxhdGVzID0gJGl0ZW1IdG1sLmZpbmQoXCJbZGF0YS1lYWNoXVwiKTtcclxuXHJcblx0XHRlYWNoVGVtcGxhdGVzLmVhY2goZnVuY3Rpb24oKSB7XHJcblx0XHRcdHZhciBhcnJheUh0bWwgPSBcIlwiLFxyXG5cdFx0XHRcdGl0ZW1UZW1wbGF0ZSA9ICQodGhpcykuaHRtbCgpLFxyXG5cdFx0XHRcdGFycmF5UHJvcCA9ICQodGhpcykuZGF0YShcImVhY2hcIiksXHJcblx0XHRcdFx0YXJyYXkgPSBzcC50ZW1wbGF0aW5nLmdldE9iamVjdFZhbHVlKGl0ZW0sIGFycmF5UHJvcCk7XHJcblxyXG5cdFx0XHRpZiAoYXJyYXkgIT0gbnVsbCAmJiAkLmlzQXJyYXkoYXJyYXkpKSB7XHJcblx0XHRcdFx0Zm9yICh2YXIgaSA9IDA7IGkgPCBhcnJheS5sZW5ndGg7IGkrKykge1xyXG5cdFx0XHRcdFx0YXJyYXlIdG1sICs9IHRlbXBsYXRpbmcucG9wdWxhdGVUZW1wbGF0ZShpdGVtVGVtcGxhdGUsIGFycmF5W2ldLCB0ZW1wbGF0aW5nLkVhY2gucmVnRXhwKTtcclxuXHRcdFx0XHR9XHJcblx0XHRcdH1cclxuXHJcblx0XHRcdCRpdGVtSHRtbC5maW5kKCQodGhpcykpLmh0bWwoYXJyYXlIdG1sKTtcclxuXHRcdH0pO1xyXG5cclxuXHRcdHZhciB0ZW1wID0gJGl0ZW1IdG1sLmNsb25lKCkud3JhcChcIjxkaXY+XCIpO1xyXG5cdFx0cmV0dXJuIHRlbXAucGFyZW50KCkuaHRtbCgpO1xyXG5cdH1cclxufTtcclxuXHJcbnRlbXBsYXRpbmcucmVuZGVyVGVtcGxhdGUgPSBmdW5jdGlvbih0ZW1wbGF0ZSwgaXRlbSwgcmVuZGVyRWFjaFRlbXBsYXRlKSB7XHJcblx0dmFyIGl0ZW1IdG1sID0gdGVtcGxhdGluZy5wb3B1bGF0ZVRlbXBsYXRlKHRlbXBsYXRlLCBpdGVtKTtcclxuXHRpZiAocmVuZGVyRWFjaFRlbXBsYXRlKSB7XHJcblx0XHRpdGVtSHRtbCA9IHRlbXBsYXRpbmcuRWFjaC5wb3B1bGF0ZUVhY2hUZW1wbGF0ZXMoaXRlbUh0bWwsIGl0ZW0pO1xyXG5cdH1cclxuXHRyZXR1cm4gaXRlbUh0bWw7XHJcbn07XHJcblxyXG52YXIgVVRDSnNvblRvRGF0ZSA9IGZ1bmN0aW9uKGpzb25EYXRlKSB7XHJcblx0dmFyIHV0Y1N0ciA9IGpzb25EYXRlLnN1YnN0cmluZyhqc29uRGF0ZS5pbmRleE9mKFwiKFwiKSArIDEpO1xyXG5cdHV0Y1N0ciA9IHV0Y1N0ci5zdWJzdHJpbmcoMCwgdXRjU3RyLmluZGV4T2YoXCIpXCIpKTtcclxuXHJcblx0dmFyIHJldHVybkRhdGUgPSBuZXcgRGF0ZShwYXJzZUludCh1dGNTdHIsIDEwKSk7XHJcblx0dmFyIGhvdXJPZmZzZXQgPSByZXR1cm5EYXRlLmdldFRpbWV6b25lT2Zmc2V0KCkgLyA2MDtcclxuXHRyZXR1cm5EYXRlLnNldEhvdXJzKHJldHVybkRhdGUuZ2V0SG91cnMoKSArIGhvdXJPZmZzZXQpO1xyXG5cclxuXHRyZXR1cm4gcmV0dXJuRGF0ZTtcclxufTtcclxuXHJcbm1vZHVsZS5leHBvcnRzID0gdGVtcGxhdGluZzsiLCJ2YXIgdGVtcGxhdGluZyA9IHJlcXVpcmUoXCJkcm9vcHktdGVtcGxhdGluZ1wiKTtcclxuXHJcbnZhciBBcnJheUJpbmRpbmcgPSBmdW5jdGlvbihlbGVtZW50LCBmdWxsUHJvcGVydHkpIHtcclxuXHR0aGlzLmVsZW1lbnQgPSBlbGVtZW50O1xyXG5cdHRoaXMub3JpZ2luYWwgPSBlbGVtZW50LmlubmVySFRNTDtcclxuXHR0aGlzLmZ1bGxQcm9wZXJ0eSA9IGZ1bGxQcm9wZXJ0eTtcclxufTtcclxuXHJcbkFycmF5QmluZGluZy5wcm90b3R5cGUudXBkYXRlID0gZnVuY3Rpb24oc2NvcGUpIHtcclxuXHR2YXIgc2VsZiA9IHRoaXM7XHJcblx0dmFyIGFycmF5SHRtbCA9IFwiXCI7XHJcblx0dmFyIGFycmF5ID0gdGVtcGxhdGluZy5nZXRPYmplY3RWYWx1ZShzY29wZSwgc2VsZi5mdWxsUHJvcGVydHkpO1xyXG5cclxuXHRpZiAoYXJyYXkgJiYgQXJyYXkuaXNBcnJheShhcnJheSkpIHtcclxuXHRcdGZvciAodmFyIGkgPSAwOyBpIDwgYXJyYXkubGVuZ3RoOyBpKyspIHtcclxuXHRcdFx0YXJyYXlIdG1sICs9IHRlbXBsYXRpbmcucG9wdWxhdGVUZW1wbGF0ZShzZWxmLm9yaWdpbmFsLCBhcnJheVtpXSwgdGVtcGxhdGluZy5FYWNoLnJlZ0V4cCk7XHJcblx0XHR9XHJcblx0fVxyXG5cdHNlbGYuZWxlbWVudC5pbm5lckhUTUwgPSBhcnJheUh0bWw7XHJcbn07XHJcblxyXG5tb2R1bGUuZXhwb3J0cyA9IEFycmF5QmluZGluZzsiLCJ2YXIgdGVtcGxhdGluZyA9IHJlcXVpcmUoXCJkcm9vcHktdGVtcGxhdGluZ1wiKTtcclxudmFyIE5vZGVCaW5kaW5nID0gcmVxdWlyZShcIi4vbm9kZUJpbmRpbmdcIik7XHJcbnZhciBBcnJheUJpbmRpbmcgPSByZXF1aXJlKFwiLi9hcnJheUJpbmRpbmdcIik7XHJcblxyXG52YXIgRHJvb3B5QmluZGluZyA9IGZ1bmN0aW9uKGNvbnRhaW5lcklkLCBtb2RlbCwgc2hvdWxkSW5pdCkge1xyXG5cdHRoaXMubW9kZWwgPSBtb2RlbDtcclxuXHR0aGlzLmNvbnRhaW5lciA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKGNvbnRhaW5lcklkKTtcclxuXHJcblx0Ly9HZXQgYWxsIGJpbmRpbmdzXHJcblx0dGhpcy5iaW5kaW5ncyA9IHRoaXMuZ2V0QmluZGluZ3ModGhpcy5jb250YWluZXIpO1xyXG5cclxuXHRpZiAoc2hvdWxkSW5pdCAhPT0gZmFsc2UpIHtcclxuXHRcdHRoaXMuaW5pdCgpO1xyXG5cdH1cclxufTtcclxuXHJcbkRyb29weUJpbmRpbmcucHJvdG90eXBlLmluaXQgPSBmdW5jdGlvbigpIHtcclxuXHR2YXIgc2VsZiA9IHRoaXM7XHJcblx0c2VsZi51cGRhdGVCaW5kaW5ncygpO1xyXG5cdHNlbGYucmVjdXJzaXZlT2JzZXJ2ZShzZWxmLm1vZGVsLCBcIlwiLCBmdW5jdGlvbihjaGFuZ2VzLCBwcm9wQ2hhaW4pIHtcclxuXHRcdHNlbGYuaGFuZGxlT2JqZWN0Q2hhbmdlKGNoYW5nZXMsIHByb3BDaGFpbik7XHJcblx0fSk7XHJcbn07XHJcblxyXG5Ecm9vcHlCaW5kaW5nLnByb3RvdHlwZS5yZWN1cnNpdmVPYnNlcnZlID0gZnVuY3Rpb24ob2JqLCBwcm9wQ2hhaW4sIGNhbGxiYWNrKSB7XHJcblx0dmFyIHNlbGYgPSB0aGlzO1xyXG5cdC8vIE1ha2Ugc3VyZSBpdHMgYW4gYXJyYXkgb3Igb2JqZWN0XHJcblx0aWYgKCFBcnJheS5pc0FycmF5KG9iaikgJiYgdHlwZW9mIG9iaiAhPT0gXCJvYmplY3RcIikgcmV0dXJuO1xyXG5cclxuXHRpZiAoQXJyYXkuaXNBcnJheShvYmopKSB7XHJcblx0XHRpZiAoQXJyYXkub2JzZXJ2ZSkge1xyXG5cdFx0XHRBcnJheS5vYnNlcnZlKG9iaiwgZnVuY3Rpb24oY2hhbmdlcykge1xyXG5cdFx0XHRcdHNlbGYuaGFuZGxlQXJyYXlDaGFuZ2UoY2hhbmdlcywgcHJvcENoYWluKTtcclxuXHRcdFx0fSk7XHRcdFx0XHJcblx0XHR9IGVsc2Uge1xyXG5cdFx0XHRPYmplY3Qub2JzZXJ2ZShvYmosIGZ1bmN0aW9uKGNoYW5nZXMpIHtcclxuXHRcdFx0XHRzZWxmLmhhbmRsZUFycmF5Q2hhbmdlKGNoYW5nZXMsIHByb3BDaGFpbik7XHJcblx0XHRcdH0pO1x0XHJcblx0XHR9XHJcblx0XHQvLyBSZWN1cnNpdmVseSBvYnNlcnZlIGFueSBhcnJheSBpdGVtc1xyXG5cdFx0b2JqLmZvckVhY2goZnVuY3Rpb24oYXJyYXlJdGVtLCBpKXtcclxuXHRcdFx0c2VsZi5yZWN1cnNpdmVPYnNlcnZlKGFycmF5SXRlbSwgXCJcIiwgZnVuY3Rpb24oY2hhbmdlcykgeyBcclxuXHRcdFx0XHRzZWxmLmhhbmRsZUFycmF5Q2hhbmdlLmNhbGwoc2VsZiwgY2hhbmdlcywgcHJvcENoYWluKTtcclxuXHRcdFx0fSk7XHJcblx0XHR9KTtcclxuXHJcblx0fSBlbHNlIHtcclxuXHRcdE9iamVjdC5vYnNlcnZlKG9iaiwgZnVuY3Rpb24oY2hhbmdlcykge1xyXG5cdFx0XHRjYWxsYmFjayhjaGFuZ2VzLCBwcm9wQ2hhaW4pO1xyXG5cdFx0fSk7XHJcblx0XHRcclxuXHRcdC8vIFJlY3Vyc2l2ZWx5IG9ic2VydmUgYW55IGNoaWxkIG9iamVjdHNcclxuXHRcdE9iamVjdC5rZXlzKG9iaikuZm9yRWFjaChmdW5jdGlvbihwcm9wTmFtZSkge1xyXG5cdFx0XHR2YXIgbmV3UHJvcENoYWluID0gcHJvcENoYWluO1xyXG5cdFx0XHRpZiAobmV3UHJvcENoYWluKSB7XHJcblx0XHRcdFx0bmV3UHJvcENoYWluICs9IFwiLlwiICsgcHJvcE5hbWU7XHJcblx0XHRcdH0gZWxzZSB7XHJcblx0XHRcdFx0bmV3UHJvcENoYWluID0gcHJvcE5hbWU7XHJcblx0XHRcdH1cclxuXHRcdFx0c2VsZi5yZWN1cnNpdmVPYnNlcnZlKG9ialtwcm9wTmFtZV0sIG5ld1Byb3BDaGFpbiwgY2FsbGJhY2spO1xyXG5cdFx0fSk7XHJcblx0fVxyXG5cdFxyXG59O1xyXG5cclxuRHJvb3B5QmluZGluZy5wcm90b3R5cGUuaGFuZGxlQXJyYXlDaGFuZ2UgPSBmdW5jdGlvbihjaGFuZ2VzLCBwcm9wQ2hhaW4pIHtcclxuXHR2YXIgc2VsZiA9IHRoaXM7XHJcblxyXG5cdC8vIFJlLW9ic2VydmUgYW55IG5ldyBvYmplY3RzXHJcblx0Y2hhbmdlcy5mb3JFYWNoKGZ1bmN0aW9uKGNoYW5nZSl7XHJcblx0XHQvL0lmIGl0cyBhbiBhcnJheSBjaGFuZ2UsIGFuZCBhbiB1cGRhdGUsIGl0cyBhIG5ldyBpbmRleCBhc3NpZ25tZW50IHNvIHJlLW9ic2VydmVcclxuXHRcdGlmIChBcnJheS5pc0FycmF5KGNoYW5nZS5vYmplY3QpICYmIGNoYW5nZS50eXBlID09PSBcInVwZGF0ZVwiKSB7XHJcblx0XHRcdHNlbGYucmVjdXJzaXZlT2JzZXJ2ZShjaGFuZ2Uub2JqZWN0W2NoYW5nZS5uYW1lXSwgXCJcIiwgZnVuY3Rpb24oY2hhbmdlcykgeyBcclxuXHRcdFx0XHRzZWxmLmhhbmRsZUFycmF5Q2hhbmdlLmNhbGwoc2VsZiwgY2hhbmdlcywgcHJvcENoYWluKTtcclxuXHRcdFx0fSk7XHJcblx0XHR9IFxyXG5cdFx0Ly8gSWYgaXRzIGEgcHVzaCBvciBhIHBvcCBpdCB3aWxsIGNvbWUgdGhyb3VnaCBhcyBzcGxpY2VcclxuXHRcdGVsc2UgaWYgKEFycmF5LmlzQXJyYXkoY2hhbmdlLm9iamVjdCkgJiYgY2hhbmdlLnR5cGUgPT09IFwic3BsaWNlXCIpIHtcclxuXHRcdFx0Ly8gSWYgaXRzIGEgcHVzaCwgYWRkZWRDb3VudCB3aWxsIGJlIDFcclxuXHRcdFx0aWYgKGNoYW5nZS5hZGRlZENvdW50ID4gMCkge1xyXG5cdFx0XHRcdC8vIHN0YXJ0IG9ic2VydmluZyB0aGUgbmV3IGFycmF5IGl0ZW1cclxuXHRcdFx0XHRzZWxmLnJlY3Vyc2l2ZU9ic2VydmUoY2hhbmdlLm9iamVjdFtjaGFuZ2UuaW5kZXhdLCBcIlwiLCBmdW5jdGlvbihjaGFuZ2VzKSB7IFxyXG5cdFx0XHRcdFx0c2VsZi5oYW5kbGVBcnJheUNoYW5nZS5jYWxsKHNlbGYsIGNoYW5nZXMsIHByb3BDaGFpbik7XHJcblx0XHRcdFx0fSk7XHJcblx0XHRcdH1cclxuXHRcdFx0Ly8gSWYgaXRzIGEgcG9wIHdlIHJlYWxseSBkb24ndCBjYXJlIGhlcmUgYmVjYXVzZSB0aGVyZSBpcyBub3RoaW5nIHRvIHJlLW9ic2VydmVcclxuXHRcdH1cclxuXHR9KTtcclxuXHQvLyBSZXJlbmRlciBkYXRhLWVhY2ggYmluZGluZ3MgdGhhdCBhcmUgdGllZCB0byB0aGUgYXJyYXlcclxuXHRzZWxmLmJpbmRpbmdzLmZvckVhY2goZnVuY3Rpb24oYmluZGluZykge1xyXG5cdFx0aWYgKGJpbmRpbmcuZnVsbFByb3BlcnR5ID09PSBwcm9wQ2hhaW4pIHtcclxuXHRcdFx0YmluZGluZy51cGRhdGUoc2VsZi5tb2RlbCk7XHJcblx0XHR9XHJcblx0fSk7XHJcbn07XHJcblxyXG5Ecm9vcHlCaW5kaW5nLnByb3RvdHlwZS5oYW5kbGVPYmplY3RDaGFuZ2UgPSBmdW5jdGlvbihjaGFuZ2VzLCBwcm9wQ2hhaW4pIHtcclxuXHR2YXIgc2VsZiA9IHRoaXM7XHJcblx0Y2hhbmdlcy5mb3JFYWNoKGZ1bmN0aW9uKGNoYW5nZSkge1xyXG5cdFx0Ly8gR2V0IHRoZSBwcm9wZXJ0eSBjaGFpbiBzdHJpbmcgdG8gdGllIGJhY2sgdG8gVUkgcGxhY2Vob2xkZXJcclxuXHRcdHZhciBjaGFuZ2VkUHJvcCA9IGNoYW5nZS5uYW1lO1xyXG5cdFx0aWYgKHByb3BDaGFpbikge1xyXG5cdFx0XHRjaGFuZ2VkUHJvcCA9IHByb3BDaGFpbiArIFwiLlwiICsgY2hhbmdlLm5hbWU7XHJcblx0XHR9XHJcblxyXG5cdFx0Ly8gQ2hlY2sgZWFjaCBiaW5kaW5nIHRvIHNlZSBpZiBpdCBjYXJlcywgdXBkYXRlIGlmIGl0IGRvZXNcclxuXHRcdHNlbGYuYmluZGluZ3MuZm9yRWFjaChmdW5jdGlvbihiaW5kaW5nKSB7XHJcblx0XHRcdC8vIHN0YXJ0cyB3aXRoIHByb3AgY2hhaW4gdG8gYWxsb3cgd2hvbGUgY2hpbGQgb2JqZWN0IHRvIGJlIHVwZGF0ZWRcclxuXHRcdFx0aWYgKGJpbmRpbmcuZnVsbFByb3BlcnR5LmluZGV4T2YoY2hhbmdlZFByb3ApID09PSAwKSB7XHJcblx0XHRcdFx0YmluZGluZy51cGRhdGUoc2VsZi5tb2RlbCk7XHJcblx0XHRcdH1cclxuXHRcdH0pO1xyXG5cclxuXHRcdC8vIElmIG9iamVjdCBnZXRzIG92ZXJ3cml0dGVuLCBuZWVkIHRvIHJlLW9ic2VydmUgaXRcclxuXHRcdGlmIChjaGFuZ2UudHlwZSA9PT0gXCJ1cGRhdGVcIikge1xyXG5cdFx0XHRzZWxmLnJlY3Vyc2l2ZU9ic2VydmUoY2hhbmdlLm9iamVjdFtjaGFuZ2UubmFtZV0sIGNoYW5nZWRQcm9wLCBmdW5jdGlvbihjaGFuZ2VzLCBwcm9wQ2hhaW4pIHtcclxuXHRcdFx0XHRzZWxmLmhhbmRsZU9iamVjdENoYW5nZShjaGFuZ2VzLCBwcm9wQ2hhaW4pO1xyXG5cdFx0XHR9KTtcclxuXHRcdH1cclxuXHR9KTtcclxufTtcclxuXHJcbkRyb29weUJpbmRpbmcucHJvdG90eXBlLnVwZGF0ZUJpbmRpbmdzID0gZnVuY3Rpb24oKSB7XHJcblx0dmFyIHNlbGYgPSB0aGlzO1xyXG5cdHNlbGYuYmluZGluZ3MuZm9yRWFjaChmdW5jdGlvbihiaW5kaW5nKSB7XHJcblx0XHRiaW5kaW5nLnVwZGF0ZShzZWxmLm1vZGVsKTtcclxuXHR9KTtcclxufTtcclxuXHJcbkRyb29weUJpbmRpbmcucHJvdG90eXBlLnVwZGF0ZU1vZGVsUHJvcGVydHkgPSBmdW5jdGlvbihmdWxsUHJvcGVydHksIG5ld1ZhbHVlKSB7XHJcblx0Ly9zdGFydCB3aXRoIHRoZSBtb2RlbFxyXG5cdHZhciBwcm9wZXJ0eUNoYWluID0gZnVsbFByb3BlcnR5LnNwbGl0KCcuJyk7XHJcblx0dmFyIHBhcmVudE9iaiA9IHRoaXMubW9kZWw7XHJcblx0dmFyIHByb3BlcnR5ID0gZnVsbFByb3BlcnR5O1xyXG5cdC8vdHJhdmVyc2UgdGhlIHByb3BlcnR5IGNoYWluLCBleGNlcHQgZm9yIGxhc3Qgb25lXHJcblx0Zm9yICh2YXIgaSA9IDA7IGkgPCBwcm9wZXJ0eUNoYWluLmxlbmd0aCAtIDE7IGkrKykge1xyXG5cdFx0aWYgKHBhcmVudE9ialtwcm9wZXJ0eUNoYWluW2ldXSAhPSBudWxsKSB7XHJcblx0XHRcdHByb3BlcnR5ID0gcHJvcGVydHlDaGFpbltpXTtcclxuXHRcdFx0cGFyZW50T2JqID0gcGFyZW50T2JqW3Byb3BlcnR5XTtcclxuXHRcdH0gXHJcblx0fVxyXG5cdC8vaWYgaXRzIGFuIHVuZGVyc2NvcmUsIGl0cyByZWZlcmVuY2luZyB0aGUgbW9kZWwgc2NvcGVcclxuXHRpZihmdWxsUHJvcGVydHkgPT09IFwiX1wiKSB7XHJcblx0XHRwYXJlbnRPYmogPSBuZXdWYWx1ZTtcclxuXHR9IGVsc2Uge1xyXG5cdFx0cHJvcGVydHkgPSBwcm9wZXJ0eUNoYWluW3Byb3BlcnR5Q2hhaW4ubGVuZ3RoIC0gMV07XHJcblx0XHRwYXJlbnRPYmpbcHJvcGVydHldID0gbmV3VmFsdWU7XHJcblx0fVxyXG59O1xyXG5cclxuRHJvb3B5QmluZGluZy5wcm90b3R5cGUudXBkYXRlTW9kZWwgPSBmdW5jdGlvbihuZXdNb2RlbCkge1xyXG5cdHRoaXMubW9kZWwgPSBuZXdNb2RlbDtcclxuXHR0aGlzLmluaXQoKTtcclxufTtcclxuXHJcbkRyb29weUJpbmRpbmcucHJvdG90eXBlLmdldEJpbmRpbmdzID0gZnVuY3Rpb24oZWxlbWVudCkge1xyXG5cdHZhciBzZWxmID0gdGhpcztcclxuXHR2YXIgYmluZGluZ3MgPSBbXTtcclxuXHR2YXIgcGxhY2Vob2xkZXJzID0gW107XHJcblx0dmFyIGkgPSAwO1xyXG5cdC8vIDEuIExvb2sgZm9yIGF0dHJpYnV0ZSBiaW5kaW5ncyBhbmQgYXJyYXkgYmluZGluZ3Mgb24gdGhlIGN1cnJlbnQgZWxlbWVudFxyXG5cdGlmIChlbGVtZW50LmF0dHJpYnV0ZXMpIHtcclxuXHRcdGZvciAoaSA9IDA7IGkgPCBlbGVtZW50LmF0dHJpYnV0ZXMubGVuZ3RoOyBpKyspIHtcclxuXHRcdFx0aWYgKGVsZW1lbnQuYXR0cmlidXRlc1tpXS5ub2RlTmFtZSA9PT0gXCJkYXRhLWVhY2hcIikge1xyXG5cdFx0XHRcdGJpbmRpbmdzLnB1c2gobmV3IEFycmF5QmluZGluZyhlbGVtZW50LCBlbGVtZW50LmF0dHJpYnV0ZXNbaV0ubm9kZVZhbHVlKSk7XHJcblx0XHRcdH0gZWxzZSB7XHJcblx0XHRcdFx0dmFyIGF0dHJpYnV0ZUJpbmRpbmdzID0gdGVtcGxhdGluZy5nZXRQbGFjZUhvbGRlcnMoZWxlbWVudC5hdHRyaWJ1dGVzW2ldLm5vZGVWYWx1ZSlcclxuXHRcdFx0XHRcdC5tYXAoZnVuY3Rpb24ocGxhY2Vob2xkZXIpIHtcclxuXHRcdFx0XHRcdFx0dmFyIGJpbmRpbmcgPSBuZXcgTm9kZUJpbmRpbmcoZWxlbWVudC5hdHRyaWJ1dGVzW2ldLCBwbGFjZWhvbGRlciwgZWxlbWVudCk7XHJcblx0XHRcdFx0XHRcdGJpbmRpbmcub24oXCJpbnB1dC1jaGFuZ2VcIiwgc2VsZi51cGRhdGVNb2RlbFByb3BlcnR5LmJpbmQoc2VsZikpO1xyXG5cdFx0XHRcdFx0XHRyZXR1cm4gYmluZGluZztcclxuXHRcdFx0XHRcdH0pO1xyXG5cdFx0XHRcdGJpbmRpbmdzID0gYmluZGluZ3MuY29uY2F0KGF0dHJpYnV0ZUJpbmRpbmdzKTtcdFx0XHRcdFxyXG5cdFx0XHR9XHJcblx0XHR9XHJcblx0fVxyXG5cdC8vIDIuYSBJZiB0aGUgZWxlbWVudCBoYXMgY2hpbGRyZW4sIGl0IHdvbid0IGhhdmUgYSB0ZXh0IGJpbmRpbmcuIFJlY3Vyc2Ugb24gY2hpbGRyZW5cclxuXHRpZiAoZWxlbWVudC5jaGlsZE5vZGVzICYmIGVsZW1lbnQuY2hpbGROb2Rlcy5sZW5ndGgpIHtcclxuXHRcdC8vcmVjdXJzaXZlIGNhbGwgZm9yIGVhY2ggY2hpbGRub2RlXHJcblx0XHRmb3IgKGkgPSAwOyBpIDwgZWxlbWVudC5jaGlsZE5vZGVzLmxlbmd0aDsgaSsrKSB7XHJcblx0XHRcdGJpbmRpbmdzID0gYmluZGluZ3MuY29uY2F0KHNlbGYuZ2V0QmluZGluZ3MoZWxlbWVudC5jaGlsZE5vZGVzW2ldKSk7XHJcblx0XHR9XHJcblx0fSBlbHNlIHtcclxuXHRcdC8vIDIuYiBUaGUgZWxlbWVudCBkb2Vzbid0IGhhdmUgY2hpbGRyZW4gc28gbG9vayBmb3IgYSB0ZXh0IGJpbmRpbmdcclxuXHRcdHBsYWNlaG9sZGVycyA9IHRlbXBsYXRpbmcuZ2V0UGxhY2VIb2xkZXJzKGVsZW1lbnQudGV4dENvbnRlbnQpO1xyXG5cdFx0dmFyIHRleHRCaW5kaW5ncyA9IHBsYWNlaG9sZGVycy5tYXAoZnVuY3Rpb24ocGxhY2Vob2xkZXIpIHtcclxuXHRcdFx0cmV0dXJuIG5ldyBOb2RlQmluZGluZyhlbGVtZW50LCBwbGFjZWhvbGRlcik7XHJcblx0XHR9KTtcclxuXHRcdGJpbmRpbmdzID0gYmluZGluZ3MuY29uY2F0KHRleHRCaW5kaW5ncyk7XHJcblx0fVxyXG5cdHJldHVybiBiaW5kaW5ncztcclxufTtcclxuXHJcbm1vZHVsZS5leHBvcnRzID0gRHJvb3B5QmluZGluZzsiLCJ2YXIgdGVtcGxhdGluZyA9IHJlcXVpcmUoXCJkcm9vcHktdGVtcGxhdGluZ1wiKTtcclxudmFyIEV2ZW50YWJsZSA9IHJlcXVpcmUoXCJkcm9vcHktZXZlbnRzXCIpO1xyXG5cclxudmFyIE5vZGVCaW5kaW5nID0gZnVuY3Rpb24obm9kZSwgcGxhY2Vob2xkZXIsIGVsZW1lbnQpIHtcclxuXHRFdmVudGFibGUuY2FsbCh0aGlzKTtcclxuXHR0aGlzLm5vZGUgPSBub2RlO1xyXG5cdHRoaXMub3JpZ2luYWwgPSBub2RlLm5vZGVWYWx1ZTtcclxuXHR0aGlzLnJhdyA9IHBsYWNlaG9sZGVyO1xyXG5cdHRoaXMuZnVsbFByb3BlcnR5ID0gdGhpcy5yYXcuc2xpY2UoMiwgdGhpcy5yYXcubGVuZ3RoIC0gMik7XHJcblx0Ly9pZiBubyBlbGVtZW50IHdhcyBwYXNzZWQgaW4sIGl0IGlzIGEgdGV4dCBiaW5kaW5nLCBvdGhlcndpc2UgYXR0cmlidXRlXHJcblx0dGhpcy5lbGVtZW50ID0gZWxlbWVudCB8fCBub2RlOyBcclxuXHR0aGlzLnNldHVwVHdvV2F5KCk7XHJcbn07XHJcblxyXG5Ob2RlQmluZGluZy5wcm90b3R5cGUgPSBuZXcgRXZlbnRhYmxlKCk7XHJcblxyXG5Ob2RlQmluZGluZy5wcm90b3R5cGUuc2V0dXBUd29XYXkgPSBmdW5jdGlvbigpIHtcclxuXHRpZiAodGhpcy5ub2RlLm5vZGVOYW1lID09PSBcInZhbHVlXCIgJiYgdGhpcy5lbGVtZW50KSB7XHJcblx0XHRpZiAodGhpcy5lbGVtZW50LnRhZ05hbWUudG9Mb3dlckNhc2UoKSA9PT0gXCJpbnB1dFwiKSB7XHJcblx0XHRcdHRoaXMuZWxlbWVudC5hZGRFdmVudExpc3RlbmVyKFwiaW5wdXRcIiwgdGhpcy5vbklucHV0Q2hhbmdlLmJpbmQodGhpcykpO1xyXG5cdFx0fVxyXG5cdFx0aWYgKHRoaXMuZWxlbWVudC50YWdOYW1lLnRvTG93ZXJDYXNlKCkgPT09IFwic2VsZWN0XCIpIHtcclxuXHRcdFx0dGhpcy5lbGVtZW50LmFkZEV2ZW50TGlzdGVuZXIoXCJjaGFuZ2VcIiwgdGhpcy5vbklucHV0Q2hhbmdlLmJpbmQodGhpcykpO1xyXG5cdFx0fVxyXG5cdH1cclxufTtcclxuXHJcbk5vZGVCaW5kaW5nLnByb3RvdHlwZS5vbklucHV0Q2hhbmdlID0gZnVuY3Rpb24oKSB7XHJcblx0Ly9jYWxsZWQgd2l0aCBiaW5kLCBzbyAndGhpcycgaXMgYWN0dWFsbHkgdGhpc1xyXG5cdHRoaXMudHJpZ2dlcihcImlucHV0LWNoYW5nZVwiLCB0aGlzLmZ1bGxQcm9wZXJ0eSwgdGhpcy5lbGVtZW50LnZhbHVlICk7XHJcbn07XHJcblxyXG5Ob2RlQmluZGluZy5wcm90b3R5cGUudXBkYXRlID0gZnVuY3Rpb24obW9kZWwpIHtcclxuXHR2YXIgc2VsZiA9IHRoaXM7XHJcblx0dmFyIGh0bWwgPSB0ZW1wbGF0aW5nLnJlbmRlclRlbXBsYXRlKHNlbGYub3JpZ2luYWwsIG1vZGVsKTtcclxuXHRzZWxmLm5vZGUubm9kZVZhbHVlID0gaHRtbDtcclxuXHRpZiAoc2VsZi5ub2RlLm5vZGVOYW1lID09PSBcInZhbHVlXCIgJiYgc2VsZi5lbGVtZW50KSB7XHJcblx0XHRzZWxmLmVsZW1lbnQudmFsdWUgPSBodG1sO1xyXG5cdH1cclxufTtcclxuXHJcbm1vZHVsZS5leHBvcnRzID0gTm9kZUJpbmRpbmc7Il19
