This is really just an exercise to mess with `Object.observe`.  I'm shooting for the binding functionality of **knockout.js**, the template syntax of **Handlebars**, without the overhead of **Angular**.  

This is a very simple implementation. Next up will be support for nested properties and arrays.  Followed by 2 way binding.

IE9+ support when using polyfill version, `/dist/droopy-binding.polyfill.js`

## One-way Binding
Automatically update UI when javascript object gets updated


#### Setup
**html**
```html
<div id='container' data-id='{{id}}' style='visibility: {{visibility}}'>
    Some text here for {{id}}
	<h1>{{title}}</h1>
	<p>{{details}}</p>
</div>
```

**javascript**
```javascript
// setup the initial object to bind to
var model = {
	id: 123,
	title: "My Title",
	details: "These are the details",
	visibility: "visible"
};
// create the binding and call 'init()' to display the default values
var binding = new droopyBinding.OnewayBinding('container', model);
binding.init();
```

#### Update Examples
```javascript
// Pretend we made an async ajax request and got new property values for our model
// The 'title' and 'details' will automatically update in the view
// No UI code required
setTimeout(function(){
	model.title = "New Title",
	model.details = "This simulates data changing after an async ajax request";
}, 3000);

// It should automatically hide in the view after 6 seconds
setTimeout(function(){
	model.visibility = "hidden";
}, 6000);

// It should automatically show again after 10 seconds
setTimeout(function(){
	model.visibility = "visible";
}, 10000);
```


