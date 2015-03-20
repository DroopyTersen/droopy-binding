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