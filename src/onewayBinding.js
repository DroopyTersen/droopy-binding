var templating = require("droopy-templating");
var NodeBinding = require("./nodeBinding");
var ArrayBinding = require("./arrayBinding");

var OnewayBinding = function(containerId, model) {
	this.model = model;
	this.container = document.getElementById(containerId);

	//Get all bindings
	this.bindings = this.getBindings(this.container);
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