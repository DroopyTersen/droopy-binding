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
var Eventable = require("droopy-events");

var DroopyBinding = function(containerId, model, options) {
	options = options || {};
	this.model = model;
	this.container = document.getElementById(containerId);
	this.observeArrayItems = options.observeArrayItems || false;
	//Get all bindings
	this.bindings = this.getBindings(this.container);
	Eventable.call(this);

	if (options.shouldInit !== false) {
		this.init();
	}
};

DroopyBinding.prototype = new Eventable();
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
		if (false && Array.observe) {
			Array.observe(obj, function(changes) {
				self.handleArrayChange(changes, propChain);
			});			
		} else {
			Object.observe(obj, function(changes) {
				self.handleArrayChange(changes, propChain);
			});	
		}
		if (this.observeArrayItems) {
			// Recursively observe any array items
			obj.forEach(function(arrayItem, i){
				self.recursiveObserve(arrayItem, "", function(changes) { 
					self.handleArrayChange.call(self, changes, propChain);
				});
			});			
		}
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
	var count = 0;
	// Re-observe any new objects
	changes.forEach(function(change){
		count++;
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

var _findBindings = function(bindings, property) {
	return bindings.filter(function(binding) {
		return (binding.fullProperty.indexOf(property) === 0)
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
		_findBindings(self.bindings, changedProp).forEach(function(binding){
			binding.update(self.model);
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

DroopyBinding.prototype.bindEvents = function(nodeBinding) {
	var self = this;
	nodeBinding.on("input-change", self.updateModelProperty.bind(self));
	nodeBinding.on("updating", function(fullProperty) {
		self.broadcast("updating", fullProperty);
	});
	nodeBinding.on("updated", function(fullProperty) {
		self.broadcast("updated", fullProperty);
	});
};

DroopyBinding.prototype.broadcast = function(event, fullProperty) {
	var properties = fullProperty.split(".");
	var propChain = "";
	for(var i = 0; i < properties.length; i++) {
		propChain = propChain + properties[i];
		this.trigger(event + "-" + propChain);
		propChain += ".";
	}
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
						self.bindEvents(binding);
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
			var binding = new NodeBinding(element, placeholder, element.parentNode);
			self.bindEvents(binding);
			return binding;
		});
		bindings = bindings.concat(textBindings);
	}
	return bindings;
};

DroopyBinding.prototype.subscribe = function(event, property, callback) {
	this.on(event + "-" + property, callback);
};



module.exports = DroopyBinding;
},{"./arrayBinding":4,"./nodeBinding":6,"droopy-events":2,"droopy-templating":3}],6:[function(require,module,exports){
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
	var self = this;
	if (this.element && this.element.tagName) {
		var elementType = this.element.tagName.toLowerCase();
		// TEXT AREA
		if (elementType === "textarea") {
			this.element.addEventListener("input", this.onInputChange.bind(this));

		} else if (this.node.nodeName === "value") {
			// INPUT element
			if (elementType === "input") {
				this.element.addEventListener("input", this.onInputChange.bind(this));
				this.element.addEventListener("change", this.onInputChange.bind(this));
			} 
			// SELECT element
			else if (elementType === "select") {
				this.element.addEventListener("change", this.onInputChange.bind(this));
				setTimeout(this.onInputChange.bind(this), 1);
			}
		}
	}
};

NodeBinding.prototype.onInputChange = function() {
	//called with bind, so 'this' is actually this
	this.trigger("input-change", this.fullProperty, this.element.value );
};

NodeBinding.prototype.update = function(model) {
	var self = this;
	self.trigger("updating", self.fullProperty);
	//skip a tick in event loop to let 'updating' be handled before update
		var html = templating.renderTemplate(self.original, model);
		self.node.nodeValue = html;
		if (self.node.nodeName === "value" && self.element) {
			if (self.element.value !== html) {
				self.element.value = html;
			}
		}
		self.trigger("updated", self.fullProperty);		
};

module.exports = NodeBinding;
},{"droopy-events":2,"droopy-templating":3}]},{},[1])
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIkM6XFxnaXR3aXBcXGRyb29weS1iaW5kaW5nXFxub2RlX21vZHVsZXNcXGd1bHAtYnJvd3NlcmlmeVxcbm9kZV9tb2R1bGVzXFxicm93c2VyaWZ5XFxub2RlX21vZHVsZXNcXGJyb3dzZXItcGFja1xcX3ByZWx1ZGUuanMiLCJDOi9naXR3aXAvZHJvb3B5LWJpbmRpbmcvZW50cmllcy9mYWtlXzQzMmMwMWM2LmpzIiwiQzovZ2l0d2lwL2Ryb29weS1iaW5kaW5nL25vZGVfbW9kdWxlcy9kcm9vcHktZXZlbnRzL0V2ZW50QWdncmVnYXRvci5qcyIsIkM6L2dpdHdpcC9kcm9vcHktYmluZGluZy9ub2RlX21vZHVsZXMvZHJvb3B5LXRlbXBsYXRpbmcvZHJvb3B5LXRlbXBsYXRpbmcuanMiLCJDOi9naXR3aXAvZHJvb3B5LWJpbmRpbmcvc3JjL2FycmF5QmluZGluZy5qcyIsIkM6L2dpdHdpcC9kcm9vcHktYmluZGluZy9zcmMvZHJvb3B5QmluZGluZy5qcyIsIkM6L2dpdHdpcC9kcm9vcHktYmluZGluZy9zcmMvbm9kZUJpbmRpbmcuanMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7QUNBQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ0pBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDdEVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2hHQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDcEJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDck9BO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EiLCJmaWxlIjoiZ2VuZXJhdGVkLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXNDb250ZW50IjpbIihmdW5jdGlvbiBlKHQsbixyKXtmdW5jdGlvbiBzKG8sdSl7aWYoIW5bb10pe2lmKCF0W29dKXt2YXIgYT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2lmKCF1JiZhKXJldHVybiBhKG8sITApO2lmKGkpcmV0dXJuIGkobywhMCk7dGhyb3cgbmV3IEVycm9yKFwiQ2Fubm90IGZpbmQgbW9kdWxlICdcIitvK1wiJ1wiKX12YXIgZj1uW29dPXtleHBvcnRzOnt9fTt0W29dWzBdLmNhbGwoZi5leHBvcnRzLGZ1bmN0aW9uKGUpe3ZhciBuPXRbb11bMV1bZV07cmV0dXJuIHMobj9uOmUpfSxmLGYuZXhwb3J0cyxlLHQsbixyKX1yZXR1cm4gbltvXS5leHBvcnRzfXZhciBpPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7Zm9yKHZhciBvPTA7bzxyLmxlbmd0aDtvKyspcyhyW29dKTtyZXR1cm4gc30pIiwiKGZ1bmN0aW9uIChnbG9iYWwpe1xuZ2xvYmFsLmRyb29weUJpbmRpbmcgPSB7fTtcclxuZ2xvYmFsLkRyb29weUJpbmRpbmcgPSByZXF1aXJlKFwiLi4vc3JjL2Ryb29weUJpbmRpbmdcIik7XHJcbmV4cG9ydHMuRHJvb3B5QmluZGluZyA9IGdsb2JhbC5Ecm9vcHlCaW5kaW5nO1xufSkuY2FsbCh0aGlzLHR5cGVvZiBzZWxmICE9PSBcInVuZGVmaW5lZFwiID8gc2VsZiA6IHR5cGVvZiB3aW5kb3cgIT09IFwidW5kZWZpbmVkXCIgPyB3aW5kb3cgOiB7fSkiLCJ2YXIgRXZlbnRBZ2dyZWdhdG9yID0gZnVuY3Rpb24oKSB7XHJcblx0dGhpcy5ldmVudEtleXMgPSB7fTtcclxuXHR0aGlzLmxhc3RTdWJzY3JpcHRpb25JZCA9IC0xO1xyXG59O1xyXG5cclxuRXZlbnRBZ2dyZWdhdG9yLnByb3RvdHlwZS5vbiA9IGZ1bmN0aW9uKGtleSwgY2FsbGJhY2spIHtcclxuXHRpZiAodHlwZW9mIGNhbGxiYWNrID09PSBcImZ1bmN0aW9uXCIpIHtcclxuXHRcdGlmICghdGhpcy5ldmVudEtleXNba2V5XSkge1xyXG5cdFx0XHR0aGlzLmV2ZW50S2V5c1trZXldID0ge1xyXG5cdFx0XHRcdHN1YnNjcmlwdGlvbnM6IHt9XHJcblx0XHRcdH07XHJcblx0XHR9XHJcblx0XHR2YXIgdG9rZW4gPSAoKyt0aGlzLmxhc3RTdWJzY3JpcHRpb25JZCkudG9TdHJpbmcoKTtcclxuXHRcdHRoaXMuZXZlbnRLZXlzW2tleV0uc3Vic2NyaXB0aW9uc1t0b2tlbl0gPSBjYWxsYmFjaztcclxuXHRcdHJldHVybiB0b2tlbjtcclxuXHR9IGVsc2Uge1xyXG5cdFx0cmV0dXJuIGZhbHNlO1xyXG5cdH1cclxufTtcclxuXHJcbkV2ZW50QWdncmVnYXRvci5wcm90b3R5cGUub2ZmID0gZnVuY3Rpb24oa2V5LCB0b2tlbk9yQ2FsbGJhY2spIHtcclxuXHRpZiAodHlwZW9mIHRva2VuT3JDYWxsYmFjayA9PT0gJ2Z1bmN0aW9uJykge1xyXG5cdFx0Ly9DYWxsYmFjayByZWZlcmVuY2Ugd2FzIHBhc3NlZCBpbiBzbyBmaW5kIHRoZSBzdWJzY3JpcHRpb24gd2l0aCB0aGUgbWF0Y2hpbmcgZnVuY3Rpb25cclxuXHRcdGlmICh0aGlzLmV2ZW50S2V5c1trZXldKSB7XHJcblx0XHRcdHZhciBldmVudFN1YnNjcmlwdGlvbnMgPSB0aGlzLmV2ZW50S2V5c1trZXldLnN1YnNjcmlwdGlvbnM7XHJcblx0XHRcdHZhciBtYXRjaGluZ0lkID0gbnVsbDtcclxuXHRcdFx0Ly9mb3JlYWNoIHN1YnNjcmlwdGlvbiBzZWUgaWYgdGhlIGZ1bmN0aW9ucyBtYXRjaCBhbmQgc2F2ZSB0aGUga2V5IGlmIHllc1xyXG5cdFx0XHRmb3IgKHZhciBzdWJzY3JpcHRpb25JZCBpbiBldmVudFN1YnNjcmlwdGlvbnMpIHtcclxuXHRcdFx0XHRpZiAoZXZlbnRTdWJzY3JpcHRpb25zLmhhc093blByb3BlcnR5KHN1YnNjcmlwdGlvbklkKSkge1xyXG5cdFx0XHRcdFx0aWYgKGV2ZW50U3Vic2NyaXB0aW9uc1tzdWJzY3JpcHRpb25JZF0gPT09IHRva2VuT3JDYWxsYmFjaykge1xyXG5cdFx0XHRcdFx0XHRtYXRjaGluZ0lkID0gc3Vic2NyaXB0aW9uSWQ7XHJcblx0XHRcdFx0XHR9XHJcblx0XHRcdFx0fVxyXG5cdFx0XHR9XHJcblx0XHRcdGlmIChtYXRjaGluZ0lkICE9PSBudWxsKSB7XHJcblx0XHRcdFx0ZGVsZXRlIGV2ZW50U3Vic2NyaXB0aW9uc1ttYXRjaGluZ0lkXTtcclxuXHRcdFx0fVxyXG5cdFx0fVxyXG5cdH0gZWxzZSB7XHJcblx0XHQvL1Rva2VuIHdhcyBwYXNzZWQgaW5cclxuXHRcdGlmICh0aGlzLmV2ZW50S2V5c1trZXldICYmIHRoaXMuZXZlbnRLZXlzW2tleV0uc3Vic2NyaXB0aW9uc1t0b2tlbk9yQ2FsbGJhY2tdKSB7XHJcblx0XHRcdGRlbGV0ZSB0aGlzLmV2ZW50S2V5c1trZXldLnN1YnNjcmlwdGlvbnNbdG9rZW5PckNhbGxiYWNrXTtcclxuXHRcdH1cclxuXHR9XHJcbn07XHJcblxyXG5FdmVudEFnZ3JlZ2F0b3IucHJvdG90eXBlLnRyaWdnZXIgPSBmdW5jdGlvbihrZXkpIHtcclxuXHR2YXIgc2VsZiA9IHRoaXM7XHJcblx0aWYgKHNlbGYuZXZlbnRLZXlzW2tleV0pIHtcclxuXHRcdHZhciB2YWx1ZXMgPSBBcnJheS5wcm90b3R5cGUuc2xpY2UuY2FsbChhcmd1bWVudHMsIDEpO1xyXG5cdFx0Ly9JZiBwYXNzaW5nIGxlc3MgdGhhbiB2YWx1ZXMgcGFzcyB0aGVtIGluZGl2aWR1YWxseVxyXG5cdFx0dmFyIGExID0gdmFsdWVzWzBdLFxyXG5cdFx0XHRhMiA9IHZhbHVlc1sxXSxcclxuXHRcdFx0YTMgPSB2YWx1ZXNbMl07XHJcblx0XHQvL0Vsc2UgaWYgcGFzc2luZyBtb3JlIHRoYW4gMyB2YWx1ZXMgZ3JvdXAgYXMgYW4gYXJncyBhcnJheVxyXG5cdFx0aWYgKHZhbHVlcy5sZW5ndGggPiAzKSB7XHJcblx0XHRcdGExID0gdmFsdWVzO1xyXG5cdFx0fVxyXG5cclxuXHRcdHZhciBzdWJzY3JpcHRpb25zID0gc2VsZi5ldmVudEtleXNba2V5XS5zdWJzY3JpcHRpb25zO1xyXG5cdFx0c2V0VGltZW91dChmdW5jdGlvbigpIHtcclxuXHRcdFx0Zm9yICh2YXIgdG9rZW4gaW4gc3Vic2NyaXB0aW9ucykge1xyXG5cdFx0XHRcdGlmIChzdWJzY3JpcHRpb25zLmhhc093blByb3BlcnR5KHRva2VuKSkge1xyXG5cdFx0XHRcdFx0c3Vic2NyaXB0aW9uc1t0b2tlbl0oYTEsIGEyLCBhMyk7XHJcblx0XHRcdFx0fVxyXG5cdFx0XHR9XHJcblx0XHR9LCAwKTtcclxuXHR9XHJcbn07XHJcblxyXG5tb2R1bGUuZXhwb3J0cyA9IEV2ZW50QWdncmVnYXRvcjsiLCJ2YXIgdGVtcGxhdGluZyA9IHtcclxuXHJcblx0UGxhY2Vob2xkZXI6IGZ1bmN0aW9uKHJhdykge1xyXG5cdFx0dGhpcy5yYXcgPSByYXc7XHJcblx0XHR0aGlzLmZ1bGxQcm9wZXJ0eSA9IHJhdy5zbGljZSgyLCByYXcubGVuZ3RoIC0gMik7XHJcblx0fSxcclxuXHJcblx0Z2V0UGxhY2VIb2xkZXJzOiBmdW5jdGlvbih0ZW1wbGF0ZSwgcmVnZXhwKSB7XHJcblx0XHR2YXIgcmVnRXhwUGF0dGVybiA9IHJlZ2V4cCB8fCAvXFx7XFx7W15cXH1dK1xcfVxcfT8vZztcclxuXHRcdHZhciBtYXRjaGVzID0gdGVtcGxhdGUubWF0Y2gocmVnRXhwUGF0dGVybik7XHJcblx0XHRyZXR1cm4gbWF0Y2hlcyB8fCBbXTtcclxuXHR9LFxyXG5cclxuXHRnZXRPYmplY3RWYWx1ZTogZnVuY3Rpb24ob2JqLCBmdWxsUHJvcGVydHkpIHtcclxuXHRcdHZhciB2YWx1ZSA9IG9iaixcclxuXHRcdFx0cHJvcGVydHlDaGFpbiA9IGZ1bGxQcm9wZXJ0eS5zcGxpdCgnLicpO1xyXG5cclxuXHRcdGZvciAodmFyIGkgPSAwOyBpIDwgcHJvcGVydHlDaGFpbi5sZW5ndGg7IGkrKykge1xyXG5cdFx0XHR2YXIgcHJvcGVydHkgPSBwcm9wZXJ0eUNoYWluW2ldO1xyXG5cdFx0XHR2YWx1ZSA9IHZhbHVlW3Byb3BlcnR5XSAhPSBudWxsID8gdmFsdWVbcHJvcGVydHldIDogXCJOb3QgRm91bmQ6IFwiICsgZnVsbFByb3BlcnR5O1xyXG5cdFx0fVxyXG5cclxuXHRcdGlmKGZ1bGxQcm9wZXJ0eSA9PT0gXCJfXCIpIHtcclxuXHRcdFx0dmFsdWUgPSBvYmo7XHJcblx0XHR9XHJcblx0XHRcclxuXHRcdGlmICgodHlwZW9mIHZhbHVlID09PSBcInN0cmluZ1wiKSAmJiB2YWx1ZS5pbmRleE9mKFwiL0RhdGUoXCIpICE9PSAtMSkge1xyXG5cdFx0XHR2YXIgZGF0ZVZhbHVlID0gVVRDSnNvblRvRGF0ZSh2YWx1ZSk7XHJcblx0XHRcdHZhbHVlID0gZGF0ZVZhbHVlLnRvTG9jYWxlRGF0ZVN0cmluZygpO1xyXG5cdFx0fVxyXG5cclxuXHRcdHJldHVybiB2YWx1ZTtcclxuXHR9LFxyXG5cclxuXHRwb3B1bGF0ZVRlbXBsYXRlOiBmdW5jdGlvbih0ZW1wbGF0ZSwgaXRlbSwgcmVnZXhwKSB7XHJcblx0XHR2YXIgcGxhY2Vob2xkZXJzID0gdGhpcy5nZXRQbGFjZUhvbGRlcnModGVtcGxhdGUsIHJlZ2V4cCkgfHwgW10sXHJcblx0XHRcdGl0ZW1IdG1sID0gdGVtcGxhdGU7XHJcblxyXG5cdFx0Zm9yICh2YXIgaSA9IDA7IGkgPCBwbGFjZWhvbGRlcnMubGVuZ3RoOyBpKyspIHtcclxuXHRcdFx0dmFyIHBsYWNlaG9sZGVyID0gbmV3IHRoaXMuUGxhY2Vob2xkZXIocGxhY2Vob2xkZXJzW2ldKTtcclxuXHRcdFx0cGxhY2Vob2xkZXIudmFsID0gdGhpcy5nZXRPYmplY3RWYWx1ZShpdGVtLCBwbGFjZWhvbGRlci5mdWxsUHJvcGVydHkpO1xyXG5cdFx0XHR2YXIgcGF0dGVybiA9IHBsYWNlaG9sZGVyLnJhdy5yZXBsYWNlKFwiW1wiLCBcIlxcXFxbXCIpLnJlcGxhY2UoXCJdXCIsIFwiXFxcXF1cIik7XHJcblx0XHRcdHZhciBtb2RpZmllciA9IFwiZ1wiO1xyXG5cdFx0XHRpdGVtSHRtbCA9IGl0ZW1IdG1sLnJlcGxhY2UobmV3IFJlZ0V4cChwYXR0ZXJuLCBtb2RpZmllciksIHBsYWNlaG9sZGVyLnZhbCk7XHJcblx0XHR9XHJcblx0XHRyZXR1cm4gaXRlbUh0bWw7XHJcblx0fVxyXG59O1xyXG5cclxudGVtcGxhdGluZy5FYWNoID0ge1xyXG5cclxuXHRyZWdFeHA6IC9cXHtcXFtbXlxcXV0rXFxdXFx9Py9nLFxyXG5cclxuXHRwb3B1bGF0ZUVhY2hUZW1wbGF0ZXM6IGZ1bmN0aW9uKGl0ZW1IdG1sLCBpdGVtKSB7XHJcblx0XHR2YXIgJGl0ZW1IdG1sID0gJChpdGVtSHRtbCksXHJcblx0XHRcdGVhY2hUZW1wbGF0ZXMgPSAkaXRlbUh0bWwuZmluZChcIltkYXRhLWVhY2hdXCIpO1xyXG5cclxuXHRcdGVhY2hUZW1wbGF0ZXMuZWFjaChmdW5jdGlvbigpIHtcclxuXHRcdFx0dmFyIGFycmF5SHRtbCA9IFwiXCIsXHJcblx0XHRcdFx0aXRlbVRlbXBsYXRlID0gJCh0aGlzKS5odG1sKCksXHJcblx0XHRcdFx0YXJyYXlQcm9wID0gJCh0aGlzKS5kYXRhKFwiZWFjaFwiKSxcclxuXHRcdFx0XHRhcnJheSA9IHNwLnRlbXBsYXRpbmcuZ2V0T2JqZWN0VmFsdWUoaXRlbSwgYXJyYXlQcm9wKTtcclxuXHJcblx0XHRcdGlmIChhcnJheSAhPSBudWxsICYmICQuaXNBcnJheShhcnJheSkpIHtcclxuXHRcdFx0XHRmb3IgKHZhciBpID0gMDsgaSA8IGFycmF5Lmxlbmd0aDsgaSsrKSB7XHJcblx0XHRcdFx0XHRhcnJheUh0bWwgKz0gdGVtcGxhdGluZy5wb3B1bGF0ZVRlbXBsYXRlKGl0ZW1UZW1wbGF0ZSwgYXJyYXlbaV0sIHRlbXBsYXRpbmcuRWFjaC5yZWdFeHApO1xyXG5cdFx0XHRcdH1cclxuXHRcdFx0fVxyXG5cclxuXHRcdFx0JGl0ZW1IdG1sLmZpbmQoJCh0aGlzKSkuaHRtbChhcnJheUh0bWwpO1xyXG5cdFx0fSk7XHJcblxyXG5cdFx0dmFyIHRlbXAgPSAkaXRlbUh0bWwuY2xvbmUoKS53cmFwKFwiPGRpdj5cIik7XHJcblx0XHRyZXR1cm4gdGVtcC5wYXJlbnQoKS5odG1sKCk7XHJcblx0fVxyXG59O1xyXG5cclxudGVtcGxhdGluZy5yZW5kZXJUZW1wbGF0ZSA9IGZ1bmN0aW9uKHRlbXBsYXRlLCBpdGVtLCByZW5kZXJFYWNoVGVtcGxhdGUpIHtcclxuXHR2YXIgaXRlbUh0bWwgPSB0ZW1wbGF0aW5nLnBvcHVsYXRlVGVtcGxhdGUodGVtcGxhdGUsIGl0ZW0pO1xyXG5cdGlmIChyZW5kZXJFYWNoVGVtcGxhdGUpIHtcclxuXHRcdGl0ZW1IdG1sID0gdGVtcGxhdGluZy5FYWNoLnBvcHVsYXRlRWFjaFRlbXBsYXRlcyhpdGVtSHRtbCwgaXRlbSk7XHJcblx0fVxyXG5cdHJldHVybiBpdGVtSHRtbDtcclxufTtcclxuXHJcbnZhciBVVENKc29uVG9EYXRlID0gZnVuY3Rpb24oanNvbkRhdGUpIHtcclxuXHR2YXIgdXRjU3RyID0ganNvbkRhdGUuc3Vic3RyaW5nKGpzb25EYXRlLmluZGV4T2YoXCIoXCIpICsgMSk7XHJcblx0dXRjU3RyID0gdXRjU3RyLnN1YnN0cmluZygwLCB1dGNTdHIuaW5kZXhPZihcIilcIikpO1xyXG5cclxuXHR2YXIgcmV0dXJuRGF0ZSA9IG5ldyBEYXRlKHBhcnNlSW50KHV0Y1N0ciwgMTApKTtcclxuXHR2YXIgaG91ck9mZnNldCA9IHJldHVybkRhdGUuZ2V0VGltZXpvbmVPZmZzZXQoKSAvIDYwO1xyXG5cdHJldHVybkRhdGUuc2V0SG91cnMocmV0dXJuRGF0ZS5nZXRIb3VycygpICsgaG91ck9mZnNldCk7XHJcblxyXG5cdHJldHVybiByZXR1cm5EYXRlO1xyXG59O1xyXG5cclxubW9kdWxlLmV4cG9ydHMgPSB0ZW1wbGF0aW5nOyIsInZhciB0ZW1wbGF0aW5nID0gcmVxdWlyZShcImRyb29weS10ZW1wbGF0aW5nXCIpO1xyXG5cclxudmFyIEFycmF5QmluZGluZyA9IGZ1bmN0aW9uKGVsZW1lbnQsIGZ1bGxQcm9wZXJ0eSkge1xyXG5cdHRoaXMuZWxlbWVudCA9IGVsZW1lbnQ7XHJcblx0dGhpcy5vcmlnaW5hbCA9IGVsZW1lbnQuaW5uZXJIVE1MO1xyXG5cdHRoaXMuZnVsbFByb3BlcnR5ID0gZnVsbFByb3BlcnR5O1xyXG59O1xyXG5cclxuQXJyYXlCaW5kaW5nLnByb3RvdHlwZS51cGRhdGUgPSBmdW5jdGlvbihzY29wZSkge1xyXG5cdHZhciBzZWxmID0gdGhpcztcclxuXHR2YXIgYXJyYXlIdG1sID0gXCJcIjtcclxuXHR2YXIgYXJyYXkgPSB0ZW1wbGF0aW5nLmdldE9iamVjdFZhbHVlKHNjb3BlLCBzZWxmLmZ1bGxQcm9wZXJ0eSk7XHJcblx0aWYgKGFycmF5ICYmIEFycmF5LmlzQXJyYXkoYXJyYXkpKSB7XHJcblx0XHRmb3IgKHZhciBpID0gMDsgaSA8IGFycmF5Lmxlbmd0aDsgaSsrKSB7XHJcblx0XHRcdGFycmF5SHRtbCArPSB0ZW1wbGF0aW5nLnBvcHVsYXRlVGVtcGxhdGUoc2VsZi5vcmlnaW5hbCwgYXJyYXlbaV0sIHRlbXBsYXRpbmcuRWFjaC5yZWdFeHApO1xyXG5cdFx0fVxyXG5cdH1cclxuXHRzZWxmLmVsZW1lbnQuaW5uZXJIVE1MID0gYXJyYXlIdG1sO1xyXG59O1xyXG5cclxubW9kdWxlLmV4cG9ydHMgPSBBcnJheUJpbmRpbmc7IiwidmFyIHRlbXBsYXRpbmcgPSByZXF1aXJlKFwiZHJvb3B5LXRlbXBsYXRpbmdcIik7XHJcbnZhciBOb2RlQmluZGluZyA9IHJlcXVpcmUoXCIuL25vZGVCaW5kaW5nXCIpO1xyXG52YXIgQXJyYXlCaW5kaW5nID0gcmVxdWlyZShcIi4vYXJyYXlCaW5kaW5nXCIpO1xyXG52YXIgRXZlbnRhYmxlID0gcmVxdWlyZShcImRyb29weS1ldmVudHNcIik7XHJcblxyXG52YXIgRHJvb3B5QmluZGluZyA9IGZ1bmN0aW9uKGNvbnRhaW5lcklkLCBtb2RlbCwgb3B0aW9ucykge1xyXG5cdG9wdGlvbnMgPSBvcHRpb25zIHx8IHt9O1xyXG5cdHRoaXMubW9kZWwgPSBtb2RlbDtcclxuXHR0aGlzLmNvbnRhaW5lciA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKGNvbnRhaW5lcklkKTtcclxuXHR0aGlzLm9ic2VydmVBcnJheUl0ZW1zID0gb3B0aW9ucy5vYnNlcnZlQXJyYXlJdGVtcyB8fCBmYWxzZTtcclxuXHQvL0dldCBhbGwgYmluZGluZ3NcclxuXHR0aGlzLmJpbmRpbmdzID0gdGhpcy5nZXRCaW5kaW5ncyh0aGlzLmNvbnRhaW5lcik7XHJcblx0RXZlbnRhYmxlLmNhbGwodGhpcyk7XHJcblxyXG5cdGlmIChvcHRpb25zLnNob3VsZEluaXQgIT09IGZhbHNlKSB7XHJcblx0XHR0aGlzLmluaXQoKTtcclxuXHR9XHJcbn07XHJcblxyXG5Ecm9vcHlCaW5kaW5nLnByb3RvdHlwZSA9IG5ldyBFdmVudGFibGUoKTtcclxuRHJvb3B5QmluZGluZy5wcm90b3R5cGUuaW5pdCA9IGZ1bmN0aW9uKCkge1xyXG5cdHZhciBzZWxmID0gdGhpcztcclxuXHRzZWxmLnVwZGF0ZUJpbmRpbmdzKCk7XHJcblx0c2VsZi5yZWN1cnNpdmVPYnNlcnZlKHNlbGYubW9kZWwsIFwiXCIsIGZ1bmN0aW9uKGNoYW5nZXMsIHByb3BDaGFpbikge1xyXG5cdFx0c2VsZi5oYW5kbGVPYmplY3RDaGFuZ2UoY2hhbmdlcywgcHJvcENoYWluKTtcclxuXHR9KTtcclxufTtcclxuRHJvb3B5QmluZGluZy5wcm90b3R5cGUucmVjdXJzaXZlT2JzZXJ2ZSA9IGZ1bmN0aW9uKG9iaiwgcHJvcENoYWluLCBjYWxsYmFjaykge1xyXG5cdHZhciBzZWxmID0gdGhpcztcclxuXHQvLyBNYWtlIHN1cmUgaXRzIGFuIGFycmF5IG9yIG9iamVjdFxyXG5cdGlmICghQXJyYXkuaXNBcnJheShvYmopICYmIHR5cGVvZiBvYmogIT09IFwib2JqZWN0XCIpIHJldHVybjtcclxuXHJcblx0aWYgKEFycmF5LmlzQXJyYXkob2JqKSkge1xyXG5cdFx0aWYgKGZhbHNlICYmIEFycmF5Lm9ic2VydmUpIHtcclxuXHRcdFx0QXJyYXkub2JzZXJ2ZShvYmosIGZ1bmN0aW9uKGNoYW5nZXMpIHtcclxuXHRcdFx0XHRzZWxmLmhhbmRsZUFycmF5Q2hhbmdlKGNoYW5nZXMsIHByb3BDaGFpbik7XHJcblx0XHRcdH0pO1x0XHRcdFxyXG5cdFx0fSBlbHNlIHtcclxuXHRcdFx0T2JqZWN0Lm9ic2VydmUob2JqLCBmdW5jdGlvbihjaGFuZ2VzKSB7XHJcblx0XHRcdFx0c2VsZi5oYW5kbGVBcnJheUNoYW5nZShjaGFuZ2VzLCBwcm9wQ2hhaW4pO1xyXG5cdFx0XHR9KTtcdFxyXG5cdFx0fVxyXG5cdFx0aWYgKHRoaXMub2JzZXJ2ZUFycmF5SXRlbXMpIHtcclxuXHRcdFx0Ly8gUmVjdXJzaXZlbHkgb2JzZXJ2ZSBhbnkgYXJyYXkgaXRlbXNcclxuXHRcdFx0b2JqLmZvckVhY2goZnVuY3Rpb24oYXJyYXlJdGVtLCBpKXtcclxuXHRcdFx0XHRzZWxmLnJlY3Vyc2l2ZU9ic2VydmUoYXJyYXlJdGVtLCBcIlwiLCBmdW5jdGlvbihjaGFuZ2VzKSB7IFxyXG5cdFx0XHRcdFx0c2VsZi5oYW5kbGVBcnJheUNoYW5nZS5jYWxsKHNlbGYsIGNoYW5nZXMsIHByb3BDaGFpbik7XHJcblx0XHRcdFx0fSk7XHJcblx0XHRcdH0pO1x0XHRcdFxyXG5cdFx0fVxyXG5cdH0gZWxzZSB7XHJcblx0XHRPYmplY3Qub2JzZXJ2ZShvYmosIGZ1bmN0aW9uKGNoYW5nZXMpIHtcclxuXHRcdFx0Y2FsbGJhY2soY2hhbmdlcywgcHJvcENoYWluKTtcclxuXHRcdH0pO1xyXG5cdFx0XHJcblx0XHQvLyBSZWN1cnNpdmVseSBvYnNlcnZlIGFueSBjaGlsZCBvYmplY3RzXHJcblx0XHRPYmplY3Qua2V5cyhvYmopLmZvckVhY2goZnVuY3Rpb24ocHJvcE5hbWUpIHtcclxuXHRcdFx0dmFyIG5ld1Byb3BDaGFpbiA9IHByb3BDaGFpbjtcclxuXHRcdFx0aWYgKG5ld1Byb3BDaGFpbikge1xyXG5cdFx0XHRcdG5ld1Byb3BDaGFpbiArPSBcIi5cIiArIHByb3BOYW1lO1xyXG5cdFx0XHR9IGVsc2Uge1xyXG5cdFx0XHRcdG5ld1Byb3BDaGFpbiA9IHByb3BOYW1lO1xyXG5cdFx0XHR9XHJcblx0XHRcdHNlbGYucmVjdXJzaXZlT2JzZXJ2ZShvYmpbcHJvcE5hbWVdLCBuZXdQcm9wQ2hhaW4sIGNhbGxiYWNrKTtcclxuXHRcdH0pO1xyXG5cdH1cclxuXHRcclxufTtcclxuXHJcbkRyb29weUJpbmRpbmcucHJvdG90eXBlLmhhbmRsZUFycmF5Q2hhbmdlID0gZnVuY3Rpb24oY2hhbmdlcywgcHJvcENoYWluKSB7XHJcblx0dmFyIHNlbGYgPSB0aGlzO1xyXG5cdHZhciBjb3VudCA9IDA7XHJcblx0Ly8gUmUtb2JzZXJ2ZSBhbnkgbmV3IG9iamVjdHNcclxuXHRjaGFuZ2VzLmZvckVhY2goZnVuY3Rpb24oY2hhbmdlKXtcclxuXHRcdGNvdW50Kys7XHJcblx0XHQvL0lmIGl0cyBhbiBhcnJheSBjaGFuZ2UsIGFuZCBhbiB1cGRhdGUsIGl0cyBhIG5ldyBpbmRleCBhc3NpZ25tZW50IHNvIHJlLW9ic2VydmVcclxuXHRcdGlmIChBcnJheS5pc0FycmF5KGNoYW5nZS5vYmplY3QpICYmIGNoYW5nZS50eXBlID09PSBcInVwZGF0ZVwiKSB7XHJcblx0XHRcdHNlbGYucmVjdXJzaXZlT2JzZXJ2ZShjaGFuZ2Uub2JqZWN0W2NoYW5nZS5uYW1lXSwgXCJcIiwgZnVuY3Rpb24oY2hhbmdlcykgeyBcclxuXHRcdFx0XHRzZWxmLmhhbmRsZUFycmF5Q2hhbmdlLmNhbGwoc2VsZiwgY2hhbmdlcywgcHJvcENoYWluKTtcclxuXHRcdFx0fSk7XHJcblx0XHR9IFxyXG5cdFx0Ly8gSWYgaXRzIGEgcHVzaCBvciBhIHBvcCBpdCB3aWxsIGNvbWUgdGhyb3VnaCBhcyBzcGxpY2VcclxuXHRcdGVsc2UgaWYgKEFycmF5LmlzQXJyYXkoY2hhbmdlLm9iamVjdCkgJiYgY2hhbmdlLnR5cGUgPT09IFwic3BsaWNlXCIpIHtcclxuXHRcdFx0Ly8gSWYgaXRzIGEgcHVzaCwgYWRkZWRDb3VudCB3aWxsIGJlIDFcclxuXHRcdFx0aWYgKGNoYW5nZS5hZGRlZENvdW50ID4gMCkge1xyXG5cdFx0XHRcdC8vIHN0YXJ0IG9ic2VydmluZyB0aGUgbmV3IGFycmF5IGl0ZW1cclxuXHRcdFx0XHRzZWxmLnJlY3Vyc2l2ZU9ic2VydmUoY2hhbmdlLm9iamVjdFtjaGFuZ2UuaW5kZXhdLCBcIlwiLCBmdW5jdGlvbihjaGFuZ2VzKSB7IFxyXG5cdFx0XHRcdFx0c2VsZi5oYW5kbGVBcnJheUNoYW5nZS5jYWxsKHNlbGYsIGNoYW5nZXMsIHByb3BDaGFpbik7XHJcblx0XHRcdFx0fSk7XHJcblx0XHRcdH1cclxuXHRcdFx0Ly8gSWYgaXRzIGEgcG9wIHdlIHJlYWxseSBkb24ndCBjYXJlIGhlcmUgYmVjYXVzZSB0aGVyZSBpcyBub3RoaW5nIHRvIHJlLW9ic2VydmVcclxuXHRcdH1cclxuXHR9KTtcclxuXHQvLyBSZXJlbmRlciBkYXRhLWVhY2ggYmluZGluZ3MgdGhhdCBhcmUgdGllZCB0byB0aGUgYXJyYXlcclxuXHRzZWxmLmJpbmRpbmdzLmZvckVhY2goZnVuY3Rpb24oYmluZGluZykge1xyXG5cdFx0aWYgKGJpbmRpbmcuZnVsbFByb3BlcnR5ID09PSBwcm9wQ2hhaW4pIHtcclxuXHRcdFx0YmluZGluZy51cGRhdGUoc2VsZi5tb2RlbCk7XHJcblx0XHR9XHJcblx0fSk7XHJcbn07XHJcblxyXG52YXIgX2ZpbmRCaW5kaW5ncyA9IGZ1bmN0aW9uKGJpbmRpbmdzLCBwcm9wZXJ0eSkge1xyXG5cdHJldHVybiBiaW5kaW5ncy5maWx0ZXIoZnVuY3Rpb24oYmluZGluZykge1xyXG5cdFx0cmV0dXJuIChiaW5kaW5nLmZ1bGxQcm9wZXJ0eS5pbmRleE9mKHByb3BlcnR5KSA9PT0gMClcclxuXHR9KTtcclxufTtcclxuXHJcbkRyb29weUJpbmRpbmcucHJvdG90eXBlLmhhbmRsZU9iamVjdENoYW5nZSA9IGZ1bmN0aW9uKGNoYW5nZXMsIHByb3BDaGFpbikge1xyXG5cdHZhciBzZWxmID0gdGhpcztcclxuXHRjaGFuZ2VzLmZvckVhY2goZnVuY3Rpb24oY2hhbmdlKSB7XHJcblx0XHQvLyBHZXQgdGhlIHByb3BlcnR5IGNoYWluIHN0cmluZyB0byB0aWUgYmFjayB0byBVSSBwbGFjZWhvbGRlclxyXG5cdFx0dmFyIGNoYW5nZWRQcm9wID0gY2hhbmdlLm5hbWU7XHJcblx0XHRpZiAocHJvcENoYWluKSB7XHJcblx0XHRcdGNoYW5nZWRQcm9wID0gcHJvcENoYWluICsgXCIuXCIgKyBjaGFuZ2UubmFtZTtcclxuXHRcdH1cclxuXHJcblx0XHQvLyBDaGVjayBlYWNoIGJpbmRpbmcgdG8gc2VlIGlmIGl0IGNhcmVzLCB1cGRhdGUgaWYgaXQgZG9lc1xyXG5cdFx0X2ZpbmRCaW5kaW5ncyhzZWxmLmJpbmRpbmdzLCBjaGFuZ2VkUHJvcCkuZm9yRWFjaChmdW5jdGlvbihiaW5kaW5nKXtcclxuXHRcdFx0YmluZGluZy51cGRhdGUoc2VsZi5tb2RlbCk7XHJcblx0XHR9KTtcclxuXHJcblx0XHQvLyBJZiBvYmplY3QgZ2V0cyBvdmVyd3JpdHRlbiwgbmVlZCB0byByZS1vYnNlcnZlIGl0XHJcblx0XHRpZiAoY2hhbmdlLnR5cGUgPT09IFwidXBkYXRlXCIpIHtcclxuXHRcdFx0c2VsZi5yZWN1cnNpdmVPYnNlcnZlKGNoYW5nZS5vYmplY3RbY2hhbmdlLm5hbWVdLCBjaGFuZ2VkUHJvcCwgZnVuY3Rpb24oY2hhbmdlcywgcHJvcENoYWluKSB7XHJcblx0XHRcdFx0c2VsZi5oYW5kbGVPYmplY3RDaGFuZ2UoY2hhbmdlcywgcHJvcENoYWluKTtcclxuXHRcdFx0fSk7XHJcblx0XHR9XHJcblx0fSk7XHJcbn07XHJcblxyXG5Ecm9vcHlCaW5kaW5nLnByb3RvdHlwZS51cGRhdGVCaW5kaW5ncyA9IGZ1bmN0aW9uKCkge1xyXG5cdHZhciBzZWxmID0gdGhpcztcclxuXHRzZWxmLmJpbmRpbmdzLmZvckVhY2goZnVuY3Rpb24oYmluZGluZykge1xyXG5cdFx0YmluZGluZy51cGRhdGUoc2VsZi5tb2RlbCk7XHJcblx0fSk7XHJcbn07XHJcblxyXG5Ecm9vcHlCaW5kaW5nLnByb3RvdHlwZS51cGRhdGVNb2RlbFByb3BlcnR5ID0gZnVuY3Rpb24oZnVsbFByb3BlcnR5LCBuZXdWYWx1ZSkge1xyXG5cdC8vc3RhcnQgd2l0aCB0aGUgbW9kZWxcclxuXHR2YXIgcHJvcGVydHlDaGFpbiA9IGZ1bGxQcm9wZXJ0eS5zcGxpdCgnLicpO1xyXG5cdHZhciBwYXJlbnRPYmogPSB0aGlzLm1vZGVsO1xyXG5cdHZhciBwcm9wZXJ0eSA9IGZ1bGxQcm9wZXJ0eTtcclxuXHQvL3RyYXZlcnNlIHRoZSBwcm9wZXJ0eSBjaGFpbiwgZXhjZXB0IGZvciBsYXN0IG9uZVxyXG5cdGZvciAodmFyIGkgPSAwOyBpIDwgcHJvcGVydHlDaGFpbi5sZW5ndGggLSAxOyBpKyspIHtcclxuXHRcdGlmIChwYXJlbnRPYmpbcHJvcGVydHlDaGFpbltpXV0gIT0gbnVsbCkge1xyXG5cdFx0XHRwcm9wZXJ0eSA9IHByb3BlcnR5Q2hhaW5baV07XHJcblx0XHRcdHBhcmVudE9iaiA9IHBhcmVudE9ialtwcm9wZXJ0eV07XHJcblx0XHR9IFxyXG5cdH1cclxuXHQvL2lmIGl0cyBhbiB1bmRlcnNjb3JlLCBpdHMgcmVmZXJlbmNpbmcgdGhlIG1vZGVsIHNjb3BlXHJcblx0aWYoZnVsbFByb3BlcnR5ID09PSBcIl9cIikge1xyXG5cdFx0cGFyZW50T2JqID0gbmV3VmFsdWU7XHJcblx0fSBlbHNlIHtcclxuXHRcdHByb3BlcnR5ID0gcHJvcGVydHlDaGFpbltwcm9wZXJ0eUNoYWluLmxlbmd0aCAtIDFdO1xyXG5cdFx0cGFyZW50T2JqW3Byb3BlcnR5XSA9IG5ld1ZhbHVlO1xyXG5cdH1cclxufTtcclxuXHJcbkRyb29weUJpbmRpbmcucHJvdG90eXBlLnVwZGF0ZU1vZGVsID0gZnVuY3Rpb24obmV3TW9kZWwpIHtcclxuXHR0aGlzLm1vZGVsID0gbmV3TW9kZWw7XHJcblx0dGhpcy5pbml0KCk7XHJcbn07XHJcblxyXG5Ecm9vcHlCaW5kaW5nLnByb3RvdHlwZS5iaW5kRXZlbnRzID0gZnVuY3Rpb24obm9kZUJpbmRpbmcpIHtcclxuXHR2YXIgc2VsZiA9IHRoaXM7XHJcblx0bm9kZUJpbmRpbmcub24oXCJpbnB1dC1jaGFuZ2VcIiwgc2VsZi51cGRhdGVNb2RlbFByb3BlcnR5LmJpbmQoc2VsZikpO1xyXG5cdG5vZGVCaW5kaW5nLm9uKFwidXBkYXRpbmdcIiwgZnVuY3Rpb24oZnVsbFByb3BlcnR5KSB7XHJcblx0XHRzZWxmLmJyb2FkY2FzdChcInVwZGF0aW5nXCIsIGZ1bGxQcm9wZXJ0eSk7XHJcblx0fSk7XHJcblx0bm9kZUJpbmRpbmcub24oXCJ1cGRhdGVkXCIsIGZ1bmN0aW9uKGZ1bGxQcm9wZXJ0eSkge1xyXG5cdFx0c2VsZi5icm9hZGNhc3QoXCJ1cGRhdGVkXCIsIGZ1bGxQcm9wZXJ0eSk7XHJcblx0fSk7XHJcbn07XHJcblxyXG5Ecm9vcHlCaW5kaW5nLnByb3RvdHlwZS5icm9hZGNhc3QgPSBmdW5jdGlvbihldmVudCwgZnVsbFByb3BlcnR5KSB7XHJcblx0dmFyIHByb3BlcnRpZXMgPSBmdWxsUHJvcGVydHkuc3BsaXQoXCIuXCIpO1xyXG5cdHZhciBwcm9wQ2hhaW4gPSBcIlwiO1xyXG5cdGZvcih2YXIgaSA9IDA7IGkgPCBwcm9wZXJ0aWVzLmxlbmd0aDsgaSsrKSB7XHJcblx0XHRwcm9wQ2hhaW4gPSBwcm9wQ2hhaW4gKyBwcm9wZXJ0aWVzW2ldO1xyXG5cdFx0dGhpcy50cmlnZ2VyKGV2ZW50ICsgXCItXCIgKyBwcm9wQ2hhaW4pO1xyXG5cdFx0cHJvcENoYWluICs9IFwiLlwiO1xyXG5cdH1cclxufTtcclxuRHJvb3B5QmluZGluZy5wcm90b3R5cGUuZ2V0QmluZGluZ3MgPSBmdW5jdGlvbihlbGVtZW50KSB7XHJcblx0dmFyIHNlbGYgPSB0aGlzO1xyXG5cdHZhciBiaW5kaW5ncyA9IFtdO1xyXG5cdHZhciBwbGFjZWhvbGRlcnMgPSBbXTtcclxuXHR2YXIgaSA9IDA7XHJcblx0Ly8gMS4gTG9vayBmb3IgYXR0cmlidXRlIGJpbmRpbmdzIGFuZCBhcnJheSBiaW5kaW5ncyBvbiB0aGUgY3VycmVudCBlbGVtZW50XHJcblx0aWYgKGVsZW1lbnQuYXR0cmlidXRlcykge1xyXG5cdFx0Zm9yIChpID0gMDsgaSA8IGVsZW1lbnQuYXR0cmlidXRlcy5sZW5ndGg7IGkrKykge1xyXG5cdFx0XHRpZiAoZWxlbWVudC5hdHRyaWJ1dGVzW2ldLm5vZGVOYW1lID09PSBcImRhdGEtZWFjaFwiKSB7XHJcblx0XHRcdFx0YmluZGluZ3MucHVzaChuZXcgQXJyYXlCaW5kaW5nKGVsZW1lbnQsIGVsZW1lbnQuYXR0cmlidXRlc1tpXS5ub2RlVmFsdWUpKTtcclxuXHRcdFx0fSBlbHNlIHtcclxuXHRcdFx0XHR2YXIgYXR0cmlidXRlQmluZGluZ3MgPSB0ZW1wbGF0aW5nLmdldFBsYWNlSG9sZGVycyhlbGVtZW50LmF0dHJpYnV0ZXNbaV0ubm9kZVZhbHVlKVxyXG5cdFx0XHRcdFx0Lm1hcChmdW5jdGlvbihwbGFjZWhvbGRlcikge1xyXG5cdFx0XHRcdFx0XHR2YXIgYmluZGluZyA9IG5ldyBOb2RlQmluZGluZyhlbGVtZW50LmF0dHJpYnV0ZXNbaV0sIHBsYWNlaG9sZGVyLCBlbGVtZW50KTtcclxuXHRcdFx0XHRcdFx0c2VsZi5iaW5kRXZlbnRzKGJpbmRpbmcpO1xyXG5cdFx0XHRcdFx0XHRyZXR1cm4gYmluZGluZztcclxuXHRcdFx0XHRcdH0pO1xyXG5cdFx0XHRcdGJpbmRpbmdzID0gYmluZGluZ3MuY29uY2F0KGF0dHJpYnV0ZUJpbmRpbmdzKTtcdFx0XHRcdFxyXG5cdFx0XHR9XHJcblx0XHR9XHJcblx0fVxyXG5cdC8vIDIuYSBJZiB0aGUgZWxlbWVudCBoYXMgY2hpbGRyZW4sIGl0IHdvbid0IGhhdmUgYSB0ZXh0IGJpbmRpbmcuIFJlY3Vyc2Ugb24gY2hpbGRyZW5cclxuXHRpZiAoZWxlbWVudC5jaGlsZE5vZGVzICYmIGVsZW1lbnQuY2hpbGROb2Rlcy5sZW5ndGgpIHtcclxuXHRcdC8vcmVjdXJzaXZlIGNhbGwgZm9yIGVhY2ggY2hpbGRub2RlXHJcblx0XHRmb3IgKGkgPSAwOyBpIDwgZWxlbWVudC5jaGlsZE5vZGVzLmxlbmd0aDsgaSsrKSB7XHJcblx0XHRcdGJpbmRpbmdzID0gYmluZGluZ3MuY29uY2F0KHNlbGYuZ2V0QmluZGluZ3MoZWxlbWVudC5jaGlsZE5vZGVzW2ldKSk7XHJcblx0XHR9XHJcblx0fSBlbHNlIHtcclxuXHRcdC8vIDIuYiBUaGUgZWxlbWVudCBkb2Vzbid0IGhhdmUgY2hpbGRyZW4gc28gbG9vayBmb3IgYSB0ZXh0IGJpbmRpbmdcclxuXHRcdHBsYWNlaG9sZGVycyA9IHRlbXBsYXRpbmcuZ2V0UGxhY2VIb2xkZXJzKGVsZW1lbnQudGV4dENvbnRlbnQpO1xyXG5cdFx0dmFyIHRleHRCaW5kaW5ncyA9IHBsYWNlaG9sZGVycy5tYXAoZnVuY3Rpb24ocGxhY2Vob2xkZXIpIHtcclxuXHRcdFx0dmFyIGJpbmRpbmcgPSBuZXcgTm9kZUJpbmRpbmcoZWxlbWVudCwgcGxhY2Vob2xkZXIsIGVsZW1lbnQucGFyZW50Tm9kZSk7XHJcblx0XHRcdHNlbGYuYmluZEV2ZW50cyhiaW5kaW5nKTtcclxuXHRcdFx0cmV0dXJuIGJpbmRpbmc7XHJcblx0XHR9KTtcclxuXHRcdGJpbmRpbmdzID0gYmluZGluZ3MuY29uY2F0KHRleHRCaW5kaW5ncyk7XHJcblx0fVxyXG5cdHJldHVybiBiaW5kaW5ncztcclxufTtcclxuXHJcbkRyb29weUJpbmRpbmcucHJvdG90eXBlLnN1YnNjcmliZSA9IGZ1bmN0aW9uKGV2ZW50LCBwcm9wZXJ0eSwgY2FsbGJhY2spIHtcclxuXHR0aGlzLm9uKGV2ZW50ICsgXCItXCIgKyBwcm9wZXJ0eSwgY2FsbGJhY2spO1xyXG59O1xyXG5cclxuXHJcblxyXG5tb2R1bGUuZXhwb3J0cyA9IERyb29weUJpbmRpbmc7IiwidmFyIHRlbXBsYXRpbmcgPSByZXF1aXJlKFwiZHJvb3B5LXRlbXBsYXRpbmdcIik7XHJcbnZhciBFdmVudGFibGUgPSByZXF1aXJlKFwiZHJvb3B5LWV2ZW50c1wiKTtcclxuXHJcbnZhciBOb2RlQmluZGluZyA9IGZ1bmN0aW9uKG5vZGUsIHBsYWNlaG9sZGVyLCBlbGVtZW50KSB7XHJcblx0RXZlbnRhYmxlLmNhbGwodGhpcyk7XHJcblx0dGhpcy5ub2RlID0gbm9kZTtcclxuXHR0aGlzLm9yaWdpbmFsID0gbm9kZS5ub2RlVmFsdWU7XHJcblx0dGhpcy5yYXcgPSBwbGFjZWhvbGRlcjtcclxuXHR0aGlzLmZ1bGxQcm9wZXJ0eSA9IHRoaXMucmF3LnNsaWNlKDIsIHRoaXMucmF3Lmxlbmd0aCAtIDIpO1xyXG5cdC8vaWYgbm8gZWxlbWVudCB3YXMgcGFzc2VkIGluLCBpdCBpcyBhIHRleHQgYmluZGluZywgb3RoZXJ3aXNlIGF0dHJpYnV0ZVxyXG5cdHRoaXMuZWxlbWVudCA9IGVsZW1lbnQgfHwgbm9kZTsgXHJcblx0dGhpcy5zZXR1cFR3b1dheSgpO1xyXG59O1xyXG5cclxuTm9kZUJpbmRpbmcucHJvdG90eXBlID0gbmV3IEV2ZW50YWJsZSgpO1xyXG5cclxuTm9kZUJpbmRpbmcucHJvdG90eXBlLnNldHVwVHdvV2F5ID0gZnVuY3Rpb24oKSB7XHJcblx0dmFyIHNlbGYgPSB0aGlzO1xyXG5cdGlmICh0aGlzLmVsZW1lbnQgJiYgdGhpcy5lbGVtZW50LnRhZ05hbWUpIHtcclxuXHRcdHZhciBlbGVtZW50VHlwZSA9IHRoaXMuZWxlbWVudC50YWdOYW1lLnRvTG93ZXJDYXNlKCk7XHJcblx0XHQvLyBURVhUIEFSRUFcclxuXHRcdGlmIChlbGVtZW50VHlwZSA9PT0gXCJ0ZXh0YXJlYVwiKSB7XHJcblx0XHRcdHRoaXMuZWxlbWVudC5hZGRFdmVudExpc3RlbmVyKFwiaW5wdXRcIiwgdGhpcy5vbklucHV0Q2hhbmdlLmJpbmQodGhpcykpO1xyXG5cclxuXHRcdH0gZWxzZSBpZiAodGhpcy5ub2RlLm5vZGVOYW1lID09PSBcInZhbHVlXCIpIHtcclxuXHRcdFx0Ly8gSU5QVVQgZWxlbWVudFxyXG5cdFx0XHRpZiAoZWxlbWVudFR5cGUgPT09IFwiaW5wdXRcIikge1xyXG5cdFx0XHRcdHRoaXMuZWxlbWVudC5hZGRFdmVudExpc3RlbmVyKFwiaW5wdXRcIiwgdGhpcy5vbklucHV0Q2hhbmdlLmJpbmQodGhpcykpO1xyXG5cdFx0XHRcdHRoaXMuZWxlbWVudC5hZGRFdmVudExpc3RlbmVyKFwiY2hhbmdlXCIsIHRoaXMub25JbnB1dENoYW5nZS5iaW5kKHRoaXMpKTtcclxuXHRcdFx0fSBcclxuXHRcdFx0Ly8gU0VMRUNUIGVsZW1lbnRcclxuXHRcdFx0ZWxzZSBpZiAoZWxlbWVudFR5cGUgPT09IFwic2VsZWN0XCIpIHtcclxuXHRcdFx0XHR0aGlzLmVsZW1lbnQuYWRkRXZlbnRMaXN0ZW5lcihcImNoYW5nZVwiLCB0aGlzLm9uSW5wdXRDaGFuZ2UuYmluZCh0aGlzKSk7XHJcblx0XHRcdFx0c2V0VGltZW91dCh0aGlzLm9uSW5wdXRDaGFuZ2UuYmluZCh0aGlzKSwgMSk7XHJcblx0XHRcdH1cclxuXHRcdH1cclxuXHR9XHJcbn07XHJcblxyXG5Ob2RlQmluZGluZy5wcm90b3R5cGUub25JbnB1dENoYW5nZSA9IGZ1bmN0aW9uKCkge1xyXG5cdC8vY2FsbGVkIHdpdGggYmluZCwgc28gJ3RoaXMnIGlzIGFjdHVhbGx5IHRoaXNcclxuXHR0aGlzLnRyaWdnZXIoXCJpbnB1dC1jaGFuZ2VcIiwgdGhpcy5mdWxsUHJvcGVydHksIHRoaXMuZWxlbWVudC52YWx1ZSApO1xyXG59O1xyXG5cclxuTm9kZUJpbmRpbmcucHJvdG90eXBlLnVwZGF0ZSA9IGZ1bmN0aW9uKG1vZGVsKSB7XHJcblx0dmFyIHNlbGYgPSB0aGlzO1xyXG5cdHNlbGYudHJpZ2dlcihcInVwZGF0aW5nXCIsIHNlbGYuZnVsbFByb3BlcnR5KTtcclxuXHQvL3NraXAgYSB0aWNrIGluIGV2ZW50IGxvb3AgdG8gbGV0ICd1cGRhdGluZycgYmUgaGFuZGxlZCBiZWZvcmUgdXBkYXRlXHJcblx0XHR2YXIgaHRtbCA9IHRlbXBsYXRpbmcucmVuZGVyVGVtcGxhdGUoc2VsZi5vcmlnaW5hbCwgbW9kZWwpO1xyXG5cdFx0c2VsZi5ub2RlLm5vZGVWYWx1ZSA9IGh0bWw7XHJcblx0XHRpZiAoc2VsZi5ub2RlLm5vZGVOYW1lID09PSBcInZhbHVlXCIgJiYgc2VsZi5lbGVtZW50KSB7XHJcblx0XHRcdGlmIChzZWxmLmVsZW1lbnQudmFsdWUgIT09IGh0bWwpIHtcclxuXHRcdFx0XHRzZWxmLmVsZW1lbnQudmFsdWUgPSBodG1sO1xyXG5cdFx0XHR9XHJcblx0XHR9XHJcblx0XHRzZWxmLnRyaWdnZXIoXCJ1cGRhdGVkXCIsIHNlbGYuZnVsbFByb3BlcnR5KTtcdFx0XHJcbn07XHJcblxyXG5tb2R1bGUuZXhwb3J0cyA9IE5vZGVCaW5kaW5nOyJdfQ==
