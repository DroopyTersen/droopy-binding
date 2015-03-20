# droopy-binding
Clientside binding implemented with Object.observe

## One-way Binding
Automatically update UI when javascript object gets updated

```javascript
// setup the initial object to bind to
var model = {
	id: 123,
	title: "My Title",
	details: "These are the details"
};
// create the binding then call 'init()' to display the default values
var binding = new droopyBinding.OnewayBinding('container', model);
binding.init();

// pretend we made an ajax request and got new property values for our model
// the title and details html should automatically update after 5 seconds
setTimeout(function(){
	model.title = "New Title",
	model.details = "This simulates data changing after an async ajax request";
}, 5000);
```


