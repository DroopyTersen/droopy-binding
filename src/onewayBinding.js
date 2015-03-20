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
	Object.observe(self.model, function(changes) {
		self.handleModelChange(changes);
	});
};

OnewayBinding.prototype.handleModelChange = function(changes) {
	var self = this;
	changes.forEach(function(change){
		// Check each binding to see if it cares, update if it does
		self.bindings.forEach(function(binding) {
			if(binding.fullProperty === change.name) {
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
		for(i = 0; i < element.attributes.length; i++) {
			var attributeBindings = templating.getPlaceHolders(element.attributes[i].nodeValue)
				.map(function(placeholder){
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
		var textBindings = placeholders.map(function(placeholder){
			return new NodeBinding(element, placeholder);
		});
		bindings = bindings.concat(textBindings);
	}
	return bindings;
};

module.exports = OnewayBinding;