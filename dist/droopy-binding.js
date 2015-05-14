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
			var binding = new NodeBinding(element, placeholder, element.parentNode);
			binding.on("input-change", self.updateModelProperty.bind(self));
			return binding;
		});
		bindings = bindings.concat(textBindings);
	}
	return bindings;
};

DroopyBinding.prototype.subscribe = function(event, property, callback) {
	var matches = _findBindings(this.bindings, property);
	//There could be many bindings for the same property, we only want to surface one event though
	if (matches && matches.length) {
		matches[0].on(event, callback);
	}
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
	self.trigger("updating");
	//skip a tick in event loop to let 'updating' be handled before update
	setTimeout(function() {
		var html = templating.renderTemplate(self.original, model);
		self.node.nodeValue = html;
		if (self.node.nodeName === "value" && self.element) {
			self.element.value = html;
		}
		self.trigger("updated");		
	},1);
};

module.exports = NodeBinding;
},{"droopy-events":2,"droopy-templating":3}]},{},[1])
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIkM6XFxnaXR3aXBcXGRyb29weS1iaW5kaW5nXFxub2RlX21vZHVsZXNcXGd1bHAtYnJvd3NlcmlmeVxcbm9kZV9tb2R1bGVzXFxicm93c2VyaWZ5XFxub2RlX21vZHVsZXNcXGJyb3dzZXItcGFja1xcX3ByZWx1ZGUuanMiLCJDOi9naXR3aXAvZHJvb3B5LWJpbmRpbmcvZW50cmllcy9mYWtlX2U5M2UzZTI5LmpzIiwiQzovZ2l0d2lwL2Ryb29weS1iaW5kaW5nL25vZGVfbW9kdWxlcy9kcm9vcHktZXZlbnRzL0V2ZW50QWdncmVnYXRvci5qcyIsIkM6L2dpdHdpcC9kcm9vcHktYmluZGluZy9ub2RlX21vZHVsZXMvZHJvb3B5LXRlbXBsYXRpbmcvZHJvb3B5LXRlbXBsYXRpbmcuanMiLCJDOi9naXR3aXAvZHJvb3B5LWJpbmRpbmcvc3JjL2FycmF5QmluZGluZy5qcyIsIkM6L2dpdHdpcC9kcm9vcHktYmluZGluZy9zcmMvZHJvb3B5QmluZGluZy5qcyIsIkM6L2dpdHdpcC9kcm9vcHktYmluZGluZy9zcmMvbm9kZUJpbmRpbmcuanMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7QUNBQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ0pBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDdEVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2hHQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNyQkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNoTkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSIsImZpbGUiOiJnZW5lcmF0ZWQuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlc0NvbnRlbnQiOlsiKGZ1bmN0aW9uIGUodCxuLHIpe2Z1bmN0aW9uIHMobyx1KXtpZighbltvXSl7aWYoIXRbb10pe3ZhciBhPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7aWYoIXUmJmEpcmV0dXJuIGEobywhMCk7aWYoaSlyZXR1cm4gaShvLCEwKTt0aHJvdyBuZXcgRXJyb3IoXCJDYW5ub3QgZmluZCBtb2R1bGUgJ1wiK28rXCInXCIpfXZhciBmPW5bb109e2V4cG9ydHM6e319O3Rbb11bMF0uY2FsbChmLmV4cG9ydHMsZnVuY3Rpb24oZSl7dmFyIG49dFtvXVsxXVtlXTtyZXR1cm4gcyhuP246ZSl9LGYsZi5leHBvcnRzLGUsdCxuLHIpfXJldHVybiBuW29dLmV4cG9ydHN9dmFyIGk9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtmb3IodmFyIG89MDtvPHIubGVuZ3RoO28rKylzKHJbb10pO3JldHVybiBzfSkiLCIoZnVuY3Rpb24gKGdsb2JhbCl7XG5nbG9iYWwuZHJvb3B5QmluZGluZyA9IHt9O1xyXG5nbG9iYWwuRHJvb3B5QmluZGluZyA9IHJlcXVpcmUoXCIuLi9zcmMvZHJvb3B5QmluZGluZ1wiKTtcclxuZXhwb3J0cy5Ecm9vcHlCaW5kaW5nID0gZ2xvYmFsLkRyb29weUJpbmRpbmc7XG59KS5jYWxsKHRoaXMsdHlwZW9mIHNlbGYgIT09IFwidW5kZWZpbmVkXCIgPyBzZWxmIDogdHlwZW9mIHdpbmRvdyAhPT0gXCJ1bmRlZmluZWRcIiA/IHdpbmRvdyA6IHt9KSIsInZhciBFdmVudEFnZ3JlZ2F0b3IgPSBmdW5jdGlvbigpIHtcclxuXHR0aGlzLmV2ZW50S2V5cyA9IHt9O1xyXG5cdHRoaXMubGFzdFN1YnNjcmlwdGlvbklkID0gLTE7XHJcbn07XHJcblxyXG5FdmVudEFnZ3JlZ2F0b3IucHJvdG90eXBlLm9uID0gZnVuY3Rpb24oa2V5LCBjYWxsYmFjaykge1xyXG5cdGlmICh0eXBlb2YgY2FsbGJhY2sgPT09IFwiZnVuY3Rpb25cIikge1xyXG5cdFx0aWYgKCF0aGlzLmV2ZW50S2V5c1trZXldKSB7XHJcblx0XHRcdHRoaXMuZXZlbnRLZXlzW2tleV0gPSB7XHJcblx0XHRcdFx0c3Vic2NyaXB0aW9uczoge31cclxuXHRcdFx0fTtcclxuXHRcdH1cclxuXHRcdHZhciB0b2tlbiA9ICgrK3RoaXMubGFzdFN1YnNjcmlwdGlvbklkKS50b1N0cmluZygpO1xyXG5cdFx0dGhpcy5ldmVudEtleXNba2V5XS5zdWJzY3JpcHRpb25zW3Rva2VuXSA9IGNhbGxiYWNrO1xyXG5cdFx0cmV0dXJuIHRva2VuO1xyXG5cdH0gZWxzZSB7XHJcblx0XHRyZXR1cm4gZmFsc2U7XHJcblx0fVxyXG59O1xyXG5cclxuRXZlbnRBZ2dyZWdhdG9yLnByb3RvdHlwZS5vZmYgPSBmdW5jdGlvbihrZXksIHRva2VuT3JDYWxsYmFjaykge1xyXG5cdGlmICh0eXBlb2YgdG9rZW5PckNhbGxiYWNrID09PSAnZnVuY3Rpb24nKSB7XHJcblx0XHQvL0NhbGxiYWNrIHJlZmVyZW5jZSB3YXMgcGFzc2VkIGluIHNvIGZpbmQgdGhlIHN1YnNjcmlwdGlvbiB3aXRoIHRoZSBtYXRjaGluZyBmdW5jdGlvblxyXG5cdFx0aWYgKHRoaXMuZXZlbnRLZXlzW2tleV0pIHtcclxuXHRcdFx0dmFyIGV2ZW50U3Vic2NyaXB0aW9ucyA9IHRoaXMuZXZlbnRLZXlzW2tleV0uc3Vic2NyaXB0aW9ucztcclxuXHRcdFx0dmFyIG1hdGNoaW5nSWQgPSBudWxsO1xyXG5cdFx0XHQvL2ZvcmVhY2ggc3Vic2NyaXB0aW9uIHNlZSBpZiB0aGUgZnVuY3Rpb25zIG1hdGNoIGFuZCBzYXZlIHRoZSBrZXkgaWYgeWVzXHJcblx0XHRcdGZvciAodmFyIHN1YnNjcmlwdGlvbklkIGluIGV2ZW50U3Vic2NyaXB0aW9ucykge1xyXG5cdFx0XHRcdGlmIChldmVudFN1YnNjcmlwdGlvbnMuaGFzT3duUHJvcGVydHkoc3Vic2NyaXB0aW9uSWQpKSB7XHJcblx0XHRcdFx0XHRpZiAoZXZlbnRTdWJzY3JpcHRpb25zW3N1YnNjcmlwdGlvbklkXSA9PT0gdG9rZW5PckNhbGxiYWNrKSB7XHJcblx0XHRcdFx0XHRcdG1hdGNoaW5nSWQgPSBzdWJzY3JpcHRpb25JZDtcclxuXHRcdFx0XHRcdH1cclxuXHRcdFx0XHR9XHJcblx0XHRcdH1cclxuXHRcdFx0aWYgKG1hdGNoaW5nSWQgIT09IG51bGwpIHtcclxuXHRcdFx0XHRkZWxldGUgZXZlbnRTdWJzY3JpcHRpb25zW21hdGNoaW5nSWRdO1xyXG5cdFx0XHR9XHJcblx0XHR9XHJcblx0fSBlbHNlIHtcclxuXHRcdC8vVG9rZW4gd2FzIHBhc3NlZCBpblxyXG5cdFx0aWYgKHRoaXMuZXZlbnRLZXlzW2tleV0gJiYgdGhpcy5ldmVudEtleXNba2V5XS5zdWJzY3JpcHRpb25zW3Rva2VuT3JDYWxsYmFja10pIHtcclxuXHRcdFx0ZGVsZXRlIHRoaXMuZXZlbnRLZXlzW2tleV0uc3Vic2NyaXB0aW9uc1t0b2tlbk9yQ2FsbGJhY2tdO1xyXG5cdFx0fVxyXG5cdH1cclxufTtcclxuXHJcbkV2ZW50QWdncmVnYXRvci5wcm90b3R5cGUudHJpZ2dlciA9IGZ1bmN0aW9uKGtleSkge1xyXG5cdHZhciBzZWxmID0gdGhpcztcclxuXHRpZiAoc2VsZi5ldmVudEtleXNba2V5XSkge1xyXG5cdFx0dmFyIHZhbHVlcyA9IEFycmF5LnByb3RvdHlwZS5zbGljZS5jYWxsKGFyZ3VtZW50cywgMSk7XHJcblx0XHQvL0lmIHBhc3NpbmcgbGVzcyB0aGFuIHZhbHVlcyBwYXNzIHRoZW0gaW5kaXZpZHVhbGx5XHJcblx0XHR2YXIgYTEgPSB2YWx1ZXNbMF0sXHJcblx0XHRcdGEyID0gdmFsdWVzWzFdLFxyXG5cdFx0XHRhMyA9IHZhbHVlc1syXTtcclxuXHRcdC8vRWxzZSBpZiBwYXNzaW5nIG1vcmUgdGhhbiAzIHZhbHVlcyBncm91cCBhcyBhbiBhcmdzIGFycmF5XHJcblx0XHRpZiAodmFsdWVzLmxlbmd0aCA+IDMpIHtcclxuXHRcdFx0YTEgPSB2YWx1ZXM7XHJcblx0XHR9XHJcblxyXG5cdFx0dmFyIHN1YnNjcmlwdGlvbnMgPSBzZWxmLmV2ZW50S2V5c1trZXldLnN1YnNjcmlwdGlvbnM7XHJcblx0XHRzZXRUaW1lb3V0KGZ1bmN0aW9uKCkge1xyXG5cdFx0XHRmb3IgKHZhciB0b2tlbiBpbiBzdWJzY3JpcHRpb25zKSB7XHJcblx0XHRcdFx0aWYgKHN1YnNjcmlwdGlvbnMuaGFzT3duUHJvcGVydHkodG9rZW4pKSB7XHJcblx0XHRcdFx0XHRzdWJzY3JpcHRpb25zW3Rva2VuXShhMSwgYTIsIGEzKTtcclxuXHRcdFx0XHR9XHJcblx0XHRcdH1cclxuXHRcdH0sIDApO1xyXG5cdH1cclxufTtcclxuXHJcbm1vZHVsZS5leHBvcnRzID0gRXZlbnRBZ2dyZWdhdG9yOyIsInZhciB0ZW1wbGF0aW5nID0ge1xyXG5cclxuXHRQbGFjZWhvbGRlcjogZnVuY3Rpb24ocmF3KSB7XHJcblx0XHR0aGlzLnJhdyA9IHJhdztcclxuXHRcdHRoaXMuZnVsbFByb3BlcnR5ID0gcmF3LnNsaWNlKDIsIHJhdy5sZW5ndGggLSAyKTtcclxuXHR9LFxyXG5cclxuXHRnZXRQbGFjZUhvbGRlcnM6IGZ1bmN0aW9uKHRlbXBsYXRlLCByZWdleHApIHtcclxuXHRcdHZhciByZWdFeHBQYXR0ZXJuID0gcmVnZXhwIHx8IC9cXHtcXHtbXlxcfV0rXFx9XFx9Py9nO1xyXG5cdFx0dmFyIG1hdGNoZXMgPSB0ZW1wbGF0ZS5tYXRjaChyZWdFeHBQYXR0ZXJuKTtcclxuXHRcdHJldHVybiBtYXRjaGVzIHx8IFtdO1xyXG5cdH0sXHJcblxyXG5cdGdldE9iamVjdFZhbHVlOiBmdW5jdGlvbihvYmosIGZ1bGxQcm9wZXJ0eSkge1xyXG5cdFx0dmFyIHZhbHVlID0gb2JqLFxyXG5cdFx0XHRwcm9wZXJ0eUNoYWluID0gZnVsbFByb3BlcnR5LnNwbGl0KCcuJyk7XHJcblxyXG5cdFx0Zm9yICh2YXIgaSA9IDA7IGkgPCBwcm9wZXJ0eUNoYWluLmxlbmd0aDsgaSsrKSB7XHJcblx0XHRcdHZhciBwcm9wZXJ0eSA9IHByb3BlcnR5Q2hhaW5baV07XHJcblx0XHRcdHZhbHVlID0gdmFsdWVbcHJvcGVydHldICE9IG51bGwgPyB2YWx1ZVtwcm9wZXJ0eV0gOiBcIk5vdCBGb3VuZDogXCIgKyBmdWxsUHJvcGVydHk7XHJcblx0XHR9XHJcblxyXG5cdFx0aWYoZnVsbFByb3BlcnR5ID09PSBcIl9cIikge1xyXG5cdFx0XHR2YWx1ZSA9IG9iajtcclxuXHRcdH1cclxuXHRcdFxyXG5cdFx0aWYgKCh0eXBlb2YgdmFsdWUgPT09IFwic3RyaW5nXCIpICYmIHZhbHVlLmluZGV4T2YoXCIvRGF0ZShcIikgIT09IC0xKSB7XHJcblx0XHRcdHZhciBkYXRlVmFsdWUgPSBVVENKc29uVG9EYXRlKHZhbHVlKTtcclxuXHRcdFx0dmFsdWUgPSBkYXRlVmFsdWUudG9Mb2NhbGVEYXRlU3RyaW5nKCk7XHJcblx0XHR9XHJcblxyXG5cdFx0cmV0dXJuIHZhbHVlO1xyXG5cdH0sXHJcblxyXG5cdHBvcHVsYXRlVGVtcGxhdGU6IGZ1bmN0aW9uKHRlbXBsYXRlLCBpdGVtLCByZWdleHApIHtcclxuXHRcdHZhciBwbGFjZWhvbGRlcnMgPSB0aGlzLmdldFBsYWNlSG9sZGVycyh0ZW1wbGF0ZSwgcmVnZXhwKSB8fCBbXSxcclxuXHRcdFx0aXRlbUh0bWwgPSB0ZW1wbGF0ZTtcclxuXHJcblx0XHRmb3IgKHZhciBpID0gMDsgaSA8IHBsYWNlaG9sZGVycy5sZW5ndGg7IGkrKykge1xyXG5cdFx0XHR2YXIgcGxhY2Vob2xkZXIgPSBuZXcgdGhpcy5QbGFjZWhvbGRlcihwbGFjZWhvbGRlcnNbaV0pO1xyXG5cdFx0XHRwbGFjZWhvbGRlci52YWwgPSB0aGlzLmdldE9iamVjdFZhbHVlKGl0ZW0sIHBsYWNlaG9sZGVyLmZ1bGxQcm9wZXJ0eSk7XHJcblx0XHRcdHZhciBwYXR0ZXJuID0gcGxhY2Vob2xkZXIucmF3LnJlcGxhY2UoXCJbXCIsIFwiXFxcXFtcIikucmVwbGFjZShcIl1cIiwgXCJcXFxcXVwiKTtcclxuXHRcdFx0dmFyIG1vZGlmaWVyID0gXCJnXCI7XHJcblx0XHRcdGl0ZW1IdG1sID0gaXRlbUh0bWwucmVwbGFjZShuZXcgUmVnRXhwKHBhdHRlcm4sIG1vZGlmaWVyKSwgcGxhY2Vob2xkZXIudmFsKTtcclxuXHRcdH1cclxuXHRcdHJldHVybiBpdGVtSHRtbDtcclxuXHR9XHJcbn07XHJcblxyXG50ZW1wbGF0aW5nLkVhY2ggPSB7XHJcblxyXG5cdHJlZ0V4cDogL1xce1xcW1teXFxdXStcXF1cXH0/L2csXHJcblxyXG5cdHBvcHVsYXRlRWFjaFRlbXBsYXRlczogZnVuY3Rpb24oaXRlbUh0bWwsIGl0ZW0pIHtcclxuXHRcdHZhciAkaXRlbUh0bWwgPSAkKGl0ZW1IdG1sKSxcclxuXHRcdFx0ZWFjaFRlbXBsYXRlcyA9ICRpdGVtSHRtbC5maW5kKFwiW2RhdGEtZWFjaF1cIik7XHJcblxyXG5cdFx0ZWFjaFRlbXBsYXRlcy5lYWNoKGZ1bmN0aW9uKCkge1xyXG5cdFx0XHR2YXIgYXJyYXlIdG1sID0gXCJcIixcclxuXHRcdFx0XHRpdGVtVGVtcGxhdGUgPSAkKHRoaXMpLmh0bWwoKSxcclxuXHRcdFx0XHRhcnJheVByb3AgPSAkKHRoaXMpLmRhdGEoXCJlYWNoXCIpLFxyXG5cdFx0XHRcdGFycmF5ID0gc3AudGVtcGxhdGluZy5nZXRPYmplY3RWYWx1ZShpdGVtLCBhcnJheVByb3ApO1xyXG5cclxuXHRcdFx0aWYgKGFycmF5ICE9IG51bGwgJiYgJC5pc0FycmF5KGFycmF5KSkge1xyXG5cdFx0XHRcdGZvciAodmFyIGkgPSAwOyBpIDwgYXJyYXkubGVuZ3RoOyBpKyspIHtcclxuXHRcdFx0XHRcdGFycmF5SHRtbCArPSB0ZW1wbGF0aW5nLnBvcHVsYXRlVGVtcGxhdGUoaXRlbVRlbXBsYXRlLCBhcnJheVtpXSwgdGVtcGxhdGluZy5FYWNoLnJlZ0V4cCk7XHJcblx0XHRcdFx0fVxyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHQkaXRlbUh0bWwuZmluZCgkKHRoaXMpKS5odG1sKGFycmF5SHRtbCk7XHJcblx0XHR9KTtcclxuXHJcblx0XHR2YXIgdGVtcCA9ICRpdGVtSHRtbC5jbG9uZSgpLndyYXAoXCI8ZGl2PlwiKTtcclxuXHRcdHJldHVybiB0ZW1wLnBhcmVudCgpLmh0bWwoKTtcclxuXHR9XHJcbn07XHJcblxyXG50ZW1wbGF0aW5nLnJlbmRlclRlbXBsYXRlID0gZnVuY3Rpb24odGVtcGxhdGUsIGl0ZW0sIHJlbmRlckVhY2hUZW1wbGF0ZSkge1xyXG5cdHZhciBpdGVtSHRtbCA9IHRlbXBsYXRpbmcucG9wdWxhdGVUZW1wbGF0ZSh0ZW1wbGF0ZSwgaXRlbSk7XHJcblx0aWYgKHJlbmRlckVhY2hUZW1wbGF0ZSkge1xyXG5cdFx0aXRlbUh0bWwgPSB0ZW1wbGF0aW5nLkVhY2gucG9wdWxhdGVFYWNoVGVtcGxhdGVzKGl0ZW1IdG1sLCBpdGVtKTtcclxuXHR9XHJcblx0cmV0dXJuIGl0ZW1IdG1sO1xyXG59O1xyXG5cclxudmFyIFVUQ0pzb25Ub0RhdGUgPSBmdW5jdGlvbihqc29uRGF0ZSkge1xyXG5cdHZhciB1dGNTdHIgPSBqc29uRGF0ZS5zdWJzdHJpbmcoanNvbkRhdGUuaW5kZXhPZihcIihcIikgKyAxKTtcclxuXHR1dGNTdHIgPSB1dGNTdHIuc3Vic3RyaW5nKDAsIHV0Y1N0ci5pbmRleE9mKFwiKVwiKSk7XHJcblxyXG5cdHZhciByZXR1cm5EYXRlID0gbmV3IERhdGUocGFyc2VJbnQodXRjU3RyLCAxMCkpO1xyXG5cdHZhciBob3VyT2Zmc2V0ID0gcmV0dXJuRGF0ZS5nZXRUaW1lem9uZU9mZnNldCgpIC8gNjA7XHJcblx0cmV0dXJuRGF0ZS5zZXRIb3VycyhyZXR1cm5EYXRlLmdldEhvdXJzKCkgKyBob3VyT2Zmc2V0KTtcclxuXHJcblx0cmV0dXJuIHJldHVybkRhdGU7XHJcbn07XHJcblxyXG5tb2R1bGUuZXhwb3J0cyA9IHRlbXBsYXRpbmc7IiwidmFyIHRlbXBsYXRpbmcgPSByZXF1aXJlKFwiZHJvb3B5LXRlbXBsYXRpbmdcIik7XHJcblxyXG52YXIgQXJyYXlCaW5kaW5nID0gZnVuY3Rpb24oZWxlbWVudCwgZnVsbFByb3BlcnR5KSB7XHJcblx0dGhpcy5lbGVtZW50ID0gZWxlbWVudDtcclxuXHR0aGlzLm9yaWdpbmFsID0gZWxlbWVudC5pbm5lckhUTUw7XHJcblx0dGhpcy5mdWxsUHJvcGVydHkgPSBmdWxsUHJvcGVydHk7XHJcbn07XHJcblxyXG5BcnJheUJpbmRpbmcucHJvdG90eXBlLnVwZGF0ZSA9IGZ1bmN0aW9uKHNjb3BlKSB7XHJcblx0dmFyIHNlbGYgPSB0aGlzO1xyXG5cdHZhciBhcnJheUh0bWwgPSBcIlwiO1xyXG5cdHZhciBhcnJheSA9IHRlbXBsYXRpbmcuZ2V0T2JqZWN0VmFsdWUoc2NvcGUsIHNlbGYuZnVsbFByb3BlcnR5KTtcclxuXHJcblx0aWYgKGFycmF5ICYmIEFycmF5LmlzQXJyYXkoYXJyYXkpKSB7XHJcblx0XHRmb3IgKHZhciBpID0gMDsgaSA8IGFycmF5Lmxlbmd0aDsgaSsrKSB7XHJcblx0XHRcdGFycmF5SHRtbCArPSB0ZW1wbGF0aW5nLnBvcHVsYXRlVGVtcGxhdGUoc2VsZi5vcmlnaW5hbCwgYXJyYXlbaV0sIHRlbXBsYXRpbmcuRWFjaC5yZWdFeHApO1xyXG5cdFx0fVxyXG5cdH1cclxuXHRzZWxmLmVsZW1lbnQuaW5uZXJIVE1MID0gYXJyYXlIdG1sO1xyXG59O1xyXG5cclxubW9kdWxlLmV4cG9ydHMgPSBBcnJheUJpbmRpbmc7IiwidmFyIHRlbXBsYXRpbmcgPSByZXF1aXJlKFwiZHJvb3B5LXRlbXBsYXRpbmdcIik7XHJcbnZhciBOb2RlQmluZGluZyA9IHJlcXVpcmUoXCIuL25vZGVCaW5kaW5nXCIpO1xyXG52YXIgQXJyYXlCaW5kaW5nID0gcmVxdWlyZShcIi4vYXJyYXlCaW5kaW5nXCIpO1xyXG5cclxudmFyIERyb29weUJpbmRpbmcgPSBmdW5jdGlvbihjb250YWluZXJJZCwgbW9kZWwsIHNob3VsZEluaXQpIHtcclxuXHR0aGlzLm1vZGVsID0gbW9kZWw7XHJcblx0dGhpcy5jb250YWluZXIgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZChjb250YWluZXJJZCk7XHJcblxyXG5cdC8vR2V0IGFsbCBiaW5kaW5nc1xyXG5cdHRoaXMuYmluZGluZ3MgPSB0aGlzLmdldEJpbmRpbmdzKHRoaXMuY29udGFpbmVyKTtcclxuXHJcblx0aWYgKHNob3VsZEluaXQgIT09IGZhbHNlKSB7XHJcblx0XHR0aGlzLmluaXQoKTtcclxuXHR9XHJcbn07XHJcblxyXG5Ecm9vcHlCaW5kaW5nLnByb3RvdHlwZS5pbml0ID0gZnVuY3Rpb24oKSB7XHJcblx0dmFyIHNlbGYgPSB0aGlzO1xyXG5cdHNlbGYudXBkYXRlQmluZGluZ3MoKTtcclxuXHRzZWxmLnJlY3Vyc2l2ZU9ic2VydmUoc2VsZi5tb2RlbCwgXCJcIiwgZnVuY3Rpb24oY2hhbmdlcywgcHJvcENoYWluKSB7XHJcblx0XHRzZWxmLmhhbmRsZU9iamVjdENoYW5nZShjaGFuZ2VzLCBwcm9wQ2hhaW4pO1xyXG5cdH0pO1xyXG59O1xyXG5cclxuRHJvb3B5QmluZGluZy5wcm90b3R5cGUucmVjdXJzaXZlT2JzZXJ2ZSA9IGZ1bmN0aW9uKG9iaiwgcHJvcENoYWluLCBjYWxsYmFjaykge1xyXG5cdHZhciBzZWxmID0gdGhpcztcclxuXHQvLyBNYWtlIHN1cmUgaXRzIGFuIGFycmF5IG9yIG9iamVjdFxyXG5cdGlmICghQXJyYXkuaXNBcnJheShvYmopICYmIHR5cGVvZiBvYmogIT09IFwib2JqZWN0XCIpIHJldHVybjtcclxuXHJcblx0aWYgKEFycmF5LmlzQXJyYXkob2JqKSkge1xyXG5cdFx0aWYgKEFycmF5Lm9ic2VydmUpIHtcclxuXHRcdFx0QXJyYXkub2JzZXJ2ZShvYmosIGZ1bmN0aW9uKGNoYW5nZXMpIHtcclxuXHRcdFx0XHRzZWxmLmhhbmRsZUFycmF5Q2hhbmdlKGNoYW5nZXMsIHByb3BDaGFpbik7XHJcblx0XHRcdH0pO1x0XHRcdFxyXG5cdFx0fSBlbHNlIHtcclxuXHRcdFx0T2JqZWN0Lm9ic2VydmUob2JqLCBmdW5jdGlvbihjaGFuZ2VzKSB7XHJcblx0XHRcdFx0c2VsZi5oYW5kbGVBcnJheUNoYW5nZShjaGFuZ2VzLCBwcm9wQ2hhaW4pO1xyXG5cdFx0XHR9KTtcdFxyXG5cdFx0fVxyXG5cdFx0Ly8gUmVjdXJzaXZlbHkgb2JzZXJ2ZSBhbnkgYXJyYXkgaXRlbXNcclxuXHRcdG9iai5mb3JFYWNoKGZ1bmN0aW9uKGFycmF5SXRlbSwgaSl7XHJcblx0XHRcdHNlbGYucmVjdXJzaXZlT2JzZXJ2ZShhcnJheUl0ZW0sIFwiXCIsIGZ1bmN0aW9uKGNoYW5nZXMpIHsgXHJcblx0XHRcdFx0c2VsZi5oYW5kbGVBcnJheUNoYW5nZS5jYWxsKHNlbGYsIGNoYW5nZXMsIHByb3BDaGFpbik7XHJcblx0XHRcdH0pO1xyXG5cdFx0fSk7XHJcblxyXG5cdH0gZWxzZSB7XHJcblx0XHRPYmplY3Qub2JzZXJ2ZShvYmosIGZ1bmN0aW9uKGNoYW5nZXMpIHtcclxuXHRcdFx0Y2FsbGJhY2soY2hhbmdlcywgcHJvcENoYWluKTtcclxuXHRcdH0pO1xyXG5cdFx0XHJcblx0XHQvLyBSZWN1cnNpdmVseSBvYnNlcnZlIGFueSBjaGlsZCBvYmplY3RzXHJcblx0XHRPYmplY3Qua2V5cyhvYmopLmZvckVhY2goZnVuY3Rpb24ocHJvcE5hbWUpIHtcclxuXHRcdFx0dmFyIG5ld1Byb3BDaGFpbiA9IHByb3BDaGFpbjtcclxuXHRcdFx0aWYgKG5ld1Byb3BDaGFpbikge1xyXG5cdFx0XHRcdG5ld1Byb3BDaGFpbiArPSBcIi5cIiArIHByb3BOYW1lO1xyXG5cdFx0XHR9IGVsc2Uge1xyXG5cdFx0XHRcdG5ld1Byb3BDaGFpbiA9IHByb3BOYW1lO1xyXG5cdFx0XHR9XHJcblx0XHRcdHNlbGYucmVjdXJzaXZlT2JzZXJ2ZShvYmpbcHJvcE5hbWVdLCBuZXdQcm9wQ2hhaW4sIGNhbGxiYWNrKTtcclxuXHRcdH0pO1xyXG5cdH1cclxuXHRcclxufTtcclxuXHJcbkRyb29weUJpbmRpbmcucHJvdG90eXBlLmhhbmRsZUFycmF5Q2hhbmdlID0gZnVuY3Rpb24oY2hhbmdlcywgcHJvcENoYWluKSB7XHJcblx0dmFyIHNlbGYgPSB0aGlzO1xyXG5cclxuXHQvLyBSZS1vYnNlcnZlIGFueSBuZXcgb2JqZWN0c1xyXG5cdGNoYW5nZXMuZm9yRWFjaChmdW5jdGlvbihjaGFuZ2Upe1xyXG5cdFx0Ly9JZiBpdHMgYW4gYXJyYXkgY2hhbmdlLCBhbmQgYW4gdXBkYXRlLCBpdHMgYSBuZXcgaW5kZXggYXNzaWdubWVudCBzbyByZS1vYnNlcnZlXHJcblx0XHRpZiAoQXJyYXkuaXNBcnJheShjaGFuZ2Uub2JqZWN0KSAmJiBjaGFuZ2UudHlwZSA9PT0gXCJ1cGRhdGVcIikge1xyXG5cdFx0XHRzZWxmLnJlY3Vyc2l2ZU9ic2VydmUoY2hhbmdlLm9iamVjdFtjaGFuZ2UubmFtZV0sIFwiXCIsIGZ1bmN0aW9uKGNoYW5nZXMpIHsgXHJcblx0XHRcdFx0c2VsZi5oYW5kbGVBcnJheUNoYW5nZS5jYWxsKHNlbGYsIGNoYW5nZXMsIHByb3BDaGFpbik7XHJcblx0XHRcdH0pO1xyXG5cdFx0fSBcclxuXHRcdC8vIElmIGl0cyBhIHB1c2ggb3IgYSBwb3AgaXQgd2lsbCBjb21lIHRocm91Z2ggYXMgc3BsaWNlXHJcblx0XHRlbHNlIGlmIChBcnJheS5pc0FycmF5KGNoYW5nZS5vYmplY3QpICYmIGNoYW5nZS50eXBlID09PSBcInNwbGljZVwiKSB7XHJcblx0XHRcdC8vIElmIGl0cyBhIHB1c2gsIGFkZGVkQ291bnQgd2lsbCBiZSAxXHJcblx0XHRcdGlmIChjaGFuZ2UuYWRkZWRDb3VudCA+IDApIHtcclxuXHRcdFx0XHQvLyBzdGFydCBvYnNlcnZpbmcgdGhlIG5ldyBhcnJheSBpdGVtXHJcblx0XHRcdFx0c2VsZi5yZWN1cnNpdmVPYnNlcnZlKGNoYW5nZS5vYmplY3RbY2hhbmdlLmluZGV4XSwgXCJcIiwgZnVuY3Rpb24oY2hhbmdlcykgeyBcclxuXHRcdFx0XHRcdHNlbGYuaGFuZGxlQXJyYXlDaGFuZ2UuY2FsbChzZWxmLCBjaGFuZ2VzLCBwcm9wQ2hhaW4pO1xyXG5cdFx0XHRcdH0pO1xyXG5cdFx0XHR9XHJcblx0XHRcdC8vIElmIGl0cyBhIHBvcCB3ZSByZWFsbHkgZG9uJ3QgY2FyZSBoZXJlIGJlY2F1c2UgdGhlcmUgaXMgbm90aGluZyB0byByZS1vYnNlcnZlXHJcblx0XHR9XHJcblx0fSk7XHJcblx0Ly8gUmVyZW5kZXIgZGF0YS1lYWNoIGJpbmRpbmdzIHRoYXQgYXJlIHRpZWQgdG8gdGhlIGFycmF5XHJcblx0c2VsZi5iaW5kaW5ncy5mb3JFYWNoKGZ1bmN0aW9uKGJpbmRpbmcpIHtcclxuXHRcdGlmIChiaW5kaW5nLmZ1bGxQcm9wZXJ0eSA9PT0gcHJvcENoYWluKSB7XHJcblx0XHRcdGJpbmRpbmcudXBkYXRlKHNlbGYubW9kZWwpO1xyXG5cdFx0fVxyXG5cdH0pO1xyXG59O1xyXG5cclxudmFyIF9maW5kQmluZGluZ3MgPSBmdW5jdGlvbihiaW5kaW5ncywgcHJvcGVydHkpIHtcclxuXHRyZXR1cm4gYmluZGluZ3MuZmlsdGVyKGZ1bmN0aW9uKGJpbmRpbmcpIHtcclxuXHRcdHJldHVybiAoYmluZGluZy5mdWxsUHJvcGVydHkuaW5kZXhPZihwcm9wZXJ0eSkgPT09IDApXHJcblx0fSk7XHJcbn07XHJcblxyXG5Ecm9vcHlCaW5kaW5nLnByb3RvdHlwZS5oYW5kbGVPYmplY3RDaGFuZ2UgPSBmdW5jdGlvbihjaGFuZ2VzLCBwcm9wQ2hhaW4pIHtcclxuXHR2YXIgc2VsZiA9IHRoaXM7XHJcblx0Y2hhbmdlcy5mb3JFYWNoKGZ1bmN0aW9uKGNoYW5nZSkge1xyXG5cdFx0Ly8gR2V0IHRoZSBwcm9wZXJ0eSBjaGFpbiBzdHJpbmcgdG8gdGllIGJhY2sgdG8gVUkgcGxhY2Vob2xkZXJcclxuXHRcdHZhciBjaGFuZ2VkUHJvcCA9IGNoYW5nZS5uYW1lO1xyXG5cdFx0aWYgKHByb3BDaGFpbikge1xyXG5cdFx0XHRjaGFuZ2VkUHJvcCA9IHByb3BDaGFpbiArIFwiLlwiICsgY2hhbmdlLm5hbWU7XHJcblx0XHR9XHJcblxyXG5cdFx0Ly8gQ2hlY2sgZWFjaCBiaW5kaW5nIHRvIHNlZSBpZiBpdCBjYXJlcywgdXBkYXRlIGlmIGl0IGRvZXNcclxuXHRcdF9maW5kQmluZGluZ3Moc2VsZi5iaW5kaW5ncywgY2hhbmdlZFByb3ApLmZvckVhY2goZnVuY3Rpb24oYmluZGluZyl7XHJcblx0XHRcdGJpbmRpbmcudXBkYXRlKHNlbGYubW9kZWwpO1xyXG5cdFx0fSk7XHJcblxyXG5cdFx0Ly8gSWYgb2JqZWN0IGdldHMgb3ZlcndyaXR0ZW4sIG5lZWQgdG8gcmUtb2JzZXJ2ZSBpdFxyXG5cdFx0aWYgKGNoYW5nZS50eXBlID09PSBcInVwZGF0ZVwiKSB7XHJcblx0XHRcdHNlbGYucmVjdXJzaXZlT2JzZXJ2ZShjaGFuZ2Uub2JqZWN0W2NoYW5nZS5uYW1lXSwgY2hhbmdlZFByb3AsIGZ1bmN0aW9uKGNoYW5nZXMsIHByb3BDaGFpbikge1xyXG5cdFx0XHRcdHNlbGYuaGFuZGxlT2JqZWN0Q2hhbmdlKGNoYW5nZXMsIHByb3BDaGFpbik7XHJcblx0XHRcdH0pO1xyXG5cdFx0fVxyXG5cdH0pO1xyXG59O1xyXG5cclxuRHJvb3B5QmluZGluZy5wcm90b3R5cGUudXBkYXRlQmluZGluZ3MgPSBmdW5jdGlvbigpIHtcclxuXHR2YXIgc2VsZiA9IHRoaXM7XHJcblx0c2VsZi5iaW5kaW5ncy5mb3JFYWNoKGZ1bmN0aW9uKGJpbmRpbmcpIHtcclxuXHRcdGJpbmRpbmcudXBkYXRlKHNlbGYubW9kZWwpO1xyXG5cdH0pO1xyXG59O1xyXG5cclxuRHJvb3B5QmluZGluZy5wcm90b3R5cGUudXBkYXRlTW9kZWxQcm9wZXJ0eSA9IGZ1bmN0aW9uKGZ1bGxQcm9wZXJ0eSwgbmV3VmFsdWUpIHtcclxuXHQvL3N0YXJ0IHdpdGggdGhlIG1vZGVsXHJcblx0dmFyIHByb3BlcnR5Q2hhaW4gPSBmdWxsUHJvcGVydHkuc3BsaXQoJy4nKTtcclxuXHR2YXIgcGFyZW50T2JqID0gdGhpcy5tb2RlbDtcclxuXHR2YXIgcHJvcGVydHkgPSBmdWxsUHJvcGVydHk7XHJcblx0Ly90cmF2ZXJzZSB0aGUgcHJvcGVydHkgY2hhaW4sIGV4Y2VwdCBmb3IgbGFzdCBvbmVcclxuXHRmb3IgKHZhciBpID0gMDsgaSA8IHByb3BlcnR5Q2hhaW4ubGVuZ3RoIC0gMTsgaSsrKSB7XHJcblx0XHRpZiAocGFyZW50T2JqW3Byb3BlcnR5Q2hhaW5baV1dICE9IG51bGwpIHtcclxuXHRcdFx0cHJvcGVydHkgPSBwcm9wZXJ0eUNoYWluW2ldO1xyXG5cdFx0XHRwYXJlbnRPYmogPSBwYXJlbnRPYmpbcHJvcGVydHldO1xyXG5cdFx0fSBcclxuXHR9XHJcblx0Ly9pZiBpdHMgYW4gdW5kZXJzY29yZSwgaXRzIHJlZmVyZW5jaW5nIHRoZSBtb2RlbCBzY29wZVxyXG5cdGlmKGZ1bGxQcm9wZXJ0eSA9PT0gXCJfXCIpIHtcclxuXHRcdHBhcmVudE9iaiA9IG5ld1ZhbHVlO1xyXG5cdH0gZWxzZSB7XHJcblx0XHRwcm9wZXJ0eSA9IHByb3BlcnR5Q2hhaW5bcHJvcGVydHlDaGFpbi5sZW5ndGggLSAxXTtcclxuXHRcdHBhcmVudE9ialtwcm9wZXJ0eV0gPSBuZXdWYWx1ZTtcclxuXHR9XHJcbn07XHJcblxyXG5Ecm9vcHlCaW5kaW5nLnByb3RvdHlwZS51cGRhdGVNb2RlbCA9IGZ1bmN0aW9uKG5ld01vZGVsKSB7XHJcblx0dGhpcy5tb2RlbCA9IG5ld01vZGVsO1xyXG5cdHRoaXMuaW5pdCgpO1xyXG59O1xyXG5cclxuRHJvb3B5QmluZGluZy5wcm90b3R5cGUuZ2V0QmluZGluZ3MgPSBmdW5jdGlvbihlbGVtZW50KSB7XHJcblx0dmFyIHNlbGYgPSB0aGlzO1xyXG5cdHZhciBiaW5kaW5ncyA9IFtdO1xyXG5cdHZhciBwbGFjZWhvbGRlcnMgPSBbXTtcclxuXHR2YXIgaSA9IDA7XHJcblx0Ly8gMS4gTG9vayBmb3IgYXR0cmlidXRlIGJpbmRpbmdzIGFuZCBhcnJheSBiaW5kaW5ncyBvbiB0aGUgY3VycmVudCBlbGVtZW50XHJcblx0aWYgKGVsZW1lbnQuYXR0cmlidXRlcykge1xyXG5cdFx0Zm9yIChpID0gMDsgaSA8IGVsZW1lbnQuYXR0cmlidXRlcy5sZW5ndGg7IGkrKykge1xyXG5cdFx0XHRpZiAoZWxlbWVudC5hdHRyaWJ1dGVzW2ldLm5vZGVOYW1lID09PSBcImRhdGEtZWFjaFwiKSB7XHJcblx0XHRcdFx0YmluZGluZ3MucHVzaChuZXcgQXJyYXlCaW5kaW5nKGVsZW1lbnQsIGVsZW1lbnQuYXR0cmlidXRlc1tpXS5ub2RlVmFsdWUpKTtcclxuXHRcdFx0fSBlbHNlIHtcclxuXHRcdFx0XHR2YXIgYXR0cmlidXRlQmluZGluZ3MgPSB0ZW1wbGF0aW5nLmdldFBsYWNlSG9sZGVycyhlbGVtZW50LmF0dHJpYnV0ZXNbaV0ubm9kZVZhbHVlKVxyXG5cdFx0XHRcdFx0Lm1hcChmdW5jdGlvbihwbGFjZWhvbGRlcikge1xyXG5cdFx0XHRcdFx0XHR2YXIgYmluZGluZyA9IG5ldyBOb2RlQmluZGluZyhlbGVtZW50LmF0dHJpYnV0ZXNbaV0sIHBsYWNlaG9sZGVyLCBlbGVtZW50KTtcclxuXHRcdFx0XHRcdFx0YmluZGluZy5vbihcImlucHV0LWNoYW5nZVwiLCBzZWxmLnVwZGF0ZU1vZGVsUHJvcGVydHkuYmluZChzZWxmKSk7XHJcblx0XHRcdFx0XHRcdHJldHVybiBiaW5kaW5nO1xyXG5cdFx0XHRcdFx0fSk7XHJcblx0XHRcdFx0YmluZGluZ3MgPSBiaW5kaW5ncy5jb25jYXQoYXR0cmlidXRlQmluZGluZ3MpO1x0XHRcdFx0XHJcblx0XHRcdH1cclxuXHRcdH1cclxuXHR9XHJcblx0Ly8gMi5hIElmIHRoZSBlbGVtZW50IGhhcyBjaGlsZHJlbiwgaXQgd29uJ3QgaGF2ZSBhIHRleHQgYmluZGluZy4gUmVjdXJzZSBvbiBjaGlsZHJlblxyXG5cdGlmIChlbGVtZW50LmNoaWxkTm9kZXMgJiYgZWxlbWVudC5jaGlsZE5vZGVzLmxlbmd0aCkge1xyXG5cdFx0Ly9yZWN1cnNpdmUgY2FsbCBmb3IgZWFjaCBjaGlsZG5vZGVcclxuXHRcdGZvciAoaSA9IDA7IGkgPCBlbGVtZW50LmNoaWxkTm9kZXMubGVuZ3RoOyBpKyspIHtcclxuXHRcdFx0YmluZGluZ3MgPSBiaW5kaW5ncy5jb25jYXQoc2VsZi5nZXRCaW5kaW5ncyhlbGVtZW50LmNoaWxkTm9kZXNbaV0pKTtcclxuXHRcdH1cclxuXHR9IGVsc2Uge1xyXG5cdFx0Ly8gMi5iIFRoZSBlbGVtZW50IGRvZXNuJ3QgaGF2ZSBjaGlsZHJlbiBzbyBsb29rIGZvciBhIHRleHQgYmluZGluZ1xyXG5cdFx0cGxhY2Vob2xkZXJzID0gdGVtcGxhdGluZy5nZXRQbGFjZUhvbGRlcnMoZWxlbWVudC50ZXh0Q29udGVudCk7XHJcblx0XHR2YXIgdGV4dEJpbmRpbmdzID0gcGxhY2Vob2xkZXJzLm1hcChmdW5jdGlvbihwbGFjZWhvbGRlcikge1xyXG5cdFx0XHR2YXIgYmluZGluZyA9IG5ldyBOb2RlQmluZGluZyhlbGVtZW50LCBwbGFjZWhvbGRlciwgZWxlbWVudC5wYXJlbnROb2RlKTtcclxuXHRcdFx0YmluZGluZy5vbihcImlucHV0LWNoYW5nZVwiLCBzZWxmLnVwZGF0ZU1vZGVsUHJvcGVydHkuYmluZChzZWxmKSk7XHJcblx0XHRcdHJldHVybiBiaW5kaW5nO1xyXG5cdFx0fSk7XHJcblx0XHRiaW5kaW5ncyA9IGJpbmRpbmdzLmNvbmNhdCh0ZXh0QmluZGluZ3MpO1xyXG5cdH1cclxuXHRyZXR1cm4gYmluZGluZ3M7XHJcbn07XHJcblxyXG5Ecm9vcHlCaW5kaW5nLnByb3RvdHlwZS5zdWJzY3JpYmUgPSBmdW5jdGlvbihldmVudCwgcHJvcGVydHksIGNhbGxiYWNrKSB7XHJcblx0dmFyIG1hdGNoZXMgPSBfZmluZEJpbmRpbmdzKHRoaXMuYmluZGluZ3MsIHByb3BlcnR5KTtcclxuXHQvL1RoZXJlIGNvdWxkIGJlIG1hbnkgYmluZGluZ3MgZm9yIHRoZSBzYW1lIHByb3BlcnR5LCB3ZSBvbmx5IHdhbnQgdG8gc3VyZmFjZSBvbmUgZXZlbnQgdGhvdWdoXHJcblx0aWYgKG1hdGNoZXMgJiYgbWF0Y2hlcy5sZW5ndGgpIHtcclxuXHRcdG1hdGNoZXNbMF0ub24oZXZlbnQsIGNhbGxiYWNrKTtcclxuXHR9XHJcbn07XHJcblxyXG5cclxuXHJcbm1vZHVsZS5leHBvcnRzID0gRHJvb3B5QmluZGluZzsiLCJ2YXIgdGVtcGxhdGluZyA9IHJlcXVpcmUoXCJkcm9vcHktdGVtcGxhdGluZ1wiKTtcclxudmFyIEV2ZW50YWJsZSA9IHJlcXVpcmUoXCJkcm9vcHktZXZlbnRzXCIpO1xyXG5cclxudmFyIE5vZGVCaW5kaW5nID0gZnVuY3Rpb24obm9kZSwgcGxhY2Vob2xkZXIsIGVsZW1lbnQpIHtcclxuXHRFdmVudGFibGUuY2FsbCh0aGlzKTtcclxuXHR0aGlzLm5vZGUgPSBub2RlO1xyXG5cdHRoaXMub3JpZ2luYWwgPSBub2RlLm5vZGVWYWx1ZTtcclxuXHR0aGlzLnJhdyA9IHBsYWNlaG9sZGVyO1xyXG5cdHRoaXMuZnVsbFByb3BlcnR5ID0gdGhpcy5yYXcuc2xpY2UoMiwgdGhpcy5yYXcubGVuZ3RoIC0gMik7XHJcblx0Ly9pZiBubyBlbGVtZW50IHdhcyBwYXNzZWQgaW4sIGl0IGlzIGEgdGV4dCBiaW5kaW5nLCBvdGhlcndpc2UgYXR0cmlidXRlXHJcblx0dGhpcy5lbGVtZW50ID0gZWxlbWVudCB8fCBub2RlOyBcclxuXHR0aGlzLnNldHVwVHdvV2F5KCk7XHJcbn07XHJcblxyXG5Ob2RlQmluZGluZy5wcm90b3R5cGUgPSBuZXcgRXZlbnRhYmxlKCk7XHJcblxyXG5Ob2RlQmluZGluZy5wcm90b3R5cGUuc2V0dXBUd29XYXkgPSBmdW5jdGlvbigpIHtcclxuXHR2YXIgc2VsZiA9IHRoaXM7XHJcblx0aWYgKHRoaXMuZWxlbWVudCAmJiB0aGlzLmVsZW1lbnQudGFnTmFtZSkge1xyXG5cdFx0dmFyIGVsZW1lbnRUeXBlID0gdGhpcy5lbGVtZW50LnRhZ05hbWUudG9Mb3dlckNhc2UoKTtcclxuXHRcdC8vIFRFWFQgQVJFQVxyXG5cdFx0aWYgKGVsZW1lbnRUeXBlID09PSBcInRleHRhcmVhXCIpIHtcclxuXHRcdFx0dGhpcy5lbGVtZW50LmFkZEV2ZW50TGlzdGVuZXIoXCJpbnB1dFwiLCB0aGlzLm9uSW5wdXRDaGFuZ2UuYmluZCh0aGlzKSk7XHJcblxyXG5cdFx0fSBlbHNlIGlmICh0aGlzLm5vZGUubm9kZU5hbWUgPT09IFwidmFsdWVcIikge1xyXG5cdFx0XHQvLyBJTlBVVCBlbGVtZW50XHJcblx0XHRcdGlmIChlbGVtZW50VHlwZSA9PT0gXCJpbnB1dFwiKSB7XHJcblx0XHRcdFx0dGhpcy5lbGVtZW50LmFkZEV2ZW50TGlzdGVuZXIoXCJpbnB1dFwiLCB0aGlzLm9uSW5wdXRDaGFuZ2UuYmluZCh0aGlzKSk7XHJcblx0XHRcdH0gXHJcblx0XHRcdC8vIFNFTEVDVCBlbGVtZW50XHJcblx0XHRcdGVsc2UgaWYgKGVsZW1lbnRUeXBlID09PSBcInNlbGVjdFwiKSB7XHJcblx0XHRcdFx0dGhpcy5lbGVtZW50LmFkZEV2ZW50TGlzdGVuZXIoXCJjaGFuZ2VcIiwgdGhpcy5vbklucHV0Q2hhbmdlLmJpbmQodGhpcykpO1xyXG5cdFx0XHRcdHNldFRpbWVvdXQodGhpcy5vbklucHV0Q2hhbmdlLmJpbmQodGhpcyksIDEpO1xyXG5cdFx0XHR9XHJcblx0XHR9XHJcblx0fVxyXG5cclxufTtcclxuXHJcbk5vZGVCaW5kaW5nLnByb3RvdHlwZS5vbklucHV0Q2hhbmdlID0gZnVuY3Rpb24oKSB7XHJcblx0Ly9jYWxsZWQgd2l0aCBiaW5kLCBzbyAndGhpcycgaXMgYWN0dWFsbHkgdGhpc1xyXG5cdHRoaXMudHJpZ2dlcihcImlucHV0LWNoYW5nZVwiLCB0aGlzLmZ1bGxQcm9wZXJ0eSwgdGhpcy5lbGVtZW50LnZhbHVlICk7XHJcbn07XHJcblxyXG5Ob2RlQmluZGluZy5wcm90b3R5cGUudXBkYXRlID0gZnVuY3Rpb24obW9kZWwpIHtcclxuXHR2YXIgc2VsZiA9IHRoaXM7XHJcblx0c2VsZi50cmlnZ2VyKFwidXBkYXRpbmdcIik7XHJcblx0Ly9za2lwIGEgdGljayBpbiBldmVudCBsb29wIHRvIGxldCAndXBkYXRpbmcnIGJlIGhhbmRsZWQgYmVmb3JlIHVwZGF0ZVxyXG5cdHNldFRpbWVvdXQoZnVuY3Rpb24oKSB7XHJcblx0XHR2YXIgaHRtbCA9IHRlbXBsYXRpbmcucmVuZGVyVGVtcGxhdGUoc2VsZi5vcmlnaW5hbCwgbW9kZWwpO1xyXG5cdFx0c2VsZi5ub2RlLm5vZGVWYWx1ZSA9IGh0bWw7XHJcblx0XHRpZiAoc2VsZi5ub2RlLm5vZGVOYW1lID09PSBcInZhbHVlXCIgJiYgc2VsZi5lbGVtZW50KSB7XHJcblx0XHRcdHNlbGYuZWxlbWVudC52YWx1ZSA9IGh0bWw7XHJcblx0XHR9XHJcblx0XHRzZWxmLnRyaWdnZXIoXCJ1cGRhdGVkXCIpO1x0XHRcclxuXHR9LDEpO1xyXG59O1xyXG5cclxubW9kdWxlLmV4cG9ydHMgPSBOb2RlQmluZGluZzsiXX0=
