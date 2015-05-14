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