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