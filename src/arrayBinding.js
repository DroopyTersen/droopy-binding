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