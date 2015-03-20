Clientside binding implemented with Object.observe. IE9+ support when using polyfill version, `/dist/droopy-binding.polyfill.js`

## One-way Binding
Automatically update UI when javascript object gets updated

**html**
```html
<div id='container' id='item-{{id}}'>
    Some text here for {{id}}
	<h1 data-id='{{id}}'>{{title}}</h1>
	<p>{{details}}</p>
</div>
```

**javascript**
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

// Pretend we made an async ajax request and got new property values for our model
// The 'title' and 'details' will automatically update in the view
// No UI code required
setTimeout(function(){
	model.title = "New Title",
	model.details = "This simulates data changing after an async ajax request";
}, 5000);
```


